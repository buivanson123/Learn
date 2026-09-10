// Đo bộ nhớ: Map giữ khoá mạnh, WeakMap thì không.
// Chạy: node --expose-gc do-bo-nho.mjs
const mb = () => (process.memoryUsage().heapUsed / 1048576).toFixed(1);

function nap(Container) {
  const c = new Container();
  const khoa = [];                      // giữ khoá lại để Map không mất tham chiếu
  for (let i = 0; i < 200000; i++) {
    const k = { i };
    if (Container === Map) khoa.push(k);
    c.set(k, new Array(50).fill(i));
  }
  return { c, khoa };
}

global.gc();                 console.log('bắt đầu       :', mb(), 'MB');
let r1 = nap(Map);
global.gc();                 console.log('Map 200k      :', mb(), 'MB  size =', r1.c.size);
r1.khoa = null;
global.gc();                 console.log('bỏ mảng khoá  :', mb(), 'MB  size =', r1.c.size, ' <- vẫn còn');
r1 = null;
global.gc();                 console.log('bỏ cả Map     :', mb(), 'MB');

let r2 = nap(WeakMap);
global.gc(); global.gc();    console.log('WeakMap 200k  :', mb(), 'MB  <- khoá không ai giữ nên bị thu hồi');
console.log('r2 còn sống:', !!r2);
