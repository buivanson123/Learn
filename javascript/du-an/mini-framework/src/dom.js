// ============================================================
// Tầng 2 — Render DOM
// h() tạo mô tả (vnode). patch() so mô tả cũ với mới và sửa DOM
// tối thiểu. Chỗ khó duy nhất là diff danh sách có `key`.
// ============================================================
import { effect } from './reactive.js';

export function h(loai, props = {}, ...con) {
  return { loai, props, con: con.flat().filter(c => c != null && c !== false) };
}

/** Gắn cây vnode vào một element thật. Trả về hàm dọn dẹp. */
export function mount(vnodeFn, host) {
  let cu = null;
  const ac = new AbortController();          // xem bài 08 mục 5: gỡ mọi listener bằng 1 lệnh
  const dung = effect(() => {
    const moi = vnodeFn();
    patch(host, cu, moi, 0, ac.signal);
    cu = moi;
  });
  return () => { dung(); ac.abort(); host.replaceChildren() };
}

function taoNode(v, signal) {
  if (typeof v === 'string' || typeof v === 'number') return document.createTextNode(String(v));
  const el = document.createElement(v.loai);
  ganProps(el, {}, v.props, signal);
  for (const c of v.con) el.append(taoNode(c, signal));
  v._el = el;
  return el;
}

// ⚠ Handler mới được tạo MỖI lần render (`onClick: () => xoa(v.id)` là hàm mới mỗi lượt).
// Nếu cứ addEventListener theo handler mới, listener cộng dồn sau mỗi render — xem
// mục 5 của bài 15 để biết bug này biểu hiện thế nào.
// Cách sửa: gắn MỘT dispatcher ổn định cho mỗi (element, sự kiện), và để nó tra
// handler hiện tại trong WeakMap. Render lại chỉ thay giá trị trong map.
const handlerCuaEl = new WeakMap();   // el -> { click: fn, change: fn, ... }

function datHandler(el, tenSuKien, fn, signal) {
  let bang = handlerCuaEl.get(el);
  if (!bang) {
    bang = {};
    handlerCuaEl.set(el, bang);
  }
  const laMoi = !(tenSuKien in bang);
  bang[tenSuKien] = fn;
  if (laMoi) {
    // Dispatcher gắn đúng MỘT lần cho mỗi loại sự kiện trên element này.
    el.addEventListener(tenSuKien, (e) => handlerCuaEl.get(el)?.[tenSuKien]?.(e), { signal });
  }
}

function ganProps(el, cu, moi, signal) {
  for (const k in cu) if (!(k in moi)) {
    if (k.startsWith('on')) datHandler(el, k.slice(2).toLowerCase(), null, signal);
    else el.removeAttribute(k);
  }
  for (const k in moi) {
    const v = moi[k];
    if (k.startsWith('on')) { datHandler(el, k.slice(2).toLowerCase(), v, signal); continue }
    if (cu[k] === v) continue;
    if (k === 'value' || k === 'checked') {
      el[k] = v;                             // thuộc tính DOM, không phải attribute
    } else if (v === false || v == null) {
      el.removeAttribute(k);
    } else {
      el.setAttribute(k, v === true ? '' : v);
    }
  }
}

function patch(cha, cu, moi, chiSo, signal) {
  const nodeCu = cha.childNodes[chiSo];

  if (cu == null) { cha.append(taoNode(moi, signal)); return }
  if (moi == null) { nodeCu?.remove(); return }

  const laText = (v) => typeof v === 'string' || typeof v === 'number';
  if (laText(cu) || laText(moi)) {
    if (cu !== moi) nodeCu.replaceWith(taoNode(moi, signal));
    return;
  }
  if (cu.loai !== moi.loai) { nodeCu.replaceWith(taoNode(moi, signal)); return }

  moi._el = nodeCu;
  ganProps(nodeCu, cu.props, moi.props, signal);
  patchCon(nodeCu, cu.con, moi.con, signal);
}

function patchCon(cha, conCu, conMoi, signal) {
  const coKey = conMoi.length && conMoi[0]?.props?.key != null;

  if (!coKey) {
    // Không key: so theo vị trí. Đủ dùng cho danh sách không đổi thứ tự.
    const n = Math.max(conCu.length, conMoi.length);
    for (let i = n - 1; i >= 0; i--) patch(cha, conCu[i], conMoi[i], i, signal);
    return;
  }

  // Có key: di chuyển node cũ thay vì tạo lại. Đây là thứ giữ được
  // focus của <input> và trạng thái của <video> khi danh sách đổi thứ tự.
  const mapCu = new Map(conCu.map((v, i) => [v.props.key, { v, el: cha.childNodes[i] }]));
  const daDung = new Set();
  let moc = null;                              // node đứng sau vị trí đang chèn

  for (let i = conMoi.length - 1; i >= 0; i--) {
    const vMoi = conMoi[i];
    const cuCungKey = mapCu.get(vMoi.props.key);
    let el;
    if (cuCungKey && cuCungKey.v.loai === vMoi.loai) {
      el = cuCungKey.el;
      daDung.add(vMoi.props.key);
      ganProps(el, cuCungKey.v.props, vMoi.props, signal);
      patchCon(el, cuCungKey.v.con, vMoi.con, signal);
    } else {
      el = taoNode(vMoi, signal);
    }
    vMoi._el = el;
    if (el.nextSibling !== moc || el.parentNode !== cha) cha.insertBefore(el, moc);
    moc = el;
  }

  for (const [key, { el }] of mapCu) if (!daDung.has(key)) el.remove();
}
