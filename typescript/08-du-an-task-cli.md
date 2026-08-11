# Bài 8 — Dự án: CLI quản lý task, type-safe từ đầu đến cuối

Dự án nhỏ nhưng dùng gần hết những gì đã học: discriminated union, `Result`, generic, `as const`, `Record`, `Omit`/`Pick`/`Partial`, kiểm tra `never`, validate biên bằng Zod.

Toàn bộ code trong bài này đã được chạy thật — mọi output bạn thấy là output copy từ terminal.

**Kết quả cuối:** một lệnh `tasks` quản lý công việc, lưu vào JSON, không có `any` và không có `as` nào trong toàn bộ mã nguồn.

---

## 1. Khởi tạo

```bash
mkdir task-cli && cd task-cli
npm init -y
npm pkg set type=module
npm i zod
npm i -D typescript @types/node tsx
mkdir -p src/{cli,domain,store,commands,shared}
```

`tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

> Thiếu `"types": ["node"]` là hàng loạt lỗi này, dù đã cài `@types/node`:
> ```
> src/main.ts(7,29): error TS2591: Cannot find name 'process'. Do you need to install type definitions
> for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
> ```

Scripts:

```bash
npm pkg set scripts.dev="tsx src/main.ts" scripts.build="tsc" scripts.typecheck="tsc --noEmit"
```

Cấu trúc cuối cùng:

```
src/
├── main.ts                 điểm vào: parse → chạy → in
├── cli/args.ts             argv → Command (discriminated union)
├── domain/task.ts          schema Zod + kiểu nghiệp vụ
├── store/file-store.ts     đọc/ghi JSON, validate khi đọc
├── commands/render.ts      hiển thị
└── shared/result.ts        kiểu Result dùng chung
```

---

## 2. `shared/result.ts` — không ném exception

```ts
// src/shared/result.ts
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

Vì sao dùng `Result` thay vì `throw`? Vì chữ ký hàm nói thật: `Promise<Result<Task>>` cho biết hàm này **có thể thất bại**, còn `Promise<Task>` thì im lặng. Và compiler ép người gọi xử lý:

```ts
const created = await store.add(input);
console.log(created.value.title);
```
```
error TS2339: Property 'value' does not exist on type 'Result<Task>'.
  Property 'value' does not exist on type '{ ok: false; error: string; }'.
```

Chú ý `Result<T, never>` ở hàm `ok`: nhánh lỗi là `never` nên khi bạn `return ok(x)` trong một hàm khai `Result<Task>`, TypeScript ghép được ngay mà không bắt bạn ghi kiểu lỗi.

---

## 3. `domain/task.ts` — schema là nguồn sự thật

```ts
// src/domain/task.ts
import { z } from 'zod';

export const PRIORITIES = ['low', 'normal', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];   // "low" | "normal" | "high"

export const TaskSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  priority: z.enum(PRIORITIES),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
  doneAt: z.iso.datetime().nullable(),
});

export type Task = z.infer<typeof TaskSchema>;

export const TaskFileSchema = z.object({
  version: z.literal(1),
  tasks: z.array(TaskSchema),
});
export type TaskFile = z.infer<typeof TaskFileSchema>;

export type CreateTaskInput = Pick<Task, 'title' | 'priority'>;
```

Bốn thứ đang xảy ra ở đây:

1. `PRIORITIES` là **một mảng thật** (dùng để lặp, để in ra thông báo lỗi) và đồng thời là nguồn của kiểu `Priority`. Thêm `'urgent'` vào mảng là kiểu tự có thêm nhánh, thông báo lỗi tự cập nhật, `z.enum` tự chấp nhận.
2. `Task` **suy ra từ schema**, không viết tay. Không thể lệch nhau.
3. `version: z.literal(1)` để sau này còn migrate file khi đổi định dạng.
4. `CreateTaskInput` = `Pick<Task, 'title' | 'priority'>` — người dùng không được tự đặt `id`, `createdAt`, `done`.

---

## 4. `store/file-store.ts` — validate ở biên

File JSON trên đĩa là **dữ liệu ngoài**: người dùng sửa tay được, bản cũ có thể sai định dạng. Nên đọc lên phải validate.

```ts
// src/store/file-store.ts
import { readFile, writeFile } from 'node:fs/promises';
import { type Result, ok, err } from '../shared/result.js';
import { type Task, type CreateTaskInput, type TaskFile, TaskFileSchema } from '../domain/task.js';

const EMPTY: TaskFile = { version: 1, tasks: [] };

export class FileStore {
  constructor(private readonly path: string) {}

  async load(): Promise<Result<TaskFile>> {
    let text: string;
    try {
      text = await readFile(this.path, 'utf8');
    } catch (e) {
      if (e instanceof Error && 'code' in e && e.code === 'ENOENT') return ok(EMPTY);
      return err(`Không đọc được ${this.path}: ${e instanceof Error ? e.message : String(e)}`);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return err(`${this.path} không phải JSON hợp lệ`);
    }

    const parsed = TaskFileSchema.safeParse(raw);
    if (!parsed.success) {
      const lines = parsed.error.issues.map(i => `  - ${i.path.join('.') || '(gốc)'}: ${i.message}`);
      return err(`${this.path} sai định dạng:\n${lines.join('\n')}`);
    }
    return ok(parsed.data);
  }

  async save(file: TaskFile): Promise<Result<void>> {
    try {
      await writeFile(this.path, JSON.stringify(file, null, 2) + '\n', 'utf8');
      return ok(undefined);
    } catch (e) {
      return err(`Không ghi được ${this.path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async add(input: CreateTaskInput): Promise<Result<Task>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;

    const file = loaded.value;
    const nextId = file.tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
    const task: Task = {
      id: nextId,
      title: input.title,
      priority: input.priority,
      done: false,
      createdAt: new Date().toISOString(),
      doneAt: null,
    };

    const saved = await this.save({ ...file, tasks: [...file.tasks, task] });
    if (!saved.ok) return saved;
    return ok(task);
  }

  async update(id: number, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Result<Task>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;

    const file = loaded.value;
    const found = file.tasks.find(t => t.id === id);
    if (found === undefined) return err(`Không tìm thấy task #${id}`);

    const updated: Task = { ...found, ...patch };
    const saved = await this.save({ ...file, tasks: file.tasks.map(t => (t.id === id ? updated : t)) });
    if (!saved.ok) return saved;
    return ok(updated);
  }

  async remove(id: number): Promise<Result<Task>> {
    const loaded = await this.load();
    if (!loaded.ok) return loaded;

    const file = loaded.value;
    const found = file.tasks.find(t => t.id === id);
    if (found === undefined) return err(`Không tìm thấy task #${id}`);

    const saved = await this.save({ ...file, tasks: file.tasks.filter(t => t.id !== id) });
    if (!saved.ok) return saved;
    return ok(found);
  }
}
```

Ba chi tiết đáng chú ý:

**`if (!loaded.ok) return loaded;`** — trả thẳng cái `Result` lỗi đi. Hợp lệ vì `{ ok: false; error: string }` khớp với mọi `Result<T>`, bất kể `T` là gì.

**`patch: Partial<Omit<Task, 'id' | 'createdAt'>>`** — đây là hàng rào chống mass-assignment ([bài 05](./05-utility-va-type-nang-cao.md)). Thử gọi:
```ts
store.update(1, { id: 999 });
```
```
error TS2353: Object literal may only specify known properties, and 'id' does not exist
in type 'Partial<Omit<Task, "id" | "createdAt">>'.
```

**`'code' in e && e.code === 'ENOENT'`** — `catch` cho ra `unknown`, phải thu hẹp từng bước ([bài 03](./03-ham-va-narrowing.md)). Bỏ `'code' in e` đi:
```
error TS2339: Property 'code' does not exist on type 'Error'.
```

---

## 5. `cli/args.ts` — argv thành union

Đây là chỗ dữ liệu bẩn nhất (mảng chuỗi tuỳ ý) biến thành kiểu chặt chẽ.

```ts
// src/cli/args.ts
import { type Result, ok, err } from '../shared/result.js';
import { PRIORITIES, type Priority } from '../domain/task.js';

export type Command =
  | { kind: 'add'; title: string; priority: Priority }
  | { kind: 'list'; filter: 'all' | 'todo' | 'done' }
  | { kind: 'done'; id: number }
  | { kind: 'remove'; id: number }
  | { kind: 'stats' }
  | { kind: 'help' };

function isPriority(v: string): v is Priority {
  return (PRIORITIES as readonly string[]).includes(v);
}

function parseId(raw: string | undefined, cmd: string): Result<number> {
  if (raw === undefined) return err(`Lệnh "${cmd}" cần một id. Ví dụ: tasks ${cmd} 3`);
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return err(`Id phải là số nguyên dương, nhận được "${raw}"`);
  return ok(n);
}

export function parseArgs(argv: string[]): Result<Command> {
  const [cmd, ...rest] = argv;

  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
      return ok({ kind: 'help' });

    case 'add': {
      const flagIndex = rest.findIndex(a => a === '-p' || a === '--priority');
      const priorityRaw = flagIndex === -1 ? 'normal' : rest[flagIndex + 1];
      const words = flagIndex === -1 ? rest : [...rest.slice(0, flagIndex), ...rest.slice(flagIndex + 2)];

      const title = words.join(' ').trim();
      if (title === '') return err('Lệnh "add" cần tiêu đề. Ví dụ: tasks add Viết tài liệu');
      if (priorityRaw === undefined) return err('Cờ -p cần một giá trị: low | normal | high');
      if (!isPriority(priorityRaw)) {
        return err(`Priority không hợp lệ: "${priorityRaw}". Chọn một trong: ${PRIORITIES.join(', ')}`);
      }
      return ok({ kind: 'add', title, priority: priorityRaw });
    }

    case 'list': {
      const filter = rest[0] ?? 'all';
      if (filter !== 'all' && filter !== 'todo' && filter !== 'done') {
        return err(`Bộ lọc không hợp lệ: "${filter}". Chọn: all | todo | done`);
      }
      return ok({ kind: 'list', filter });
    }

    case 'done': {
      const id = parseId(rest[0], 'done');
      return id.ok ? ok({ kind: 'done', id: id.value }) : id;
    }

    case 'rm': {
      const id = parseId(rest[0], 'rm');
      return id.ok ? ok({ kind: 'remove', id: id.value }) : id;
    }

    case 'stats':
      return ok({ kind: 'stats' });

    default:
      return err(`Không biết lệnh "${cmd}". Chạy "tasks help" để xem danh sách.`);
  }
}
```

Ba kỹ thuật đang được dùng:

**`priorityRaw` phải kiểm tra `undefined`** vì `noUncheckedIndexedAccess` khiến `rest[flagIndex + 1]` có kiểu `string | undefined`. Bỏ dòng kiểm tra đi:
```
error TS18048: 'priorityRaw' is possibly 'undefined'.
```
Đúng là nó có thể `undefined` thật — người dùng gõ `tasks add abc -p` rồi thôi.

**`isPriority` là type guard** ([bài 03](./03-ham-va-narrowing.md)). Sau khi qua nó, `priorityRaw` mang kiểu `Priority` chứ không còn `string`, nên `ok({ kind: 'add', priority: priorityRaw })` khớp luôn.

**Narrowing trên `filter`**: sau ba lần loại trừ, TypeScript tự biết `filter` là `'all' | 'todo' | 'done'`. Không cần `as`.

---

## 6. `commands/render.ts` — `Record` ép đủ nhánh

```ts
// src/commands/render.ts
import { type Task, type Priority } from '../domain/task.js';

const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'thấp  ',
  normal: 'thường',
  high: 'CAO   ',
};

export function renderTask(t: Task): string {
  const box = t.done ? '[x]' : '[ ]';
  return `${box} #${String(t.id).padEnd(3)} ${PRIORITY_LABEL[t.priority]}  ${t.title}`;
}

export function renderList(tasks: Task[]): string {
  if (tasks.length === 0) return 'Không có task nào.';
  return tasks.map(renderTask).join('\n');
}

export const HELP = `tasks — quản lý công việc

  tasks add <tiêu đề> [-p low|normal|high]   thêm task
  tasks list [all|todo|done]                 liệt kê
  tasks done <id>                            đánh dấu xong
  tasks rm <id>                              xoá
  tasks stats                                thống kê
  tasks help                                 trợ giúp`;
```

Thêm `'urgent'` vào `PRIORITIES` mà quên bảng nhãn:
```
error TS2741: Property 'urgent' is missing in type '{ low: string; normal: string; high: string; }'
but required in type 'Record<Priority, string>'.
```

Đây là lý do dùng `Record<Priority, string>` thay vì `{ [k: string]: string }`.

---

## 7. `main.ts` — ghép lại, có kiểm tra `never`

```ts
// src/main.ts
import { parseArgs, type Command } from './cli/args.js';
import { FileStore } from './store/file-store.js';
import { renderList, renderTask, HELP } from './commands/render.js';
import { type Result, ok, err } from './shared/result.js';
import { PRIORITIES, type Priority } from './domain/task.js';

const store = new FileStore(process.env['TASKS_FILE'] ?? 'tasks.json');

async function run(cmd: Command): Promise<Result<string>> {
  switch (cmd.kind) {
    case 'help':
      return ok(HELP);

    case 'add': {
      const created = await store.add({ title: cmd.title, priority: cmd.priority });
      if (!created.ok) return created;
      return ok(`Đã thêm:\n${renderTask(created.value)}`);
    }

    case 'list': {
      const loaded = await store.load();
      if (!loaded.ok) return loaded;
      const tasks = loaded.value.tasks.filter(t =>
        cmd.filter === 'all' ? true : cmd.filter === 'done' ? t.done : !t.done,
      );
      return ok(renderList(tasks));
    }

    case 'done': {
      const updated = await store.update(cmd.id, { done: true, doneAt: new Date().toISOString() });
      if (!updated.ok) return updated;
      return ok(`Đã xong:\n${renderTask(updated.value)}`);
    }

    case 'remove': {
      const removed = await store.remove(cmd.id);
      if (!removed.ok) return removed;
      return ok(`Đã xoá:\n${renderTask(removed.value)}`);
    }

    case 'stats': {
      const loaded = await store.load();
      if (!loaded.ok) return loaded;
      const { tasks } = loaded.value;

      const byPriority = {} as Record<Priority, number>;
      for (const p of PRIORITIES) byPriority[p] = 0;
      for (const t of tasks) if (!t.done) byPriority[t.priority]++;

      const done = tasks.filter(t => t.done).length;
      const pct = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);
      return ok(
        [
          `Tổng: ${tasks.length}   Xong: ${done} (${pct}%)   Còn lại: ${tasks.length - done}`,
          `Chưa xong theo mức ưu tiên: ` + PRIORITIES.map(p => `${p}=${byPriority[p]}`).join('  '),
        ].join('\n'),
      );
    }

    default: {
      const _exhaustive: never = cmd;
      return err(`Lệnh chưa được cài đặt: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

const parsed = parseArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(`Lỗi: ${parsed.error}`);
  process.exit(1);
}

const result = await run(parsed.value);
if (!result.ok) {
  console.error(`Lỗi: ${result.error}`);
  process.exit(1);
}
console.log(result.value);
```

**Chú ý `cmd.title` trong nhánh `'add'`**: chỉ nhánh đó mới có `title`. Thử dùng ở nhánh khác:
```ts
case 'stats': return ok(cmd.title);
```
```
error TS2339: Property 'title' does not exist on type '{ kind: "stats"; }'.
```

**`process.env['TASKS_FILE']`** dùng ngoặc vuông chứ không phải `process.env.TASKS_FILE` — vì `ProcessEnv` có index signature. Cả hai đều chạy; ngoặc vuông là bắt buộc nếu bạn bật thêm `noPropertyAccessFromIndexSignature`.

**Sau `process.exit(1)`, TypeScript biết code phía dưới không chạy** — vì `process.exit` khai kiểu trả về `never`. Nhờ đó `parsed.value` ở dòng dưới hợp lệ mà không cần `else`.

---

## 8. Chạy thử

```bash
$ npm run typecheck
$ npx tsx src/main.ts
```
```
tasks — quản lý công việc

  tasks add <tiêu đề> [-p low|normal|high]   thêm task
  tasks list [all|todo|done]                 liệt kê
  tasks done <id>                            đánh dấu xong
  tasks rm <id>                              xoá
  tasks stats                                thống kê
  tasks help                                 trợ giúp
```

```bash
$ npx tsx src/main.ts add Viết tài liệu TypeScript -p high
Đã thêm:
[ ] #1   CAO     Viết tài liệu TypeScript

$ npx tsx src/main.ts add Ôn lại generic
Đã thêm:
[ ] #2   thường  Ôn lại generic

$ npx tsx src/main.ts add Dọn nhà -p low
Đã thêm:
[ ] #3   thấp    Dọn nhà

$ npx tsx src/main.ts list
[ ] #1   CAO     Viết tài liệu TypeScript
[ ] #2   thường  Ôn lại generic
[ ] #3   thấp    Dọn nhà

$ npx tsx src/main.ts done 2
Đã xong:
[x] #2   thường  Ôn lại generic

$ npx tsx src/main.ts list todo
[ ] #1   CAO     Viết tài liệu TypeScript
[ ] #3   thấp    Dọn nhà

$ npx tsx src/main.ts stats
Tổng: 3   Xong: 1 (33%)   Còn lại: 2
Chưa xong theo mức ưu tiên: low=1  normal=0  high=1
```

File sinh ra:

```bash
$ cat tasks.json
```
```json
{
  "version": 1,
  "tasks": [
    {
      "id": 1,
      "title": "Viết tài liệu TypeScript",
      "priority": "high",
      "done": false,
      "createdAt": "2026-08-11T15:15:26.277Z",
      "doneAt": null
    },
    ...
  ]
}
```

### Các nhánh lỗi

```bash
$ npx tsx src/main.ts add abc -p urgent
Lỗi: Priority không hợp lệ: "urgent". Chọn một trong: low, normal, high
$ echo $?
1

$ npx tsx src/main.ts done abc
Lỗi: Id phải là số nguyên dương, nhận được "abc"

$ npx tsx src/main.ts done
Lỗi: Lệnh "done" cần một id. Ví dụ: tasks done 3

$ npx tsx src/main.ts foo
Lỗi: Không biết lệnh "foo". Chạy "tasks help" để xem danh sách.
```

Và đây là chỗ Zod trả công. Sửa tay `tasks.json` cho hỏng đủ kiểu:

```json
{"version":1,"tasks":[{"id":"một","title":"","priority":"urgent","done":false,"createdAt":"hôm qua","doneAt":null}]}
```

```bash
$ npx tsx src/main.ts list
Lỗi: tasks.json sai định dạng:
  - tasks.0.id: Invalid input: expected number, received string
  - tasks.0.title: Too small: expected string to have >=1 characters
  - tasks.0.priority: Invalid option: expected one of "low"|"normal"|"high"
  - tasks.0.createdAt: Invalid ISO datetime
```

Bốn lỗi, chỉ đúng vị trí, ngay tại chỗ đọc file. Không có Zod thì chương trình chạy tiếp với `id` là chuỗi, và bug sẽ nổ ở một nơi hoàn toàn khác.

---

## 9. Kiểm chứng "thêm tính năng không quên chỗ nào"

Đây là bài kiểm tra thật cho toàn bộ thiết kế. Thêm lệnh `clear` vào `Command`:

```ts
export type Command =
  | ...
  | { kind: 'stats' }
  | { kind: 'clear' };      // ← chỉ thêm dòng này
```

```bash
$ npm run typecheck
src/main.ts(61,13): error TS2322: Type '{ kind: "clear"; }' is not assignable to type 'never'.
```

Compiler chỉ thẳng vào dòng `const _exhaustive: never = cmd;` — chỗ duy nhất bạn cần bổ sung. Không phải đọc lại cả dự án để tìm xem còn `switch` nào chưa xử lý.

Tương tự với `PRIORITIES`: thêm `'urgent'` là `Record<Priority, string>` trong `render.ts` báo thiếu nhãn ngay.

Đó là toàn bộ giá trị của TypeScript gói trong một câu: **thay đổi một chỗ, compiler chỉ cho bạn mọi chỗ còn lại phải sửa.**

---

## Bài tập mở rộng

Làm theo thứ tự, mỗi bài dựa trên bài trước:

1. **Lệnh `clear`** — xoá hết task đã xong. Sửa cho `typecheck` sạch trở lại.
2. **Lệnh `edit <id> <tiêu đề mới>`** — dùng lại `store.update`. Chứng minh rằng bạn **không thể** dùng nó để đổi `id` (dán mã lỗi).
3. **Cờ `--due <số ngày>` cho `add`** — thêm field `dueAt: string | null` vào `TaskSchema`. Chạy `typecheck` trước khi sửa gì khác, ghi lại tất cả lỗi compiler chỉ ra — đó chính là danh sách việc phải làm.
4. **Lệnh `overdue`** — liệt kê task chưa xong đã quá hạn. Dùng hàm:
   ```ts
   export function isOverdue(t: Task, days: number, now = new Date()): boolean {
     if (t.done) return false;
     const age = now.getTime() - new Date(t.createdAt).getTime();
     return age > days * 24 * 60 * 60 * 1000;
   }
   ```
5. **Tách `FileStore` thành interface `TaskStore`** rồi viết thêm `MemoryStore` cài đặt cùng interface. `main.ts` chỉ được phụ thuộc vào interface. Đây chính là mẫu Dependency Injection trước khi có framework.
6. **Migrate phiên bản file** — đổi `version: z.literal(1)` thành `z.union([z.literal(1), z.literal(2)])`, viết hàm `migrate(file): TaskFileV2` có kiểm tra `never` trên `version`.
7. **Viết test** bằng `node --test` cho `parseArgs`: kiểm tra cả nhánh thành công lẫn từng thông báo lỗi.

<details>
<summary>Gợi ý đáp án (bài 1, 2, 5)</summary>

```ts
// 1 — args.ts
export type Command = /* ... */ | { kind: 'clear' };
// trong parseArgs:
case 'clear': return ok({ kind: 'clear' });

// main.ts
case 'clear': {
  const loaded = await store.load();
  if (!loaded.ok) return loaded;
  const kept = loaded.value.tasks.filter(t => !t.done);
  const removed = loaded.value.tasks.length - kept.length;
  const saved = await store.save({ ...loaded.value, tasks: kept });
  if (!saved.ok) return saved;
  return ok(`Đã xoá ${removed} task đã xong.`);
}
```

```ts
// 2
case 'edit': {
  const updated = await store.update(cmd.id, { title: cmd.title });
  if (!updated.ok) return updated;
  return ok(`Đã sửa:\n${renderTask(updated.value)}`);
}

// thử đổi id:
store.update(cmd.id, { id: 999 });
// error TS2353: Object literal may only specify known properties, and 'id' does not exist
// in type 'Partial<Omit<Task, "id" | "createdAt">>'.
```

```ts
// 5 — store/task-store.ts
import type { Result } from '../shared/result.js';
import type { Task, CreateTaskInput, TaskFile } from '../domain/task.js';

export interface TaskStore {
  load(): Promise<Result<TaskFile>>;
  save(file: TaskFile): Promise<Result<void>>;
  add(input: CreateTaskInput): Promise<Result<Task>>;
  update(id: number, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Result<Task>>;
  remove(id: number): Promise<Result<Task>>;
}

// file-store.ts
export class FileStore implements TaskStore { /* giữ nguyên */ }

// memory-store.ts
export class MemoryStore implements TaskStore {
  private file: TaskFile = { version: 1, tasks: [] };
  async load() { return ok(this.file); }
  async save(file: TaskFile) { this.file = file; return ok(undefined); }
  /* ... */
}

// main.ts — chỉ biết interface
const store: TaskStore = process.env['TASKS_MEMORY'] === '1'
  ? new MemoryStore()
  : new FileStore(process.env['TASKS_FILE'] ?? 'tasks.json');
```
Thiếu một method trong `MemoryStore`:
```
error TS2420: Class 'MemoryStore' incorrectly implements interface 'TaskStore'.
  Property 'remove' is missing in type 'MemoryStore' but required in type 'TaskStore'.
```

</details>

---

Tiếp theo 👉 [09-loi-thuong-gap.md](./09-loi-thuong-gap.md)
