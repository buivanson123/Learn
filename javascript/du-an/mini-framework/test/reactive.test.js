// Test tầng reactivity — chạy được bằng Node thuần, không cần trình duyệt.
// Chạy: node test/reactive.test.js
import { signal, computed, effect, khongTheoDoi } from '../src/reactive.js';
import assert from 'node:assert/strict';

let so = 0, hong = 0;
const test = async (ten, fn) => {
  so++;
  try { await fn(); console.log('  ✅', ten) }
  catch (e) { hong++; console.log('  ❌', ten, '\n     ', e.message) }
};
const nhip = () => new Promise(r => setTimeout(r, 0));   // đợi qua cả microtask

console.log('reactive.js');

await test('effect chạy ngay một lần', () => {
  let n = 0;
  effect(() => n++);
  assert.equal(n, 1);
});

await test('nhiều lần ghi trong cùng lượt đồng bộ -> MỘT lần chạy lại', async () => {
  const a = signal(0);
  let n = 0;
  effect(() => { a.value; n++ });
  a.value = 1; a.value = 2; a.value = 3;
  await nhip();
  assert.equal(n, 2, 'phải là 1 lần đầu + 1 lần gom');
});

await test('ghi lại cùng giá trị -> không chạy lại', async () => {
  const a = signal(5);
  let n = 0;
  effect(() => { a.value; n++ });
  a.value = 5;
  await nhip();
  assert.equal(n, 1);
});

await test('Object.is: NaN không kích hoạt chạy lại, -0 thì có', async () => {
  const a = signal(NaN);
  let n = 0;
  effect(() => { a.value; n++ });
  a.value = NaN;  await nhip();
  assert.equal(n, 1, 'NaN -> NaN không đổi');
  const b = signal(0);
  let m = 0;
  effect(() => { b.value; m++ });
  b.value = -0;  await nhip();
  assert.equal(m, 2, '0 -> -0 LÀ thay đổi theo Object.is');
});

await test('phụ thuộc theo nhánh: đổi biến ở nhánh không chạy -> không chạy lại', async () => {
  const co = signal(true), x = signal('X'), y = signal('Y');
  const log = [];
  effect(() => log.push(co.value ? x.value : y.value));
  y.value = 'Y2'; await nhip();
  assert.equal(log.length, 1, 'y không được đọc nên không phải phụ thuộc');
  x.value = 'X2'; await nhip();
  assert.deepEqual(log, ['X', 'X2']);
  co.value = false; await nhip();
  assert.deepEqual(log, ['X', 'X2', 'Y2']);
  x.value = 'X3'; await nhip();
  assert.equal(log.length, 3, 'giờ x KHÔNG còn là phụ thuộc nữa');
});

await test('hàm dừng gỡ hết phụ thuộc', async () => {
  const a = signal(0);
  let n = 0;
  const dung = effect(() => { a.value; n++ });
  dung();
  a.value = 1; await nhip();
  assert.equal(n, 1);
});

await test('computed cập nhật theo nguồn', async () => {
  const a = signal(2);
  const doi = computed(() => a.value * 2);
  assert.equal(doi.value, 4);
  a.value = 5; await nhip();
  assert.equal(doi.value, 10);
});

await test('effect lồng nhau không làm lẫn phụ thuộc', async () => {
  const a = signal(1), b = signal(1);
  const ngoai = [], trong = [];
  effect(() => {
    ngoai.push(a.value);
    effect(() => trong.push(b.value));
  });
  b.value = 2; await nhip();
  assert.equal(ngoai.length, 1, 'đổi b không được làm effect NGOÀI chạy lại');
});

await test('khongTheoDoi không đăng ký phụ thuộc', async () => {
  const a = signal(1);
  let n = 0;
  effect(() => { khongTheoDoi(() => a.value); n++ });
  a.value = 2; await nhip();
  assert.equal(n, 1);
});

await test('effect ném lỗi vẫn để ngăn xếp sạch', async () => {
  const a = signal(1);
  try { effect(() => { throw new Error('nổ') }) } catch {}
  let n = 0;
  effect(() => { a.value; n++ });
  a.value = 2; await nhip();
  assert.equal(n, 2, 'effect sau vẫn theo dõi được -> ngăn xếp không bị rác');
});

console.log(`\n${so - hong}/${so} test đạt`);
process.exit(hong ? 1 : 0);
