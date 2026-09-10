// Khung đo trong Chrome thật. Dựng sẵn server HTTP để fetch tương đối chạy được.
const { chromium } = require('playwright');
const http = require('http');

async function chay(fn, { html = '<div id=root></div>', routes = {} } = {}) {
  const srv = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/') { res.setHeader('content-type', 'text/html'); return res.end('<!doctype html>' + html); }
    if (routes[url]) return routes[url](req, res);
    res.statusCode = 404; res.end('khong thay');
  });
  await new Promise(r => srv.listen(0, r));
  const cong = srv.address().port;

  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage();
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('HeapProfiler.enable');
  await p.goto(`http://localhost:${cong}/`);

  const heapMB = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { usedSize } = await cdp.send('Runtime.getHeapUsage');
    return usedSize / 1048576;
  };
  const demNodeDOM = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    return cdp.send('Memory.getDOMCounters');
  };

  try { await fn({ page: p, cdp, heapMB, demNodeDOM }); }
  finally { await b.close(); srv.close(); }
}

module.exports = { chay };
