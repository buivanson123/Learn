# Chỗ đo

Harness dùng cho mọi phép đo trong giáo trình. Xem [bài 00](../00-moi-truong-va-devtools.md).

## Dựng

```bash
$ cd css/do
$ npm init -y
$ npm i playwright
```

⚠️ **Đừng chạy `npx playwright install`** — máy đã có Chrome 152, harness dùng luôn bằng
`channel: 'chrome'`. Thiếu cờ đó sẽ báo:

```
browserType.launch: Executable doesn't exist at .../chrome-headless-shell
```

## Dùng

```js
// do.js
const { run } = require('./harness');

run([{
  name: 'id có thắng được 20 class không?',
  head: `<style>
    #id { color: rgb(0,0,255) }
    .c.c.c.c.c.c.c.c.c.c.c.c.c.c.c.c.c.c.c.c { color: rgb(0,255,0) }
  </style>`,
  html: `<p id="id" class="c">x</p>`,
  fn: () => getComputedStyle(document.querySelector('p')).color,
}]);
```

```
$ node do.js

### id có thắng được 20 class không?
rgb(0, 0, 255)
```

## Nhớ

`fn` chạy **bên trong trang**, không thấy biến khai ở Node:

```
ERROR: page.evaluate: ReferenceError: R is not defined
```

Cần hàm phụ thì nhét vào cùng chuỗi:

```js
const RR = `const R = id => { const r = document.getElementById(id).getBoundingClientRect();
  return { w: +r.width.toFixed(2), h: +r.height.toFixed(2) }; };`;

fn: new Function(RR + `return ({ a: R('a') })`)
```

## Đổi viewport

```js
run([...], { viewport: { width: 320, height: 800 } });
```

Cần nhiều viewport trong một lần chạy thì viết script riêng với `page.setViewportSize()` —
xem ví dụ ở [bài 07](../07-responsive-va-container-query.md).
