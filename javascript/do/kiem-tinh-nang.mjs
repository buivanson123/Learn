// Kiểm tính năng trong Node. Chạy: node kiem-tinh-nang.mjs
const ok = (n, f) => {
  try { const r = f(); console.log((r === undefined ? '✅' : '✅ ' + JSON.stringify(r)).padEnd(32), n); }
  catch (e) { console.log(('❌ ' + e.constructor.name).padEnd(32), n, '—', e.message.slice(0, 60)); }
};
// API — dò được bằng typeof
ok('Object.groupBy',        () => Object.groupBy([1, 2, 3, 4], x => x % 2 ? 'le' : 'chan'));
ok('Array.prototype.toSorted', () => [3, 1, 2].toSorted());
ok('Array.fromAsync',       () => typeof Array.fromAsync);
ok('structuredClone',       () => structuredClone({ m: new Map([[1, 2]]) }).m.get(1));
ok('Promise.withResolvers', () => Object.keys(Promise.withResolvers()));
ok('Iterator helpers',      () => [...[1, 2, 3].values().map(x => x * 2)]);
ok('Set.union',             () => [...new Set([1, 2]).union(new Set([3]))]);
ok('AbortSignal.timeout',   () => typeof AbortSignal.timeout);
ok('Temporal',              () => typeof Temporal);
ok('Promise.try',           () => typeof Promise.try);
ok('RegExp.escape',         () => typeof RegExp.escape);
ok('Uint8Array.fromBase64', () => typeof Uint8Array.fromBase64);
ok('Error.isError',         () => typeof Error.isError);
ok('Float16Array',          () => typeof Float16Array);
ok('Atomics.pause',         () => typeof Atomics.pause);
ok('scheduler.yield',       () => typeof globalThis.scheduler?.yield);
ok('Symbol.dispose (chỉ symbol!)', () => typeof Symbol.dispose);

// ⚠ Cú pháp — KHÔNG dò được bằng typeof, phải compile thử
console.log('\n--- tính năng CÚ PHÁP (phải compile thử, typeof vô dụng) ---');
const coCuPhap = src => { try { new Function(src); return true } catch { return false } };
for (const [ten, src] of [
  ['using',      '{ using r = { [Symbol.dispose](){} }; }'],
  ['await using', 'async function f(){ await using r = { [Symbol.asyncDispose](){} }; }'],
  ['decorator',  'class C { @x m(){} }'],
]) console.log((coCuPhap(src) ? '✅' : '❌ SyntaxError').padEnd(32), ten);
