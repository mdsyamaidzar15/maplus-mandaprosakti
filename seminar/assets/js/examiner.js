// Halaman penguji: pilih nama -> daftar peserta -> isi nilai -> simpan.
(() => {
  const { api, esc, todayJakarta, fmtTgl, JENIS, toast } = App;
  const $ = s => document.querySelector(s);
  const S = { penguji: null, peserta: [], cur: null, ind: [], dirty: false, saving: false };

  const show = id => ['v-pick', 'v-list', 'v-form'].forEach(v => ($('#' + v).hidden = v !== id));
  const round2 = n => Math.round(n * 100) / 100;

  /* ---------- 1. Pilih penguji ---------- */
  async function initPenguji() {
    const sel = $('#selPenguji');
    try {
      const list = await api('getPengujiAktif');
      sel.innerHTML = '<option value="">— Pilih nama —</option>' +
        list.map(p => `<option value="${esc(p.idpenguji)}">${esc(p.namapenguji)}</option>`).join('');
      $('#btnMasuk').disabled = false;
      const saved = sessionStorage.getItem('penguji');
      if (saved && list.some(p => p.idpenguji === saved)) {
        sel.value = saved;
        masuk();
      }
    } catch (e) {
      sel.innerHTML = '<option value="">Gagal memuat</option>';
      toast(e.message, 'err');
    }
  }

  function masuk() {
    const sel = $('#selPenguji');
    if (!sel.value) return toast('Pilih nama Anda terlebih dahulu.', 'err');
    S.penguji = { id: sel.value, nama: sel.options[sel.selectedIndex].text };
    sessionStorage.setItem('penguji', S.penguji.id);
    $('#namaPenguji').textContent = S.penguji.nama;
    $('#inTanggal').value = todayJakarta();
    show('v-list');
    loadList();
  }

  /* ---------- 2. Daftar peserta ---------- */
  async function loadList() {
    const box = $('#listBox');
    box.innerHTML = '<div class="loading">Memuat peserta…</div>';
    try {
      S.peserta = await api('getPesertaPenguji', { idPenguji: S.penguji.id, tanggal: $('#inTanggal').value });
      if (!S.peserta.length) {
        box.innerHTML = '<div class="card empty">Tidak ada peserta yang ditugaskan kepada Anda pada tanggal ini. Coba ganti tanggal, atau hubungi admin.</div>';
        return;
      }
      box.innerHTML = S.peserta.map((p, i) => `
        <div class="item">
          <div>
            <b>${esc(p.namasiswa)}</b>
            <span class="meta">${esc(JENIS[p.jenissidang] || p.jenissidang)} · Kelas ${esc(p.kelasprodistik || p.kelasasal || '-')}${p.sesi ? ' · Sesi ' + esc(p.sesi) : ''}</span>
          </div>
          <div style="display:flex;gap:.6rem;align-items:center">
            <span class="badge ${p.sudahdinilai ? 'ok' : 'idle'}">${p.sudahdinilai ? '● Tersimpan' : '○ Belum diisi'}</span>
            <button class="btn small" data-i="${i}" type="button">${p.sudahdinilai ? 'Ubah nilai' : 'Beri nilai'}</button>
          </div>
        </div>`).join('');
    } catch (e) {
      box.innerHTML = `<div class="card empty">${esc(e.message)}</div>`;
    }
  }

  /* ---------- 3. Form penilaian ---------- */
  async function openForm(p) {
    S.cur = p;
    S.dirty = false;
    $('#fNama').textContent = p.namasiswa;
    $('#fMeta').textContent = `${JENIS[p.jenissidang] || p.jenissidang} · ${fmtTgl(p.tanggal)} · Kelas ${p.kelasprodistik || p.kelasasal || '-'}`;
    $('#indBox').innerHTML = '<div class="loading">Memuat indikator…</div>';
    $('#inJudul').value = '';
    $('#preview').textContent = '–';
    show('v-form');
    try {
      const [ind, nilai] = await Promise.all([
        api('getIndikator', { jenisSidang: p.jenissidang }),
        api('getPenilaian', { idPenugasan: p.idpenugasan, idPenguji: S.penguji.id }).catch(() => null)
      ]);
      S.ind = ind.slice().sort((a, b) => (+a.no || 0) - (+b.no || 0));
      renderIndikator(nilai);
    } catch (e) {
      $('#indBox').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  }

  function renderIndikator(saved) {
    if (saved && saved.judulta) $('#inJudul').value = saved.judulta;
    const vals = (saved && Array.isArray(saved.nilai)) ? saved.nilai : [];
    $('#indBox').innerHTML = S.ind.map((x, i) => `
      <div class="ind">
        <label for="n${i}">${i + 1}. ${esc(x.namaindikator)} <span class="w">(bobot ${esc(x.bobot)}%)</span></label>
        ${x.deskripsi ? `<p class="hint">${esc(x.deskripsi)}</p>` : ''}
        <input id="n${i}" data-i="${i}" type="number" inputmode="decimal" step="any"
               min="${esc(x.nilaimin)}" max="${esc(x.nilaimax)}" value="${vals[i] ?? ''}"
               aria-describedby="e${i}" placeholder="${esc(x.nilaimin)} – ${esc(x.nilaimax)}">
        <div id="e${i}" class="err" role="alert"></div>
      </div>`).join('');
    updatePreview();
  }

  function readValues() {
    return S.ind.map((_, i) => $('#n' + i).value.trim());
  }

  function updatePreview() {
    const v = readValues();
    if (v.some(x => x === '' || isNaN(+x))) return ($('#preview').textContent = '–');
    const total = v.reduce((s, x, i) => s + (+x) * (+S.ind[i].bobot) / 100, 0);
    $('#preview').textContent = round2(total).toString().replace('.', ',');
  }

  function validate() {
    let ok = true;
    S.ind.forEach((x, i) => {
      const input = $('#n' + i), err = $('#e' + i), raw = input.value.trim(), n = +raw;
      let msg = '';
      if (raw === '' || isNaN(n)) msg = 'Isi nilai dengan angka.';
      else if (n < +x.nilaimin || n > +x.nilaimax) msg = `Nilai harus antara ${x.nilaimin} dan ${x.nilaimax}.`;
      err.textContent = msg;
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) ok = false;
    });
    return ok;
  }

  async function simpan(ev) {
    ev.preventDefault();
    if (S.saving || !S.ind.length) return;
    if (!validate()) {
      toast('Ada nilai yang belum sesuai. Periksa isian yang bertanda merah.', 'err');
      const first = document.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    S.saving = true;
    const btn = $('#btnSimpan');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';
    try {
      // Backend memverifikasi penugasan, rentang nilai, dan menghitung nilai akhir yang sah.
      const res = await api('savePenilaian', {
        idPenugasan: S.cur.idpenugasan,
        idSidang: S.cur.idsidang,
        idPenguji: S.penguji.id,
        judulTA: $('#inJudul').value.trim(),
        nilai: readValues().map(Number)
      });
      S.dirty = false;
      const akhir = res && res.nilaiakhir != null ? ` Nilai akhir: ${String(res.nilaiakhir).replace('.', ',')}` : '';
      toast('Penilaian tersimpan.' + akhir);
      show('v-list');
      loadList();
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      S.saving = false;
      btn.disabled = false;
      btn.textContent = 'Simpan penilaian';
    }
  }

  /* ---------- Event ---------- */
  $('#btnMasuk').addEventListener('click', masuk);
  $('#btnGanti').addEventListener('click', () => { sessionStorage.removeItem('penguji'); show('v-pick'); });
  $('#inTanggal').addEventListener('change', loadList);
  $('#listBox').addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (b) openForm(S.peserta[+b.dataset.i]);
  });
  $('#btnKembali').addEventListener('click', () => {
    if (S.dirty && !confirm('Perubahan belum disimpan. Tetap kembali?')) return;
    S.dirty = false;
    show('v-list');
    loadList();
  });
  $('#formNilai').addEventListener('input', e => {
    S.dirty = true;
    if (e.target.matches('input[type=number]')) updatePreview();
  });
  $('#formNilai').addEventListener('submit', simpan);
  window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  initPenguji();
})();
