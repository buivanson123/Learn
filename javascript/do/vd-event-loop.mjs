// Chạy: node vd-event-loop.mjs
const log = [];
log.push('1 đồng bộ — đầu file');
setTimeout(() => log.push('T1 setTimeout 0'), 0);
setImmediate(() => log.push('I1 setImmediate'));
Promise.resolve().then(() => log.push('P1 .then'));
queueMicrotask(() => log.push('Q1 queueMicrotask'));
process.nextTick(() => log.push('N1 process.nextTick'));
(async () => { log.push('2 phần đồng bộ của async fn'); await null; log.push('P2 sau await'); })();
log.push('3 đồng bộ — cuối file');
setTimeout(() => console.log(log.join('\n')), 10);
