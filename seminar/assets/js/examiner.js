// Penguji: pilih nama -> daftar peserta (tabel) -> rute #nilai-<idPenugasan> untuk mengisi nilai.
(() => {
  const { api, esc, todayJakarta, fmtTgl, JENIS, icon, chip, safeUrl, skeleton, emptyState, paginate, pagerHtml, toast } = App;
  const $ = s => document.querySelector(s);
  const S = { penguji: null, peserta: [], q: '', page: 1, cur: null, ind: [], dirty: false, saving: false, ready: false };
  const show = id => ['v-pick', 'v-list', 'v-form'].forEach(v => ($('#' + v).hidden = v !== id));
  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  /* ---------- Rute ---------- */
  function route() {
    if (!S.penguji) return show('v-pick');
    const m = /^#nilai-(.+)$/.exec(location.hash);
    if (m) return openForm(decodeURIComponent(m[1]));
    show('v-list');
    loadList();
  }

  /* ---------- Pilih penguji ---------- */
  async function initPenguji() {
    const sel = $('#selPenguji');
    try {
      const list = await api('getPengujiAktif');
      sel.innerHTML = '<option value="">Pilih nama</option>' +
        list.map(p => `<option value="${esc(p.idpenguji)}">${esc(p.namapenguji)}</option>`).join('');
      S.ready = true;
      const saved = sessionStorage.getItem('penguji');
      if (saved && list.some(p => p.idpenguji === saved)) { sel.value = saved; masuk(); }
    } catch (e) {
      sel.innerHTML = '<option value="">Daftar tidak termuat</option>';
      $('#errPenguji').textContent = e.message;
    }
  }

  function masuk() {
    const sel = $('#selPenguji'), err = $('#errPenguji');
    if (!S.ready) { err.textContent = 'Daftar penguji belum termuat. Muat ulang halaman, lalu coba lagi.'; return; }
    if (!sel.value) {
      err.textContent = 'Pilih nama Anda dari daftar.';
      sel.setAttribute('aria-invalid', 'true');
      sel.focus();
      return;
    }
    err.textContent = '';
    sel.removeAttribute('aria-invalid');
    S.penguji = { id: sel.value, nama: sel.options[sel.selectedIndex].text };
    sessionStorage.setItem('penguji', S.penguji.id);
    $('#namaPenguji').textContent = S.penguji.nama;
    if (!$('#inTanggal').value) $('#inTanggal').value = todayJakarta();
    route();
  }

  /* ---------- Daftar peserta ---------- */
  const fetchPeserta = () => api('getPesertaPenguji', { idPenguji: S.penguji.id, tanggal: $('#inTanggal').value });

  async function loadList() {
    const f = $('#listFrame');
    f.innerHTML = skeleton(5);
    try {
      S.peserta = await fetchPeserta();
      renderList();
    } catch (e) {
      f.innerHTML = emptyState('Daftar peserta tidak dapat dimuat', e.message, 'Muat ulang', 'reload');
    }
  }

  const docLink = (url, label, ic) => {
    const u = safeUrl(url);
    return u
      ? `<a class="lnk doc" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${icon(ic)} ${label}<span class="sr"> (buka di tab baru)</span></a>`
      : `<span class="doc none">${label}: belum ada</span>`;
  };

  function rowHtml(p) {
    const meta = [JENIS[p.jenissidang] || p.jenissidang, 'Kelas ' + (p.kelasprodistik || p.kelasasal || '-'), p.sesi ? 'Sesi ' + p.sesi : ''].filter(Boolean).join(' · ');
    return `<tr>
      <td><b>${esc(p.namasiswa)}</b><div class="meta">${esc(meta)}</div></td>
      <td>${docLink(p.linkppt, 'PPT', 'presentation')}${docLink(p.linkdraft, 'Draft laporan', 'file-text')}</td>
      <td>${p.sudahdinilai ? chip('ok', 'circle-check', 'Tersimpan') : chip('idle', 'circle', 'Belum diisi')}</td>
      <td><a class="btn${p.sudahdinilai ? ' secondary' : ''}" href="#nilai-${encodeURIComponent(p.idpenugasan)}">${p.sudahdinilai ? 'Ubah nilai' : 'Beri nilai'}<span class="sr"> untuk ${esc(p.namasiswa)}</span></a></td>
    </tr>`;
  }

  function renderList() {
    const f = $('#listFrame'), q = S.q.trim().toLowerCase();
    if (!S.peserta.length) {
      f.innerHTML = emptyState('Belum ada peserta pada tanggal ini', 'Peserta tampil di sini setelah admin menugaskan Anda pada jadwal sidang.', 'Muat ulang', 'reload');
      return;
    }
    const rows = S.peserta.filter(p => !q || String(p.namasiswa).toLowerCase().includes(q));
    if (!rows.length) {
      f.innerHTML = emptyState(`Tidak ada hasil untuk "${S.q}"`, 'Periksa ejaan nama, atau hapus pencarian untuk melihat semua peserta.', 'Hapus pencarian', 'clear');
      return;
    }
    const g = paginate(rows, S.page);
    f.innerHTML = `<div class="scroll"><table>
      <thead><tr><th>Peserta</th><th>Dokumen</th><th>Status</th><th><span class="sr">Aksi</span></th></tr></thead>
      <tbody>${g.items.map(rowHtml).join('')}</tbody></table></div>` + pagerHtml(g);
  }

  /* ---------- Form nilai (rute) ---------- */
  async function openForm(id) {
    show('v-form');
    S.dirty = false;
    $('#discard').hidden = true;
    $('#indBox').innerHTML = skeleton(4);
    $('#preview').textContent = '–';
    $('#inJudul').value = '';
    try {
      if (!S.peserta.some(x => String(x.idpenugasan) === id)) S.peserta = await fetchPeserta();
      const p = S.peserta.find(x => String(x.idpenugasan) === id);
      if (!p) { toast('Peserta tidak ditemukan pada tanggal ini. Pilih peserta dari daftar.', 'err'); location.hash = ''; return; }
      S.cur = p;
      $('#fNama').textContent = p.namasiswa;
      $('#fNama').tabIndex = -1;
      $('#fNama').focus({ preventScroll: true });
      $('#fMeta').textContent = `${JENIS[p.jenissidang] || p.jenissidang} · ${fmtTgl(p.tanggal)} · Kelas ${p.kelasprodistik || p.kelasasal || '-'}`;
      $('#docs').innerHTML = docLink(p.linkppt, 'PPT', 'presentation') + docLink(p.linkdraft, 'Draft laporan', 'file-text');
      const [ind, nilai] = await Promise.all([
        api('getIndikator', { jenisSidang: p.jenissidang }),
        api('getPenilaian', { idPenugasan: p.idpenugasan, idPenguji: S.penguji.id }).catch(() => null)
      ]);
      S.ind = ind.slice().sort((a, b) => (+a.no || 0) - (+b.no || 0));
      renderIndikator(nilai);
    } catch (e) {
      $('#indBox').innerHTML = emptyState('Form nilai tidak dapat dimuat', e.message, 'Kembali ke daftar', 'back');
    }
  }

  function renderIndikator(saved) {
    if (saved && saved.judulta) $('#inJudul').value = saved.judulta;
    const vals = saved && Array.isArray(saved.nilai) ? saved.nilai : [];
    $('#indBox').innerHTML = S.ind.map((x, i) => `
      <div class="ind">
        <label for="n${i}">${i + 1}. ${esc(x.namaindikator)} <span class="req" aria-hidden="true">*</span> <span class="w">(bobot ${esc(x.bobot)}%)</span></label>
        ${x.deskripsi ? `<p class="hint" style="margin:0 0 8px">${esc(x.deskripsi)}</p>` : ''}
        <input id="n${i}" data-i="${i}" type="number" inputmode="decimal" step="any" min="${esc(x.nilaimin)}" max="${esc(x.nilaimax)}"
               value="${vals[i] ?? ''}" aria-required="true" aria-describedby="h${i} e${i}">
        <p class="hint" id="h${i}">Isi nilai ${esc(x.nilaimin)}–${esc(x.nilaimax)}.</p>
        <div id="e${i}" class="err" role="alert"></div>
      </div>`).join('');
    updatePreview();
  }

  const readValues = () => S.ind.map((_, i) => $('#n' + i).value.trim());

  function updatePreview() {
    const v = readValues();
    if (!v.length || v.some(x => x === '' || isNaN(+x))) return ($('#preview').textContent = '–');
    $('#preview').textContent = String(round2(v.reduce((s, x, i) => s + (+x) * (+S.ind[i].bobot) / 100, 0))).replace('.', ',');
  }

  function checkOne(i) {
    const x = S.ind[i], input = $('#n' + i), raw = input.value.trim(), n = +raw;
    const bad = raw === '' || isNaN(n) || n < +x.nilaimin || n > +x.nilaimax;
    $('#e' + i).textContent = bad ? `Isi nilai antara ${x.nilaimin} dan ${x.nilaimax}.` : '';
    bad ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid');
    return !bad;
  }

  async function simpan(ev) {
    ev.preventDefault();
    if (S.saving || !S.ind.length) return;
    const oks = S.ind.map((_, i) => checkOne(i));
    if (oks.includes(false)) {
      const first = $('#n' + oks.indexOf(false));
      first.scrollIntoView({ block: 'center' });
      first.focus();
      return;
    }
    S.saving = true;
    const btn = $('#btnSimpan');
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Menyimpan…';
    try {
      // Nilai akhir yang sah dihitung backend.
      const res = await api('savePenilaian', {
        idPenugasan: S.cur.idpenugasan, idSidang: S.cur.idsidang, idPenguji: S.penguji.id,
        judulTA: $('#inJudul').value.trim(), nilai: readValues().map(Number)
      });
      S.dirty = false;
      toast('Penilaian tersimpan.' + (res && res.nilaiakhir != null ? ` Nilai akhir: ${String(res.nilaiakhir).replace('.', ',')}` : ''));
      location.hash = '';
    } catch (e) {
      toast(`Penilaian belum tersimpan. ${e.message}`, 'err'); // isian tetap ada
    } finally {
      S.saving = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = 'Simpan penilaian';
    }
  }

  function leave() {
    if (!S.dirty) { location.hash = ''; return; }
    $('#discard').hidden = false;
    $('#btnLanjut').focus();
  }

  /* ---------- Event ---------- */
  $('#btnMasuk').addEventListener('click', masuk);
  $('#selPenguji').addEventListener('change', () => { $('#errPenguji').textContent = ''; $('#selPenguji').removeAttribute('aria-invalid'); });
  $('#btnGanti').addEventListener('click', () => {
    sessionStorage.removeItem('penguji');
    S.penguji = null;
    if (location.hash) location.hash = ''; else route();
  });
  $('#inTanggal').addEventListener('change', () => { S.page = 1; S.peserta = []; loadList(); });
  $('#cari').addEventListener('input', e => { S.q = e.target.value; S.page = 1; renderList(); });

  $('#listFrame').addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a) {
      if (a.dataset.act === 'reload') loadList();
      if (a.dataset.act === 'clear') { $('#cari').value = ''; S.q = ''; S.page = 1; renderList(); }
      return;
    }
    const b = e.target.closest('[data-pg]');
    if (b && b.getAttribute('aria-disabled') !== 'true') { S.page += +b.dataset.pg; renderList(); }
  });

  $('#btnKembali').addEventListener('click', leave);
  $('#btnBatal').addEventListener('click', leave);
  $('#btnBuang').addEventListener('click', () => { S.dirty = false; location.hash = ''; });
  $('#btnLanjut').addEventListener('click', () => { $('#discard').hidden = true; const i = $('#n0'); if (i) i.focus(); });
  $('#indBox').addEventListener('click', e => { if (e.target.closest('[data-act="back"]')) location.hash = ''; });
  $('#indBox').addEventListener('focusout', e => { if (e.target.matches('input[data-i]')) checkOne(+e.target.dataset.i); });
  $('#formNilai').addEventListener('input', e => {
    S.dirty = true;
    if (e.target.matches('input[data-i]')) {
      if (e.target.getAttribute('aria-invalid') === 'true') { e.target.removeAttribute('aria-invalid'); $('#e' + e.target.dataset.i).textContent = ''; }
      updatePreview();
    }
  });
  $('#formNilai').addEventListener('submit', simpan);
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  initPenguji();
})();
