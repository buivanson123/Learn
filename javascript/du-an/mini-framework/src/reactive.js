// ============================================================
// Tầng 1 — Reactivity: signal, computed, effect
// Cơ chế: mỗi effect đang chạy được đẩy vào một NGĂN XẾP toàn cục.
// Khi signal được ĐỌC, nó ghi lại effect ở đỉnh ngăn xếp làm "người
// theo dõi". Khi signal bị GHI, nó đánh thức mọi người theo dõi.
// Đó là toàn bộ ý tưởng — 3 dòng dưới đây là trái tim của Vue/Solid.
// ============================================================

/** Ngăn xếp effect đang chạy. Dùng ngăn xếp (không phải một biến) vì effect lồng nhau được. */
const nganXep = [];

/** Hàng đợi effect chờ chạy lại, gom vào 1 microtask. */
const choChay = new Set();
let daHenLich = false;

function henLich(fn) {
  choChay.add(fn);
  if (daHenLich) return;
  daHenLich = true;
  // queueMicrotask: gom mọi thay đổi trong cùng một lượt đồng bộ thành MỘT lần chạy lại.
  // Đây chính là `nextTick` của Vue. Xem bài 06 mục 1.
  queueMicrotask(() => {
    daHenLich = false;
    const dot = [...choChay];
    choChay.clear();
    for (const fn of dot) fn();
  });
}

export function signal(giaTriDau) {
  let giaTri = giaTriDau;
  /** Những effect đang phụ thuộc vào signal này. Set để không đăng ký trùng. */
  const nguoiTheoDoi = new Set();

  return {
    get value() {
      const hienTai = nganXep[nganXep.length - 1];
      if (hienTai) {
        nguoiTheoDoi.add(hienTai);
        hienTai.phuThuoc.add(nguoiTheoDoi);   // để effect tự dọn được khi bị huỷ
      }
      return giaTri;
    },
    set value(v) {
      if (Object.is(v, giaTri)) return;       // Object.is: xem bài 03 mục 2 (NaN, -0)
      giaTri = v;
      // Chép ra mảng trước khi lặp: effect có thể tự huỷ trong lúc chạy.
      for (const e of [...nguoiTheoDoi]) henLich(e);
    },
    /** Đọc mà KHÔNG đăng ký phụ thuộc — cần khi ghi log hoặc so sánh. */
    peek() { return giaTri },
  };
}

export function effect(fn) {
  const chay = () => {
    if (chay.daHuy) return;
    donPhuThuoc(chay);      // ⚠ dọn phụ thuộc CŨ trước mỗi lần chạy: nhánh if có thể đổi
    nganXep.push(chay);
    try { fn() }
    finally { nganXep.pop() }   // finally: fn ném lỗi thì ngăn xếp vẫn phải sạch
  };
  chay.phuThuoc = new Set();
  chay.daHuy = false;
  chay();
  return () => { chay.daHuy = true; donPhuThuoc(chay) };   // hàm dừng
}

function donPhuThuoc(chay) {
  for (const nguoiTheoDoi of chay.phuThuoc) nguoiTheoDoi.delete(chay);
  chay.phuThuoc.clear();
}

export function computed(fn) {
  const s = signal(undefined);
  let daTinh = false;
  effect(() => { s.value = fn(); daTinh = true });
  return {
    get value() {
      if (!daTinh) throw new Error('computed chưa tính xong');
      return s.value;
    },
    peek() { return s.peek() },
  };
}

/** Chạy một đoạn code mà không đăng ký phụ thuộc nào. */
export function khongTheoDoi(fn) {
  nganXep.push(null);
  try { return fn() } finally { nganXep.pop() }
}
