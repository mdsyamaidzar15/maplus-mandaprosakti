// Pemanggil API Apps Script + helper bersama untuk semua halaman.
(() => {
  const cfg = window.APP_CONFIG || {};

  // Semua key respons disamakan: ID_PENGUJI, idPenguji, id_penguji -> "idpenguji".
  // Frontend selalu membaca key huruf kecil tanpa garis bawah, jadi tahan terhadap
  // perbedaan gaya penamaan di Code.gs.
  const key = k => String(k).toLowerCase().replace(/_/g, '');
  const norm = v =>
    Array.isArray(v) ? v.map(norm)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [key(k), norm(x)]))
      : v;

  // POST dengan Content-Type text/plain = "simple request": tidak ada preflight CORS,
  // sehingga bisa dipanggil dari domain Vercel ke Apps Script.
  async function api(action, params = {}, timeoutMs = 30000) {
    if (!cfg.API_URL || cfg.API_URL.startsWith('GANTI')) {
      throw new Error('API_URL belum diisi di assets/js/config.js');
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
      if (!json.success) throw new Error(json.message || 'Permintaan tidak dapat diproses');
      return norm(json.data);
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Server terlalu lama merespons. Coba lagi.');
      if (e instanceof SyntaxError) throw new Error('Respons server tidak valid. Pastikan Web App Apps Script di-deploy dengan akses "Anyone".');
      if (e instanceof TypeError) throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet dan URL API.');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const todayJakarta = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: cfg.TIMEZONE || 'Asia/Jakarta' }); // YYYY-MM-DD

  // "2026-11-23" atau "2026-11-23T00:00:00.000Z" -> "23 Nov 2026"
  function fmtTgl(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
    if (!m) return v ?? '';
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
      .toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  const JENIS = { PROPOSAL: 'Seminar Proposal', SIDANG_AKHIR: 'Sidang Akhir' };

  // Status dihitung backend; ikon ditambahkan agar tidak hanya bergantung pada warna.
  const STATUS = {
    'BELUM DIMULAI': { cls: 'idle', icon: '○' },
    'PROSES PENILAIAN': { cls: 'proc', icon: '◐' },
    'SELESAI': { cls: 'ok', icon: '●' },
    'BELUM ADA PENGUJI': { cls: 'bad', icon: '⚠' }
  };
  function badge(status) {
    const s = String(status || '').toUpperCase();
    const m = STATUS[s] || { cls: 'idle', icon: '•' };
    const label = s.charAt(0) + s.slice(1).toLowerCase();
    return `<span class="badge ${m.cls}"><span aria-hidden="true">${m.icon}</span> ${esc(label)}</span>`;
  }

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

  window.App = { api, esc, key, todayJakarta, fmtTgl, JENIS, badge, toast };
})();
