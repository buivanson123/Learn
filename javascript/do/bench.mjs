// Đo thời gian cho đúng: làm nóng rồi lấy trung vị.
export function bench(ten, f, iter = 25) {
  for (let i = 0; i < 5; i++) f();          // làm nóng để V8 kịp JIT
  const ts = [];
  for (let i = 0; i < iter; i++) {
    const t = process.hrtime.bigint();
    f();
    ts.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  ts.sort((a, b) => a - b);
  console.log('  ' + ten.padEnd(46) + ts[Math.floor(iter / 2)].toFixed(2) + 'ms');
}

// Đo độ trễ event loop: đặt hẹn giờ 10ms, xem nó bị trễ bao nhiêu.
export function theoDoiDoTre() {
  let max = 0, last = Date.now();
  const iv = setInterval(() => {
    const d = Date.now() - last - 10;
    if (d > max) max = d;
    last = Date.now();
  }, 10);
  return async () => {
    await new Promise(r => setTimeout(r, 60)); // chờ nhịp đầu tiên sau khi hết nghẽn
    clearInterval(iv);
    return max;
  };
}

export const heapMB = () => (process.memoryUsage().heapUsed / 1048576).toFixed(2);
