// Chạy: node do-do-tre.mjs
import { Worker } from 'node:worker_threads';
import { theoDoiDoTre } from './bench.mjs';

const nang = n => { let s = 0; for (let i = 0; i < n; i++) s += Math.sqrt(i); return s; };
const codeWorker = `import {parentPort, workerData} from 'node:worker_threads';
  let s = 0; for (let i = 0; i < workerData; i++) s += Math.sqrt(i); parentPort.postMessage(s);`;
const N = 2e8;

let dung = theoDoiDoTre();
nang(N);
console.log('Độ trễ event loop khi chạy sync trên main thread:', await dung(), 'ms');

dung = theoDoiDoTre();
await new Promise(r => { const w = new Worker(codeWorker, { eval: true, workerData: N }); w.on('message', r); });
console.log('Độ trễ event loop khi đẩy sang worker_threads   :', await dung(), 'ms');

dung = theoDoiDoTre();
for (let i = 0; i < 10; i++) { nang(N / 10); await new Promise(r => setImmediate(r)); }
console.log('Độ trễ khi chia nhỏ + setImmediate giữa các lát  :', await dung(), 'ms');
