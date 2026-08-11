# Bài 2 — Xử lý dữ liệu lớn

Bài này giải quyết một câu hỏi duy nhất: **làm sao xử lý 10 triệu bản ghi trên một server chỉ có 512MB RAM?**

Câu trả lời luôn là một trong hai: **stream** (xử lý từng dòng, không giữ lại) hoặc **batch** (xử lý từng lô nhỏ). Không bao giờ là "load hết rồi xử lý".

---

## 1. Vì sao `find()` giết chết server

```ts
// ❌ Code này chạy hoàn hảo trên máy dev với 1000 bản ghi
async exportAll() {
  const posts = await this.repo.find();   // 5 triệu dòng
  return posts.map((p) => ({ id: p.id, title: p.title }));
}
```

Tính thử: mỗi `Post` có `content` trung bình 2KB, cộng overhead object của V8 (~100 byte/property, mỗi entity ~15 property).

```
5.000.000 × (2KB + ~1.5KB overhead) ≈ 17 GB
```

Server có 512MB. Kết quả: Node ném `JavaScript heap out of memory`, process chết, PM2/Docker restart, **mọi request đang xử lý đều mất**. Một endpoint hỏng làm sập cả ứng dụng.

Tệ hơn: nó không chết ngay. Nó chạy được ở 100k dòng, chậm ở 500k, và chết lúc 2 giờ sáng khi dữ liệu chạm ngưỡng.

### Ba giai đoạn ngốn RAM

Một query lớn ngốn RAM ở **ba** chỗ, không phải một:

```
① Driver pg nhận toàn bộ kết quả  →  ② TypeORM hydrate thành entity  →  ③ JSON.stringify
   (buffer thô, ~1x)                  (object JS, ~2-3x)                 (chuỗi, +1x)
```

Nghĩa là dữ liệu 2GB có thể chiếm 8GB RAM ở đỉnh điểm. Cả ba giai đoạn đều phải xử lý bằng stream.

### Đặt giới hạn cứng để phát hiện sớm

```ts
// package.json — cố tình giới hạn heap ở dev để lỗi lộ ra sớm
"scripts": {
  "start:dev": "nest start --watch --exec 'node --max-old-space-size=512'"
}
```

Nếu code chạy được với 512MB ở dev, nó sẽ sống ở production.

---

## 2. Phân trang: `OFFSET` chậm dần đều

### Vấn đề của OFFSET

```sql
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 500000;
```

Postgres phải **đọc và bỏ đi 500.000 dòng** trước khi lấy 20 dòng bạn cần. Đo thực tế trên bảng 1 triệu dòng:

| OFFSET | Thời gian |
|---|---|
| 0 | 0.8 ms |
| 10.000 | 12 ms |
| 100.000 | 95 ms |
| 500.000 | 480 ms |
| 900.000 | 850 ms |

Trang cuối chậm gấp **1000 lần** trang đầu. Với 100 người cùng xem trang sâu, DB sập.

Tự kiểm chứng:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 500000;
-- Chú ý dòng "Rows Removed by ..." và số buffer đọc
```

### Giải pháp: Cursor (keyset) pagination

Thay vì "bỏ qua N dòng", ta nói "lấy các dòng **sau** dòng này":

```sql
SELECT * FROM posts
WHERE (created_at, id) < ('2026-08-01 10:00:00', 4821)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Có index trên `(created_at DESC, id DESC)`, Postgres nhảy thẳng tới vị trí — **0.8ms bất kể trang thứ mấy**.

> Vì sao phải kèm `id`? Vì `created_at` có thể trùng. Cặp `(created_at, id)` là duy nhất, đảm bảo không sót và không lặp bản ghi khi phân trang.

### Cài đặt hoàn chỉnh

```ts
// src/shared/pagination/cursor.ts
export interface Cursor {
  createdAt: string;
  id: number;
}

/** Mã hoá cursor thành chuỗi opaque để client không tự chế */
export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString());
    if (typeof parsed.id !== 'number' || typeof parsed.createdAt !== 'string') {
      throw new Error();
    }
    return parsed;
  } catch {
    throw new BadRequestException('Cursor không hợp lệ');
  }
}
```

```ts
// dto
export class CursorPageDto {
  @IsOptional() @IsString()
  cursor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
}
```

```ts
// service
async findPage(dto: CursorPageDto) {
  const qb = this.repo
    .createQueryBuilder('post')
    .orderBy('post.createdAt', 'DESC')
    .addOrderBy('post.id', 'DESC')
    .take(dto.limit + 1);          // lấy dư 1 để biết còn trang sau không

  if (dto.cursor) {
    const { createdAt, id } = decodeCursor(dto.cursor);
    qb.where('(post.createdAt, post.id) < (:createdAt, :id)', { createdAt, id });
  }

  const rows = await qb.getMany();

  const hasNext = rows.length > dto.limit;
  const items = hasNext ? rows.slice(0, dto.limit) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasNext && last
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null,
  };
}
```

Index bắt buộc:

```sql
CREATE INDEX idx_posts_created_id ON posts (created_at DESC, id DESC);
```

### Đánh đổi

| | OFFSET | Cursor |
|---|---|---|
| Tốc độ trang sâu | Chậm tuyến tính | **Hằng số** |
| Nhảy tới trang bất kỳ ("trang 500") | Được | **Không** |
| Hiển thị tổng số trang | Được | Không (phải `count()` riêng) |
| Bản ghi mới chèn vào lúc đang duyệt | Bị lặp/sót | **Không ảnh hưởng** |

**Chọn thế nào:** UI cuộn vô hạn / app mobile / API cho máy đọc → cursor. Bảng admin có ô "nhảy tới trang N" → OFFSET, nhưng **giới hạn** `OFFSET` tối đa (vd 10.000) và bắt người dùng lọc bớt.

```ts
if ((page - 1) * limit > 10_000) {
  throw new BadRequestException(
    'Không thể phân trang quá sâu. Hãy dùng bộ lọc để thu hẹp kết quả.',
  );
}
```

---

## 3. Stream dữ liệu từ database

Khi thật sự cần duyệt hết bảng (export, migrate, tính toán lại), dùng stream.

### 3.1 TypeORM `.stream()`

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class PostsExportService {
  constructor(@InjectRepository(Post) private readonly repo: Repository<Post>) {}

  async streamAll(): Promise<ReadStream> {
    return this.repo
      .createQueryBuilder('post')
      .select(['post.id', 'post.title', 'post.viewCount', 'post.createdAt'])
      .where('post.status = :status', { status: 'published' })
      .orderBy('post.id', 'ASC')
      .stream();                 // trả về Node ReadStream, KHÔNG load hết vào RAM
  }
}
```

Hai điều quan trọng:

1. **`.stream()` trả về dữ liệu thô** (`{ post_id, post_title, ... }`), **không** phải entity đã hydrate. Đó chính là lý do nó nhẹ.
2. **Luôn `select()` chỉ cột cần dùng.** Kéo cả cột `content` 2KB khi chỉ cần `title` là lãng phí 90% băng thông.

### 3.2 Cách thủ công: batch theo cursor (an toàn hơn)

`.stream()` giữ một connection mở suốt quá trình. Với job chạy hàng giờ, cách này ổn định hơn:

```ts
async *iterateAll(batchSize = 1000): AsyncGenerator<Post[]> {
  let lastId = 0;

  while (true) {
    const batch = await this.repo.find({
      where: { id: MoreThan(lastId) },
      order: { id: 'ASC' },
      take: batchSize,
      select: { id: true, title: true, viewCount: true },
    });

    if (batch.length === 0) break;

    yield batch;
    lastId = batch.at(-1)!.id;

    // Nhường event loop cho request khác — quan trọng!
    await new Promise((r) => setImmediate(r));
  }
}
```

Dùng:

```ts
let processed = 0;
for await (const batch of this.iterateAll(1000)) {
  await this.doSomething(batch);
  processed += batch.length;
  if (processed % 50_000 === 0) {
    this.logger.log(`Đã xử lý ${processed} bản ghi`);
  }
}
```

RAM chỉ giữ 1000 bản ghi tại một thời điểm, bất kể bảng có 10 triệu dòng.

> ⚠️ **Đừng dùng `OFFSET` để duyệt batch.** Nó vừa chậm dần (mục 2), vừa **sót bản ghi** nếu có INSERT/DELETE xen giữa. Luôn duyệt theo khoá tăng dần (`id > lastId`).

---

## 4. Export file lớn: CSV vài triệu dòng

Đây là yêu cầu phổ biến nhất và cũng là chỗ dễ làm sập server nhất.

### ❌ Cách sai

```ts
@Get('export')
async export(@Res() res: Response) {
  const posts = await this.repo.find();               // ① 17GB RAM
  const csv = posts.map((p) => `${p.id},${p.title}`).join('\n');  // ② thêm 5GB
  res.send(csv);                                      // ③ thêm 5GB nữa
}
```

### ✅ Cách đúng: nối stream

```ts
// src/posts/posts.controller.ts
import { Controller, Get, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

@Controller('posts')
export class PostsController {
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="posts.csv"')
  async exportCsv(@Res() res: Response) {
    const dbStream = await this.exportService.streamAll();

    // Chuyển từng dòng DB thành một dòng CSV
    const toCsv = new Transform({
      objectMode: true,
      transform(row, _enc, cb) {
        cb(null, `${row.post_id},${escapeCsv(row.post_title)},${row.post_viewCount}\n`);
      },
    });

    res.write('id,title,view_count\n');   // header CSV

    try {
      // pipeline tự xử lý backpressure + dọn dẹp khi lỗi
      await pipeline(dbStream, toCsv, res);
    } catch (err) {
      this.logger.error('Export thất bại', err);
      res.destroy(err as Error);         // header đã gửi rồi, không set status được nữa
    }
  }
}

function escapeCsv(v: string): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
```

RAM sử dụng: **vài MB**, không phụ thuộc số dòng. File 3GB vẫn tải được bình thường.

### Backpressure — cơ chế khiến nó hoạt động

Đây là điểm mấu chốt cần hiểu:

```
DB đọc nhanh (100k dòng/s)  →  [buffer]  →  Client tải chậm (mạng 3G)
```

Nếu không có backpressure, buffer phình vô hạn → OOM. `pipeline()` tự động: khi `res` báo "buffer đầy", nó **tạm dừng** `dbStream`, và resume khi client tiêu thụ xong.

**Đây là lý do bạn phải dùng `pipeline()` chứ không phải `.pipe()`.** `.pipe()` cũng có backpressure nhưng **không tự dọn dẹp khi lỗi** — client hủy tải giữa chừng sẽ để lại connection DB treo, rò rỉ dần đến khi hết pool.

```ts
// ❌ rò rỉ connection khi client ngắt kết nối
dbStream.pipe(toCsv).pipe(res);

// ✅ tự destroy toàn bộ chuỗi stream khi có lỗi ở bất kỳ khâu nào
await pipeline(dbStream, toCsv, res);
```

### Dùng `StreamableFile` cho file có sẵn trên đĩa

```ts
import { StreamableFile } from '@nestjs/common';
import { createReadStream } from 'node:fs';

@Get('report/:id/download')
download(@Param('id') id: string) {
  const file = createReadStream(`/var/reports/${id}.csv`);
  return new StreamableFile(file, {
    type: 'text/csv',
    disposition: `attachment; filename="report-${id}.csv"`,
  });
}
```

`StreamableFile` cho phép giữ nguyên interceptor và filter của Nest (khác với `@Res()` thô).

### Export định dạng khác

| Định dạng | Thư viện hỗ trợ stream | Lưu ý |
|---|---|---|
| CSV | `fast-csv` (`format()`) | Nhẹ nhất, luôn ưu tiên |
| JSON lớn | tự viết Transform: `[`, `,`, `]` | Đừng `JSON.stringify` cả mảng |
| Excel `.xlsx` | `exceljs` với `WorkbookWriter` (streaming) | Excel giới hạn **1.048.576 dòng/sheet** |
| PDF | `pdfkit` (pipe vào response) | Nặng CPU — nên đẩy vào queue |

Ví dụ JSON stream:

```ts
const toJson = new Transform({
  objectMode: true,
  transform(row, _e, cb) {
    const prefix = this.started ? ',' : (this.started = true, '[');
    cb(null, prefix + JSON.stringify(row));
  },
  flush(cb) {
    cb(null, this.started ? ']' : '[]');
  },
});
```

### Khi nào KHÔNG export trực tiếp qua HTTP

Nếu export mất hơn ~30 giây, đừng bắt client chờ. Chuyển sang **job nền**:

```
POST /exports  →  tạo job, trả 202 + { jobId }
                  worker sinh file, upload S3
GET  /exports/:jobId  →  { status: 'processing' | 'done', url? }
```

Chi tiết ở [bài 05](./05-queue-va-job-nen.md). Lý do: proxy/load balancer thường timeout ở 30–60s, và client mất kết nối là mất trắng công sức.

---

## 5. Import / ghi dữ liệu lớn

### 5.1 Bulk insert — đừng lặp `save()`

```ts
// ❌ 100.000 round-trip tới DB, mất ~15 phút
for (const row of rows) {
  await this.repo.save(row);
}

// ⚠️ Tốt hơn nhưng vẫn có thể sinh câu SQL khổng lồ vượt giới hạn tham số
await this.repo.insert(rows);

// ✅ Chia lô
async bulkInsert(rows: Partial<Post>[], chunkSize = 1000) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await this.repo.insert(rows.slice(i, i + chunkSize));
  }
}
```

Đo thực tế với 100.000 dòng:

| Cách | Thời gian |
|---|---|
| `save()` từng dòng | ~900 s |
| `insert()` lô 1000 | ~8 s |
| `COPY` (mục 5.4) | ~1.5 s |

> Giới hạn kỹ thuật: Postgres cho tối đa **65535 tham số** một câu lệnh. Bảng 10 cột → tối đa ~6500 dòng/lô. Lấy `chunkSize = 1000` là an toàn cho mọi trường hợp.

### 5.2 Upsert hàng loạt

```ts
await this.repo
  .createQueryBuilder()
  .insert()
  .into(Post)
  .values(chunk)
  .orUpdate(
    ['title', 'content', 'updated_at'],   // cột cần cập nhật khi trùng
    ['slug'],                             // cột xác định trùng (phải có unique index)
  )
  .execute();
```

Sinh ra `INSERT ... ON CONFLICT (slug) DO UPDATE SET ...` — một round-trip cho cả lô.

### 5.3 Import file CSV lớn (file 2GB)

Không bao giờ `readFileSync`. Parse theo stream, gom lô, ghi lô:

```ts
import { parse } from 'fast-csv';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';

async importCsv(filePath: string) {
  const CHUNK = 1000;
  let buffer: Partial<Post>[] = [];
  let total = 0;
  const errors: { line: number; message: string }[] = [];
  let line = 1;

  const writer = new Writable({
    objectMode: true,
    highWaterMark: CHUNK * 2,         // giới hạn hàng đợi nội bộ
    write: async (row, _enc, cb) => {
      line++;
      try {
        buffer.push(this.mapRow(row));
        if (buffer.length >= CHUNK) {
          await this.repo.insert(buffer);   // await ở đây tạo backpressure tự nhiên
          total += buffer.length;
          buffer = [];
        }
        cb();
      } catch (err) {
        errors.push({ line, message: (err as Error).message });
        cb();                              // KHÔNG cb(err) — bỏ qua dòng lỗi, chạy tiếp
      }
    },
  });

  await pipeline(
    createReadStream(filePath),
    parse({ headers: true, ignoreEmpty: true }),
    writer,
  );

  if (buffer.length) {                     // đừng quên phần dư cuối cùng
    await this.repo.insert(buffer);
    total += buffer.length;
  }

  return { total, failed: errors.length, errors: errors.slice(0, 100) };
}
```

Ba chi tiết quyết định thành bại:

1. **`await` bên trong `write()`** — tạo backpressure. Không có nó, stream đọc file nhanh hơn DB ghi và buffer phình vô hạn.
2. **Xử lý phần dư sau `pipeline`** — lô cuối gần như luôn nhỏ hơn `CHUNK`.
3. **Lỗi một dòng không được giết cả job.** Gom lại báo cáo cuối, `cb()` không tham số để đi tiếp.

### 5.4 `COPY` — nhanh nhất cho import khổng lồ

Khi cần nạp hàng chục triệu dòng, `COPY` của Postgres nhanh gấp 5–10 lần `INSERT`:

```ts
import { from as copyFrom } from 'pg-copy-streams';

async copyImport(filePath: string) {
  const runner = this.dataSource.createQueryRunner();
  await runner.connect();
  const raw = (runner.connection.driver as any).master; // pg Pool

  const client = await raw.connect();
  try {
    const dbStream = client.query(
      copyFrom('COPY posts (title, slug, content) FROM STDIN WITH (FORMAT csv, HEADER true)'),
    );
    await pipeline(createReadStream(filePath), dbStream);
  } finally {
    client.release();
    await runner.release();
  }
}
```

Đánh đổi: `COPY` **không** chạy validation, không `ON CONFLICT`, lỗi một dòng là hỏng cả lô. Dùng cho dữ liệu đã sạch (migrate hệ thống, restore backup).

### 5.5 Nhận file upload lớn mà không nạp vào RAM

```ts
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Post('import')
@UseInterceptors(
  FileInterceptor('file', {
    storage: diskStorage({                 // ghi thẳng ra đĩa, KHÔNG giữ trong RAM
      destination: '/tmp/uploads',
      filename: (_req, file, cb) => cb(null, `${randomUUID()}-${file.originalname}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024 * 1024 },   // 2GB
    fileFilter: (_req, file, cb) => {
      cb(null, ['text/csv', 'application/vnd.ms-excel'].includes(file.mimetype));
    },
  }),
)
async import(@UploadedFile() file: Express.Multer.File) {
  // Không xử lý ở đây — đẩy vào queue rồi trả về ngay
  const job = await this.importQueue.add('import-csv', { path: file.path });
  return { jobId: job.id, status: 'queued' };
}
```

> Mặc định multer dùng `memoryStorage` — file 2GB sẽ nằm gọn trong RAM. **Luôn khai báo `diskStorage`** cho file lớn.

---

## 6. Xử lý hàng loạt không chặn event loop

Node chạy một luồng. Một vòng lặp CPU nặng làm **đứng toàn bộ server** — mọi request khác treo cho tới khi nó xong.

```ts
// ❌ 1 triệu vòng lặp đồng bộ = server đứng vài giây
for (const post of posts) {
  post.score = heavyCalculation(post);
}
```

### Cách 1: nhường event loop định kỳ

```ts
for (let i = 0; i < items.length; i++) {
  process(items[i]);
  if (i % 500 === 0) {
    await new Promise((r) => setImmediate(r));   // nhả luồng cho request khác
  }
}
```

### Cách 2: giới hạn song song khi gọi I/O

```ts
// ❌ mở 100.000 kết nối cùng lúc -> sập cả app lẫn dịch vụ đích
await Promise.all(ids.map((id) => this.http.fetch(id)));

// ✅ giới hạn 20 việc đồng thời
import pLimit from 'p-limit';
const limit = pLimit(20);
await Promise.all(ids.map((id) => limit(() => this.http.fetch(id))));
```

Con số 20 không tuỳ tiện — nó phải khớp với connection pool và rate limit của dịch vụ đích ([bài 03](./03-toi-uu-database.md), [bài 06](./06-chiu-tai-cao.md)).

### Cách 3: đẩy sang worker thread (CPU thuần)

Với việc thực sự nặng CPU (nén ảnh, tính toán ma trận, sinh PDF), `setImmediate` không cứu được — phải chạy ở luồng khác:

```bash
npm i piscina
```

```ts
// src/shared/workers/pool.ts
import Piscina from 'piscina';
import { resolve } from 'node:path';

export const cpuPool = new Piscina({
  filename: resolve(__dirname, 'heavy.worker.js'),
  maxThreads: 4,               // = số core, đừng nhiều hơn
});
```

```ts
// heavy.worker.ts
module.exports = ({ imageBuffer }) => {
  return sharp(imageBuffer).resize(800).webp().toBuffer();
};
```

```ts
const result = await cpuPool.run({ imageBuffer });   // không chặn event loop chính
```

---

## 7. Đo RAM để biết mình có đúng không

```ts
// src/shared/observability/memory.util.ts
export function logMemory(label: string, logger: Logger) {
  const m = process.memoryUsage();
  const mb = (n: number) => Math.round(n / 1024 / 1024);
  logger.log(
    `[${label}] heap=${mb(m.heapUsed)}/${mb(m.heapTotal)}MB rss=${mb(m.rss)}MB external=${mb(m.external)}MB`,
  );
}
```

- **heapUsed** — object JavaScript. Tăng vọt ở đây = bạn đang giữ mảng lớn.
- **rss** — tổng RAM process chiếm, gồm cả buffer stream.
- **external** — Buffer/ArrayBuffer ngoài heap V8.

Chèn vào đầu và cuối job. Với code stream đúng, `heapUsed` phải **phẳng** dù xử lý bao nhiêu dòng:

```
[export:start]  heap=45/60MB
[export:100k]   heap=52/70MB     ← ổn định
[export:1M]     heap=54/70MB     ← vẫn ổn định => stream hoạt động
```

Nếu thấy tăng tuyến tính, chỗ nào đó đang tích luỹ mảng.

Xem chi tiết hơn khi nghi rò rỉ:

```bash
node --expose-gc --inspect dist/main.js
# Mở chrome://inspect -> Memory -> chụp 2 heap snapshot cách nhau, so sánh
```

---

## 8. Checklist trước khi merge code đụng dữ liệu lớn

- [ ] Không có `find()` nào thiếu `take` hoặc điều kiện lọc chặt
- [ ] Mọi `select` chỉ lấy cột thực sự dùng (đặc biệt tránh cột `text`/`jsonb` lớn)
- [ ] Endpoint danh sách có `limit` tối đa (`@Max(100)`)
- [ ] Phân trang sâu dùng cursor, hoặc chặn `OFFSET` quá lớn
- [ ] Export/import chạy bằng stream, dùng `pipeline()` chứ không `.pipe()`
- [ ] Insert hàng loạt được chia lô ≤ 1000
- [ ] Upload file lớn dùng `diskStorage` + có `limits.fileSize`
- [ ] Vòng lặp dài có `setImmediate` hoặc `p-limit`
- [ ] Job chạy > 30s được đẩy vào queue, không nằm trong request
- [ ] Đã test với dữ liệu thật (1 triệu dòng), không phải 100 dòng seed

---

## 9. Bài tập bài 2

Dùng bảng `posts` 1 triệu dòng đã tạo ở [README](./README.md).

1. **Đo nỗi đau:** viết endpoint `GET /posts?page=N&limit=20` dùng `OFFSET`, đo thời gian tại page 1, 500, 5000, 25000. Vẽ bảng kết quả.
2. **Sửa bằng cursor:** cài `GET /posts/cursor?cursor=...&limit=20`. Tạo index `(created_at DESC, id DESC)`. Đo lại — thời gian phải gần như không đổi giữa trang đầu và trang cuối.
3. **Export CSV 1 triệu dòng** qua stream. Chạy `logMemory` mỗi 100k dòng và chứng minh `heapUsed` không tăng tuyến tính.
4. **Cố tình làm sai:** viết bản `find()` rồi `join('\n')`, chạy với `node --max-old-space-size=256`, quan sát nó chết. Hiểu rõ thông báo lỗi.
5. **Import CSV 500k dòng** với batch 1000, có xử lý dòng lỗi (cố tình làm hỏng 10 dòng trong file) và trả về báo cáo `{ total, failed, errors }`.
6. So sánh thời gian import bằng `save()` từng dòng vs `insert()` theo lô vs `COPY`. Ghi lại con số.
7. **Test backpressure:** tải file export bằng `curl --limit-rate 50k`, đồng thời gọi các API khác — chúng phải vẫn phản hồi bình thường. Sau đó `Ctrl+C` giữa chừng và kiểm tra `SELECT count(*) FROM pg_stat_activity` để chắc chắn connection đã được trả về pool.

➡️ Tiếp: [03-toi-uu-database.md](./03-toi-uu-database.md)
