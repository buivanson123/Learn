// ============================================================
// Tầng 3 — Router
// Dùng Navigation API nếu có (Chrome 152 có — xem bài 10), ngược lại
// quay về History API. Trạng thái route là một signal, nên mọi effect
// đọc nó tự chạy lại khi điều hướng.
// ============================================================
import { signal } from './reactive.js';

export function taoRouter(routes) {
  const duongDan = signal(location.pathname);
  const ac = new AbortController();

  const khop = (path) => {
    for (const [mau, view] of Object.entries(routes)) {
      const ten = [];
      const re = new RegExp('^' + mau.replace(/:(\w+)/g, (_, k) => { ten.push(k); return '([^/]+)' }) + '$');
      const m = path.match(re);
      if (m) return { view, params: Object.fromEntries(ten.map((k, i) => [k, m[i + 1]])) };
    }
    return { view: routes['*'] ?? (() => 'Không tìm thấy'), params: {} };
  };

  if (globalThis.navigation) {
    // Navigation API: bắt cả click vào <a> và nút back, không cần nghe 'click' thủ công
    navigation.addEventListener('navigate', (e) => {
      if (!e.canIntercept || e.hashChange || e.downloadRequest !== null) return;
      const url = new URL(e.destination.url);
      if (url.origin !== location.origin) return;
      e.intercept({ handler: async () => { duongDan.value = url.pathname } });
    }, { signal: ac.signal });
  } else {
    addEventListener('popstate', () => { duongDan.value = location.pathname }, { signal: ac.signal });
    addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="/"]');       // delegation, xem bài 11 mục 3
      if (!a || a.target || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      history.pushState({}, '', a.href);
      duongDan.value = new URL(a.href).pathname;
    }, { signal: ac.signal });
  }

  return {
    duongDan,
    view: () => { const { view, params } = khop(duongDan.value); return view(params) },
    di: (path) => {
      if (globalThis.navigation) navigation.navigate(path);
      else { history.pushState({}, '', path); duongDan.value = path }
    },
    dung: () => ac.abort(),
  };
}
