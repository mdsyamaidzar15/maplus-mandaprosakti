// Pemanggil API Apps Script + helper bersama untuk semua halaman.
(() => {
  const cfg = window.APP_CONFIG || {};

  // Semua key respons disamakan: ID_PENGUJI, idPenguji, id_penguji -> "idpenguji".
  const key = k => String(k).toLowerCase().replace(/_/g, '');
  const norm = v =>
    Array.isArray(v) ? v.map(norm)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [key(k), norm(x)]))
      : v;

  // POST text/plain = "simple request": tanpa preflight CORS (Vercel -> Apps Script).
  async function api(action, params = {}, timeoutMs = 30000) {
    if (!cfg.API_URL || cfg.API_URL.startsWith('GANTI')) {
      throw new Error('API_URL belum diisi. Isi di assets/js/config.js, lalu muat ulang halaman.');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(cfg.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...params }),
        signal: ctrl.signal,
        redirect: 'follow'
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Permintaan tidak dapat diproses. Coba lagi.');
      return norm(json.data);
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Server terlalu lama merespons. Coba lagi sebentar lagi.');
      if (e instanceof SyntaxError) throw new Error('Respons server tidak terbaca. Pastikan Web App Apps Script di-deploy dengan akses "Anyone", lalu coba lagi.');
      if (e instanceof TypeError) throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet, lalu coba lagi.');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const todayJakarta = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: cfg.TIMEZONE || 'Asia/Jakarta' });

  function fmtTgl(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
    if (!m) return v ?? '';
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
      .toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  const JENIS = { PROPOSAL: 'Seminar Proposal', SIDANG_AKHIR: 'Sidang Akhir' };

  /* ---- Ikon: Lucide (garis, 2px) sebagai SVG inline, tanpa paket ---- */
  const ICONS = {
    circle: '<circle cx="12" cy="12" r="10"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    presentation: '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'list-filter': '<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>'
  };
  const icon = (n, s = 16) =>
    `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[n] || ''}</svg>`;

  const chip = (cls, ic, label) => `<span class="badge ${cls}">${icon(ic, 14)} ${esc(label)}</span>`;

  const STATUS = {
    'BELUM DIMULAI': ['idle', 'circle', 'Belum dimulai'],
    'PROSES PENILAIAN': ['proc', 'clock', 'Proses penilaian'],
    'SELESAI': ['ok', 'circle-check', 'Selesai'],
    'BELUM ADA PENGUJI': ['bad', 'triangle-alert', 'Belum ada penguji']
  };
  const badge = status => {
    const s = STATUS[String(status || '').toUpperCase()] || ['idle', 'circle', String(status || '-')];
    return chip(s[0], s[1], s[2]);
  };

  // Hanya terima tautan Google Drive/Docs bertipe https (mencegah javascript: dsb.).
  function safeUrl(u) {
    try {
      const x = new URL(String(u || '').trim());
      return x.protocol === 'https:' && /^(drive|docs)\.google\.com$/.test(x.hostname) ? x.href : '';
    } catch { return ''; }
  }

  const skeleton = (n = 5) => `<div class="skel" role="status"><span class="sr">Memuat data</span>${'<i></i>'.repeat(n)}</div>`;

  const emptyState = (title, text, label, act) =>
    `<div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p><button class="btn" type="button" data-act="${esc(act)}">${esc(label)}</button></div>`;

  // Paginasi sisi klien (selalu tampil, tombol nonaktif tetap berlabel).
  const paginate = (rows, page, size = 25) => {
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const p = Math.min(Math.max(1, page), pages);
    return { items: rows.slice((p - 1) * size, p * size), page: p, pages, total: rows.length };
  };
  const pagerHtml = g => `
    <nav class="pager" aria-label="Halaman tabel">
      <span class="muted">Halaman ${g.page} dari ${g.pages} · ${g.total} data</span>
      <span style="display:flex;gap:8px">
        <button class="btn secondary" type="button" data-pg="-1" ${g.page <= 1 ? 'aria-disabled="true"' : ''}>Sebelumnya</button>
        <button class="btn secondary" type="button" data-pg="1" ${g.page >= g.pages ? 'aria-disabled="true"' : ''}>Berikutnya</button>
      </span>
    </nav>`;

  function toast(msg, type = 'ok') {
    let box = document.getElementById('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), type === 'err' ? 7000 : 3500);
  }

  window.App = { api, esc, key, todayJakarta, fmtTgl, JENIS, icon, chip, badge, safeUrl, skeleton, emptyState, paginate, pagerHtml, toast };
})();
