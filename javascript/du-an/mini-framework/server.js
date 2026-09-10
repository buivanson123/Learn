// Server tĩnh tối thiểu, trả index.html cho mọi route (để router hoạt động).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const KIEU = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

http.createServer(async (req, res) => {
  const p = req.url.split('?')[0];
  const file = path.join(import.meta.dirname, p);
  try {
    if (path.extname(p) && fs.existsSync(file)) {
      res.setHeader('content-type', KIEU[path.extname(p)] ?? 'application/octet-stream');
      return res.end(await fs.promises.readFile(file));
    }
  } catch {}
  res.setHeader('content-type', 'text/html');
  res.end(await fs.promises.readFile(path.join(import.meta.dirname, 'index.html')));
}).listen(5173, () => console.log('http://localhost:5173'));
