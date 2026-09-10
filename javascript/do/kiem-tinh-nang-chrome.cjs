// Kiểm y hệt các mục trên nhưng trong Chrome 152. Chạy: node kiem-tinh-nang-chrome.cjs
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage();
  const r = await p.evaluate(() => {
    const ra = [];
    const ok = (n, f) => { try { const v = f(); ra.push([n, '✅ ' + (v === undefined ? '' : JSON.stringify(v))]) } catch (e) { ra.push([n, '❌ ' + e.constructor.name]) } };
    ok('Temporal', () => typeof Temporal);
    ok('Promise.try', () => typeof Promise.try);
    ok('RegExp.escape', () => typeof RegExp.escape);
    ok('Uint8Array.fromBase64', () => typeof Uint8Array.fromBase64);
    ok('Error.isError', () => typeof Error.isError);
    ok('Float16Array', () => typeof Float16Array);
    ok('scheduler.yield', () => typeof scheduler?.yield);
    ok('Iterator helpers', () => [...[1, 2, 3].values().map(x => x * 2)]);
    ok('Popover API', () => HTMLElement.prototype.hasOwnProperty('popover'));
    ok('View Transition', () => typeof document.startViewTransition);
    ok('URLPattern', () => typeof URLPattern);
    ok('Navigation API', () => typeof navigation);
    const coCuPhap = s => { try { new Function(s); return true } catch { return false } };
    ra.push(['[cú pháp] using', coCuPhap('{ using r = { [Symbol.dispose](){} }; }') ? '✅' : '❌ SyntaxError']);
    ra.push(['[cú pháp] decorator', coCuPhap('class C { @x m(){} }') ? '✅' : '❌ SyntaxError']);
    return { ua: navigator.userAgent, ra };
  });
  console.log(r.ua.match(/Chrome\/[\d.]+|HeadlessChrome\/[\d.]+/)?.[0], '\n');
  for (const [n, v] of r.ra) console.log(v.padEnd(30), n);
  await b.close();
})();
