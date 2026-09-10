# Bài A9 — Dự án: RPC type-safe từ hợp đồng đến lời gọi

Dự án cuối của bộ nâng cao. Ta xây một **RPC layer** nơi:

- Hợp đồng (contract) khai một lần, ở một chỗ.
- Tham số đường dẫn được **rút ra từ chính chuỗi path** — thêm `:postId` vào path là handler và người gọi bắt buộc phải truyền `postId`.
- Body và response được Zod kiểm tra lúc chạy, và kiểu TypeScript **suy ra từ schema**, không khai lại.
- Lỗi trả về bằng `Result`, không `throw`.
- Không có `any` nào lọt ra API công khai.

Đây là bản thu nhỏ của cơ chế mà `tRPC` và `Hono` dùng. Làm xong bài này bạn đọc được mã nguồn của chúng.

Toàn bộ code dưới đây **chạy thật**; output dán nguyên văn. Mã nguồn hoàn chỉnh nằm ở
[`du-an-rpc/`](./du-an-rpc/) — `npm install && npm run dev` là chạy được ngay.

---

## 0. Cấu hình

```
rpc/
├─ package.json          { "type": "module" }
├─ tsconfig.json
└─ src/
   ├─ contract.ts        hợp đồng
   ├─ types.ts           máy suy kiểu
   ├─ server.ts          bộ điều phối
   └─ main.ts            demo
```

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "es2023", "lib": ["es2023"],
    "module": "nodenext", "moduleResolution": "nodenext",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "rootDir": "src", "outDir": "dist",
    "declaration": true, "sourceMap": true, "skipLibCheck": true
  },
  "include": ["src"]
}
```

Cấu hình này chính là bản đề xuất ở bài A5 mục 5 — chạy được bằng `node src/main.ts` lúc dev và build ra `dist` lúc deploy.

---

## 1. Hợp đồng

```ts
// src/contract.ts
import { z } from 'zod';

export type Endpoint = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: z.ZodType;
  response: z.ZodType;
};

export function defineContract<const C extends Record<string, Endpoint>>(c: C): C {
  return c;
}

export const contract = defineContract({
  getUser: {
    method: 'GET',
    path: '/users/:userId',
    response: z.object({ id: z.string(), name: z.string() }),
  },
  createPost: {
    method: 'POST',
    path: '/users/:userId/posts',
    body: z.object({ title: z.string().min(1), tags: z.array(z.string()).default([]) }),
    response: z.object({ postId: z.string(), title: z.string() }),
  },
  deletePost: {
    method: 'DELETE',
    path: '/users/:userId/posts/:postId',
    response: z.object({ deleted: z.literal(true) }),
  },
});

export type Contract = typeof contract;
```

Chi tiết duy nhất làm cả bài này chạy được: **`<const C extends ...>`** (bài A1 mục 3). Không có `const`, `path` sẽ bị mở rộng thành `string` và mọi phép rút tham số ở bước sau trả về `never`.

`defineContract` không làm gì lúc chạy — nó chỉ tồn tại để chốt kiểu. Đây là mẫu "identity function làm cổng kiểu", gặp ở khắp nơi (`defineConfig` của Vite, `satisfies` là cách viết khác của cùng ý tưởng).

---

## 2. Máy suy kiểu

```ts
// src/types.ts
import type { z } from 'zod';
import type { Endpoint } from './contract.ts';

export type PathParams<S extends string> =
  S extends `${string}:${infer P}/${infer Rest}` ? P | PathParams<`/${Rest}`>
  : S extends `${string}:${infer P}` ? P
  : never;

export type ParamsOf<E extends Endpoint> =
  [PathParams<E['path']>] extends [never] ? Record<never, never>
  : { [K in PathParams<E['path']>]: string };

export type BodyOf<E extends Endpoint> =
  E extends { body: infer B extends z.ZodType } ? z.input<B> : undefined;

export type ResultOf<E extends Endpoint> = z.output<E['response']>;

export type Input<E extends Endpoint> = { params: ParamsOf<E>; body: BodyOf<E> };

export type Handler<E extends Endpoint> = (input: {
  params: ParamsOf<E>;
  body: z.output<E['body'] & z.ZodType> | undefined;
}) => Promise<ResultOf<E>>;

export type Ok<T> = { ok: true; data: T };
export type Err = {
  ok: false;
  code: 'VALIDATION' | 'HANDLER';
  message: string;
  path?: (string | number)[];
};
export type Result<T> = Ok<T> | Err;
```

Bốn điểm kỹ thuật đáng dừng lại:

**`[PathParams<...>] extends [never]`** — bọc trong tuple để **tắt phân phối trên union**. Không bọc, `never extends X` cho ra `never` chứ không cho ra nhánh true (bài 05 mục 5). Đây là mẫu chuẩn để kiểm tra "kiểu này có phải `never` không".

**`infer B extends z.ZodType`** — ràng buộc ngay tại `infer` (TS 4.8+). Không có nó, `B` là `unknown` và `z.input<B>` báo lỗi.

**`BodyOf` dùng `z.input`, `Handler` dùng `z.output`** — đúng theo bài A5 mục 6. Người **gọi** truyền dữ liệu thô (`tags` có thể vắng mặt); **handler** nhận dữ liệu đã parse (`tags` chắc chắn là mảng). Cùng một schema, hai kiểu khác nhau, và đó là điều đúng đắn.

**`Result<T>` là discriminated union** — không `throw` cho lỗi nghiệp vụ, đúng nguyên tắc đã chốt ở bộ tài liệu chính.

---

## 3. Bộ điều phối

```ts
// src/server.ts
import { z } from 'zod';
import type { Endpoint } from './contract.ts';
import type { Handler, Input, Result, ResultOf } from './types.ts';

export type Contractish = { [key: string]: Endpoint };
export type Handlers<C extends Contractish> = { [K in keyof C]: Handler<C[K]> };

export function buildPath<E extends Endpoint>(ep: E, params: Record<string, string>): string {
  return ep.path.replace(/:([A-Za-z0-9_]+)/g, (_m, key: string) => {
    const v = params[key];
    if (v === undefined) throw new Error(`thiếu tham số :${key}`);
    return encodeURIComponent(v);
  });
}

export function createServer<C extends { [K in keyof C]: Endpoint }>(
  contract: C,
  handlers: Handlers<C>
) {
  return async function call<K extends keyof C>(
    name: K,
    input: Input<C[K]>
  ): Promise<Result<ResultOf<C[K]>>> {
    const ep = contract[name];
    let body: unknown = input.body;

    if (ep.body) {
      const parsed = ep.body.safeParse(input.body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return {
          ok: false,
          code: 'VALIDATION',
          message: first?.message ?? 'sai dữ liệu',
          path: first?.path as (string | number)[],
        };
      }
      body = parsed.data;
    }

    try {
      const out = await handlers[name]({ params: input.params, body } as never);
      return { ok: true, data: ep.response.parse(out) as ResultOf<C[K]> };
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { ok: false, code: 'VALIDATION', message: 'response không khớp schema' };
      }
      return { ok: false, code: 'HANDLER', message: (e as Error).message };
    }
  };
}
```

### Vì sao ràng buộc viết là `C extends { [K in keyof C]: Endpoint }` chứ không phải `Record<string, Endpoint>`

Đây là lỗi thật gặp khi viết bài này. Với `Record<string, Endpoint>` và `noUncheckedIndexedAccess: true`:

```
src/server.ts(23,9): error TS18048: 'ep' is possibly 'undefined'.
src/server.ts(24,22): error TS18048: 'ep' is possibly 'undefined'.
src/server.ts(34,32): error TS18048: 'ep' is possibly 'undefined'.
```

`Record<string, Endpoint>` có **index signature**, mà `noUncheckedIndexedAccess` bắt mọi truy cập qua index signature phải kiểm `undefined` — kể cả khi `K extends keyof C`. Ràng buộc dạng mapped type `{ [K in keyof C]: Endpoint }` diễn đạt đúng ý "mọi key của C đều trỏ tới Endpoint" mà **không** tạo index signature. Lỗi biến mất, không cần `!` nào.

### Ba chỗ ép kiểu và lý do

| Dòng | Ép kiểu | Vì sao chấp nhận được |
|---|---|---|
| `handlers[name]({...} as never)` | `as never` | Trình biên dịch không tự chứng minh được `Input<C[K]>` khớp tham số của `Handler<C[K]>` khi `K` còn là ẩn số (đúng hiện tượng ở bài A1 mục 6). Chữ ký ngoài đã đúng. |
| `ep.response.parse(out) as ResultOf<C[K]>` | `as` | `ep.response` chỉ được biết là `z.ZodType` qua ràng buộc, nên `parse` trả `unknown`. |
| `first?.path as (string \| number)[]` | `as` | Kiểu `path` của Zod rộng hơn (có cả `symbol`). |

Cả ba đều nằm **bên trong** thư viện, không có cái nào lọt ra API mà người dùng chạm tới. Đó là ranh giới đúng: `as` được phép ở nơi bạn tự chịu trách nhiệm và có test, không được phép ở nơi người dùng phải tin.

---

## 4. Chạy thử

```ts
// src/main.ts
import { contract } from './contract.ts';
import { buildPath, createServer } from './server.ts';

const posts = new Map<string, { title: string; tags: string[] }>();
let seq = 0;

const call = createServer(contract, {
  getUser: async ({ params }) => ({ id: params.userId, name: 'Sơn' }),

  createPost: async ({ params, body }) => {
    const postId = `p${++seq}`;
    posts.set(postId, { title: body!.title, tags: body!.tags });
    console.log(`  [db] user=${params.userId} lưu ${postId}: "${body!.title}" tags=${JSON.stringify(body!.tags)}`);
    return { postId, title: body!.title };
  },

  deletePost: async ({ params }) => {
    if (!posts.delete(params.postId)) throw new Error(`không tìm thấy ${params.postId}`);
    return { deleted: true as const };
  },
});

console.log('— đường dẫn sinh từ params —');
console.log(buildPath(contract.deletePost, { userId: 'u 1', postId: 'p1' }));

console.log('\n— gọi hợp lệ —');
console.log(await call('getUser', { params: { userId: 'u1' }, body: undefined }));
console.log(await call('createPost', { params: { userId: 'u1' }, body: { title: 'Bài đầu tiên' } }));

console.log('\n— body sai schema —');
console.log(await call('createPost', { params: { userId: 'u1' }, body: { title: '' } }));

console.log('\n— handler ném lỗi —');
console.log(await call('deletePost', { params: { userId: 'u1', postId: 'p999' }, body: undefined }));

console.log('\n— xoá thật —');
console.log(await call('deletePost', { params: { userId: 'u1', postId: 'p1' }, body: undefined }));
```

```bash
$ npx tsc --noEmit
$                                    ← sạch

$ node src/main.ts
```
```
— đường dẫn sinh từ params —
/users/u%201/posts/p1

— gọi hợp lệ —
{ ok: true, data: { id: 'u1', name: 'Sơn' } }
  [db] user=u1 lưu p1: "Bài đầu tiên" tags=[]
{ ok: true, data: { postId: 'p1', title: 'Bài đầu tiên' } }

— body sai schema —
{
  ok: false,
  code: 'VALIDATION',
  message: 'Too small: expected string to have >=1 characters',
  path: [ 'title' ]
}

— handler ném lỗi —
{ ok: false, code: 'HANDLER', message: 'không tìm thấy p999' }

— xoá thật —
{ ok: true, data: { deleted: true } }
```

Chú ý `tags=[]` ở dòng `[db]`: người gọi **không truyền** `tags`, nhưng handler nhận được mảng rỗng vì `.default([])` đã chạy. Đó chính là khác biệt `z.input` / `z.output` thành hiện thực.

Build ra `dist` cũng chạy:
```bash
$ npx tsc && head -2 dist/main.js
import { contract } from './contract.js';         ← .ts đã đổi thành .js
import { buildPath, createServer } from './server.js';
$ node dist/main.js
— đường dẫn sinh từ params —
/users/u%201/posts/p1
```

---

## 5. Sáu lỗi được bắt lúc biên dịch

Đây là phần trả công cho toàn bộ công sức ở trên. Viết sai kiểu gì cũng bị chặn trước khi chạy:

```ts
await call('getUser', { params: { userIdd: 'u1' }, body: undefined });
await call('getUser', { params: { userId: 'u1' }, body: { title: 'x' } });
await call('createPost', { params: { userId: 'u1' }, body: { titel: 'x' } });
await call('deletePost', { params: { userId: 'u1' }, body: undefined });
await call('getUserr', { params: { userId: 'u1' }, body: undefined });
const r = await call('getUser', { params: { userId: 'u1' }, body: undefined });
r.data;
```
```
src/check.ts(8,35): error TS2561: Object literal may only specify known properties, but 'userIdd' does not exist in type '{ userId: string; }'. Did you mean to write 'userId'?
src/check.ts(9,51): error TS2322: Type '{ title: string; }' is not assignable to type 'undefined'.
src/check.ts(10,62): error TS2561: Object literal may only specify known properties, but 'titel' does not exist in type '{ title: string; tags?: string[] | undefined; }'. Did you mean to write 'title'?
src/check.ts(11,28): error TS2741: Property 'postId' is missing in type '{ userId: string; }' but required in type '{ postId: string; userId: string; }'.
src/check.ts(12,12): error TS2345: Argument of type '"getUserr"' is not assignable to parameter of type '"createPost" | "deletePost" | "getUser"'.
src/check.ts(14,3): error TS2339: Property 'data' does not exist on type 'Result<{ id: string; name: string; }>'.
  Property 'data' does not exist on type 'Err'.
```

Đọc từng dòng để thấy chuỗi suy luận đã đi qua những đâu:

1. **Gõ sai tên param** — `userId` đến từ việc phân tích chuỗi `'/users/:userId'`. Không ai khai `userId` ở đâu cả.
2. **Truyền body cho endpoint GET** — `BodyOf` trả `undefined` vì `getUser` không có field `body`.
3. **Gõ sai field trong body** — kiểu đến từ `z.input` của schema.
4. **Thiếu param** — `deletePost` có hai `:` trong path nên bắt buộc hai key.
5. **Gõ sai tên endpoint** — liệt kê đủ tên hợp lệ.
6. **Quên kiểm tra `r.ok`** — `Result` là discriminated union nên bắt buộc phải narrow trước khi đọc `data`.

Thêm một `:tagId` vào path của `deletePost` và **không sửa gì khác**: cả `main.ts` lẫn mọi nơi gọi `deletePost` sẽ đỏ ngay. Đó là mục tiêu của cả bài.

---

## 6. Kỹ thuật đã dùng — bản đồ về các bài trước

| Kỹ thuật | Dùng ở đâu | Học ở |
|---|---|---|
| `const` type parameter | `defineContract` | A1 mục 3 |
| Ràng buộc phụ thuộc generic khác | `call<K extends keyof C>` | A2 mục 5 |
| Đệ quy trên template literal | `PathParams` | A2 mục 3 |
| Tắt phân phối bằng `[T] extends [never]` | `ParamsOf` | 05 mục 5 |
| `infer B extends ...` | `BodyOf` | A2 mục 1 |
| `z.input` khác `z.output` | `BodyOf` vs `Handler` | A5 mục 6 |
| `Result` thay `throw` | `server.ts` | 03, 09 |
| Mapped constraint tránh index signature | `createServer` | A9 mục 3 |
| Import `.ts` + rewrite khi emit | tsconfig | A5 mục 4 |

---

## 7. Mở rộng

Làm ít nhất ba việc sau để biến bài tập thành thứ dùng được:

1. **Transport HTTP thật.** Viết `createClient(contract, baseUrl)` dùng `fetch` + `buildPath`, và `mountExpress(contract, handlers, app)` phía server. Kiểu ở hai đầu lấy từ **cùng một** `contract.ts`.

2. **Middleware có kiểu.** `withAuth(handlers)` thêm `ctx.user` vào input của mọi handler, và kiểu phải phản ánh điều đó — gợi ý: thêm tham số kiểu `Ctx` vào `Handler<E, Ctx>`.

3. **Query string.** Thêm `query?: z.ZodType` vào `Endpoint`, `QueryOf<E>` tương tự `BodyOf`, và ghép vào `Input`.

---

## Bài tập

1. Thêm endpoint `updatePost` (`PUT /users/:userId/posts/:postId`, body có `title?`). Kiểm tra `params` yêu cầu đúng hai key.

2. Thêm `:tagId` vào path của `deletePost`. Chạy `tsc --noEmit` và đếm bao nhiêu chỗ đỏ. Sửa cho xanh lại.

3. Làm handler `getUser` trả về `{ id: 1, name: 'x' }` (id là số). Lỗi biên dịch là gì? Rồi ép `as any` và chạy — lỗi runtime là gì, do đâu bắt được?

4. Đổi `BodyOf` từ `z.input` sang `z.output`. Chỗ nào trong `main.ts` bắt đầu đỏ? Giải thích bằng ngôn ngữ nghiệp vụ.

5. Bỏ `const` khỏi `defineContract`. `ParamsOf<typeof contract.getUser>` giờ là gì? Vì sao?

6. Viết `createClient` trả về object có method theo đúng tên endpoint (`client.getUser({ userId })`) thay vì `call('getUser', ...)`. Gợi ý: mapped type trên `C`.

7. Thêm trường `auth?: true` vào `Endpoint`, và làm cho `Input` **bắt buộc** có `token: string` khi `auth` là `true`.

<details>
<summary>Gợi ý đáp án</summary>

**3.** Biên dịch:
```
error TS2322: Type 'Promise<{ id: number; name: string; }>' is not assignable to type 'Promise<{ id: string; name: string; }>'.
  Types of property 'id' are incompatible.
    Type 'number' is not assignable to type 'string'.
```
Sau khi `as any`, `ep.response.parse(out)` bắt được lúc chạy và trả về `{ ok: false, code: 'VALIDATION', message: 'response không khớp schema' }` — đây chính là lý do phải parse **cả response**, không chỉ request. Handler cũng là mã có bug.

**4.** Dòng `body: { title: 'Bài đầu tiên' }` sẽ đỏ vì thiếu `tags`. Nghĩa nghiệp vụ: bạn đang bắt **người gọi** phải cung cấp cả những giá trị mà máy chủ có mặc định — sai vai trò.

**5.** `Record<never, never>` — một object **không có key nào**. Không có `const`, `path` bị mở rộng thành `string`; `PathParams<string>` không khớp nhánh template literal nào nên ra `never`, và nhánh `[never] extends [never]` được chọn.

Hậu quả không im lặng mà đổ vỡ ngay:
```
src/main.ts(8,48):  error TS2339: Property 'userId' does not exist on type 'Record<never, never>'.
src/main.ts(13,39): error TS2339: Property 'userId' does not exist on type 'Record<never, never>'.
src/main.ts(18,30): error TS2339: Property 'postId' does not exist on type 'Record<never, never>'.
```
Nghĩa là **một từ khoá `const` bị quên làm sập toàn bộ chuỗi suy kiểu** — nhớ mã lỗi TS2339 kèm `Record<never, never>` như dấu hiệu nhận biết.

**6.**
```ts
export function createClient<C extends { [K in keyof C]: Endpoint }>(contract: C, call: Call<C>) {
  return Object.fromEntries(
    Object.keys(contract).map((k) => [k, (input: any) => call(k as keyof C, input)])
  ) as { [K in keyof C]: (input: Input<C[K]>) => Promise<Result<ResultOf<C[K]>>> };
}
```
`Object.fromEntries` trả `any`, nên phải chốt bằng `as` — lại là một `as` nằm trong thư viện, không lọt ra ngoài.

**7.**
```ts
export type Input<E extends Endpoint> =
  { params: ParamsOf<E>; body: BodyOf<E> } & (E extends { auth: true } ? { token: string } : {});
```

</details>

---

👉 Tiếp: [A10 — Bẫy nâng cao và checklist](./10-bay-nang-cao-va-checklist.md)
