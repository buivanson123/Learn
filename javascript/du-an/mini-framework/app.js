// Ứng dụng demo: danh sách việc cần làm + router. Không thư viện nào.
import { signal, computed, effect, h, mount, taoRouter } from './src/index.js';

const viec = signal([
  { id: 1, ten: 'Đọc bài 15', xong: true },
  { id: 2, ten: 'Tự viết signal()', xong: false },
  { id: 3, ten: 'Hiểu keyed diff', xong: false },
]);
const loc = signal('tat-ca');
let nextId = 4;

const hienThi = computed(() => {
  const ds = viec.value;
  if (loc.value === 'xong') return ds.filter(v => v.xong);
  if (loc.value === 'chua') return ds.filter(v => !v.xong);
  return ds;
});
const soChua = computed(() => viec.value.filter(v => !v.xong).length);

const doiXong = (id) =>
  viec.value = viec.value.map(v => v.id === id ? { ...v, xong: !v.xong } : v);
const xoa = (id) => viec.value = viec.value.filter(v => v.id !== id);
const them = (ten) => { if (ten.trim()) viec.value = [...viec.value, { id: nextId++, ten, xong: false }] };
const daoThuTu = () => viec.value = viec.value.toReversed();     // bài 10 mục 5

function TrangViec() {
  return h('div', { class: 'trang' },
    h('h1', {}, `Việc cần làm (${soChua.value} chưa xong)`),
    h('form', { onSubmit: (e) => { e.preventDefault(); them(e.target.moi.value); e.target.reset() } },
      h('input', { name: 'moi', placeholder: 'Thêm việc…', autofocus: true }),
      h('button', {}, 'Thêm'),
    ),
    h('div', { class: 'loc' },
      ...['tat-ca', 'chua', 'xong'].map(k =>
        h('button', { onClick: () => loc.value = k, 'aria-pressed': loc.value === k }, k)),
      h('button', { onClick: daoThuTu }, 'Đảo thứ tự'),
    ),
    h('ul', {}, ...hienThi.value.map(v =>
      h('li', { key: v.id, class: v.xong ? 'xong' : '' },       // ⚠ key: giữ được DOM khi đảo
        h('input', { type: 'checkbox', checked: v.xong, onChange: () => doiXong(v.id) }),
        h('span', {}, v.ten),
        h('a', { href: `/viec/${v.id}` }, ' chi tiết'),
        h('button', { onClick: () => xoa(v.id) }, '×'),
      ))),
    h('p', {}, h('a', { href: '/ve' }, 'Về trang này')),
  );
}

function TrangChiTiet({ id }) {
  const v = viec.value.find(x => x.id === Number(id));
  return h('div', { class: 'trang' },
    h('h1', {}, v ? v.ten : 'Không có việc này'),
    h('p', {}, v ? (v.xong ? 'Đã xong' : 'Chưa xong') : ''),
    h('a', { href: '/' }, '← Quay lại'),
  );
}

const router = taoRouter({
  '/': TrangViec,
  '/viec/:id': TrangChiTiet,
  '/ve': () => h('div', { class: 'trang' }, h('h1', {}, 'Mini-framework'),
    h('p', {}, 'signal + effect + keyed diff + router, viết tay, 0 thư viện.'),
    h('a', { href: '/' }, '← Quay lại')),
});

mount(() => router.view(), document.getElementById('app'));

// Bằng chứng gom cập nhật: 3 lần ghi -> 1 lần render
effect(() => { document.title = `${soChua.value} việc chưa xong` });
