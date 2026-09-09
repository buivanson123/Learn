const { chromium } = require('playwright');

// Mỗi case: { name, html, fn }  — fn chạy trong trang, trả về object/giá trị để in
async function run(cases, opts = {}) {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: opts.viewport || { width: 800, height: 600 } });
  for (const c of cases) {
    await p.setContent(`<!doctype html><html><head><meta charset=utf-8>${c.head || ''}</head><body>${c.html}</body></html>`);
    if (c.wait) await p.waitForTimeout(c.wait);
    let out;
    try { out = await p.evaluate(c.fn); } catch (e) { out = 'ERROR: ' + e.message; }
    console.log('\n### ' + c.name);
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  }
  await b.close();
}
module.exports = { run };
