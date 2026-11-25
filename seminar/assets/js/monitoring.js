// Monitoring: hanya progres. Tidak menampilkan nilai, judul TA, maupun link berkas.
// Siswa mengunggah PPT dan laporan dari sini setelah semua penguji selesai menilai.
(() => {
  const { api, esc, todayJakarta, fmtTgl, JENIS, badge, icon, skeleton, emptyState, paginate, pagerHtml, toast } = App;
  const $ = s => document.querySelector(s);
  const MAKS_MB = (window.APP_CONFIG && window.APP_CONFIG.UPLOAD_MAKS_MB) || 15;
  let rows = [], page = 1, timer = null, seq = 0, cur = null, uploading = false;

  const filters = () => ({ tanggal: $('#fTgl').value, jenisSidang: $('#fJenis').value, kelasAsal: $('#fKelas').value, status: $('#fStatus').value, keyword: $('#fCari').value.trim() });
  const STAT_LABEL = { 'BELUM DIMULAI': 'Belum dimulai', 'PROSES PENILAIAN': 'Proses penilaian', 'BELUM UPLOAD BERKAS': 'Belum upload berkas', 'SELESAI': 'Selesai', 'BELUM ADA PENGUJI': 'Belum ada penguji' };

  function renderChips() {
    const f = filters(), out = [`<span class="chip"><span class="chip-in">Tanggal: ${esc(fmtTgl(f.tanggal))}</span></span>`];
    const add = (k, label) => out.push(`<button class="chip" type="button" data-clear="${k}"><span class="chip-in">${esc(label)} ${icon('x', 14)}</span><span class="sr">Hapus filter ${esc(label)}</span></button>`);
    if (f.jenisSidang !== 'SEMUA') add('jenis', 'Jenis: ' + (JENIS[f.jenisSidang] || f.jenisSidang));
    if (f.kelasAsal !== 'SEMUA') add('kelas', 'Kelas: ' + $('#fKelas').selectedOptions[0].text);
    if (f.status !== 'SEMUA') add('status', 'Status: ' + (STAT_LABEL[f.status] || f.status));
    $('#chips').innerHTML = out.join('');
  }

  // Pilihan kelas berasal dari data sheet pada tanggal + jenis terpilih.
  function renderKelas(opsi) {
    if (!Array.isArray(opsi)) return;
    const sel = $('#fKelas'), now = sel.value;
    sel.innerHTML = '<option value="SEMUA">Semua kelas</option>' + opsi.map(o => `<option value="${esc(o.nilai)}">${esc(o.label)}</option>`).join('');
    sel.value = opsi.some(o => o.nilai === now) ? now : 'SEMUA';
  }

  function statsFromRows(r) {
    const c = s => r.filter(x => String(x.status).toUpperCase() === s).length;
    return { total: r.length, belumdimulai: c('BELUM DIMULAI'), proses: c('PROSES PENILAIAN'), belumuploadberkas: c('BELUM UPLOAD BERKAS'), selesai: c('SELESAI'), belumadapenguji: c('BELUM ADA PENGUJI') };
  }

  const berkas = (nama, ada) => `<span style="display:flex;align-items:center;gap:4px;white-space:nowrap">${icon(ada ? 'circle-check' : 'circle', 14)} ${nama}<span class="sr">${ada ? ' sudah diunggah' : ' belum diunggah'}</span></span>`;

  function renderTable() {
    const f = $('#frame');
    if (!rows.length) {
      const q = filters();
      const aktif = q.jenisSidang !== 'SEMUA' || q.kelasAsal !== 'SEMUA' || q.status !== 'SEMUA' || q.keyword;
      f.innerHTML = aktif
        ? emptyState('Tidak ada peserta yang cocok', 'Ubah atau atur ulang filter untuk melihat peserta sidang lainnya.', 'Atur ulang filter', 'reset')
        : emptyState('Belum ada peserta sidang pada tanggal ini', 'Peserta tampil di sini setelah admin menjadwalkan sidang pada tanggal terpilih.', 'Muat ulang', 'reload');
      return;
    }
    const g = paginate(rows, page);
    const off = (g.page - 1) * 25;
    f.innerHTML = `<div class="scroll"><table>
      <thead><tr><th>No</th><th>Nama siswa</th><th>Kelas asal</th><th>Jenis sidang</th><th>Ruang</th><th>Progres nilai</th><th>Berkas</th><th>Status</th><th><span class="sr">Aksi</span></th></tr></thead>
      <tbody>${g.items.map((r, i) => {
        const st = String(r.status).toUpperCase();
        const bisa = st === 'BELUM UPLOAD BERKAS' || (st === 'SELESAI' && r.wajibberkas);
        return `<tr>
        <td class="num">${off + i + 1}</td><td><b>${esc(r.namasiswa)}</b></td><td>${esc(String(r.kelasasal || '').trim())}</td>
        <td>${esc(JENIS[r.jenissidang] || r.jenissidang)}</td><td>${esc(r.ruang)}</td>
        <td class="num">${esc(r.jumlahnilai ?? 0)}/${esc(r.jumlahpenguji ?? 0)}</td>
        <td>${berkas('PPT', r.berkasppt)}${berkas('Laporan', r.berkaslaporan)}</td>
        <td>${badge(r.status)}</td>
        <td>${bisa ? `<button class="btn${st === 'SELESAI' ? ' secondary' : ''}" type="button" data-up="${rows.indexOf(r)}">${st === 'SELESAI' ? 'Ganti berkas' : 'Unggah berkas'}<span class="sr"> untuk ${esc(r.namasiswa)}</span></button>` : ''}</td></tr>`;
      }).join('')}
      </tbody></table></div>` + pagerHtml(g);
  }

  async function load() {
    const my = ++seq; // abaikan respons lama bila filter berubah
    const f = filters();
    renderChips();
    $('#frame').innerHTML = skeleton(6);
    try {
      const [list, ring] = await Promise.all([api('getMonitoringSidang', f), api('getRingkasanMonitoring', f).catch(() => null)]);
      if (my !== seq) return;
      rows = list; page = 1;
      if (ring) { renderKelas(ring.kelasopsi); renderChips(); }
      const s = ring && ring.total != null ? ring : statsFromRows(list);
      $('#ringkas').textContent = `${s.total ?? 0} peserta: ${s.belumdimulai ?? 0} belum dimulai, ${s.proses ?? s.prosespenilaian ?? 0} proses penilaian, ${s.belumuploadberkas ?? 0} belum upload berkas, ${s.selesai ?? 0} selesai, ${s.belumadapenguji ?? 0} belum ada penguji.`;
      renderTable();
      $('#updated').textContent = 'Diperbarui ' + new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
    } catch (e) {
      if (my !== seq) return;
      $('#ringkas').textContent = 'Ringkasan tidak tersedia.';
      $('#frame').innerHTML = emptyState('Data sidang tidak dapat dimuat', e.message, 'Muat ulang', 'reload');
    }
  }

  function reset() { ['fJenis', 'fKelas', 'fStatus'].forEach(id => ($('#' + id).value = 'SEMUA')); $('#fCari').value = ''; load(); }

  /* ---------- Unggah berkas ---------- */
  const EXT = { PPT: ['ppt', 'pptx'], LAPORAN: ['pdf', 'doc', 'docx'] };
  const FIELDS = [['PPT', '#uPpt', '#errPpt', '#sPpt', 'PPT'], ['LAPORAN', '#uLaporan', '#errLaporan', '#sLaporan', 'laporan']];

  function openUpload(r) {
    cur = r;
    $('#dlgSub').textContent = `${r.namasiswa} · ${JENIS[r.jenissidang] || r.jenissidang} · Kelas ${String(r.kelasasal || '').trim() || '-'}`;
    $('#uNomor').value = '';
    $('#errNomor').textContent = '';
    $('#dlgErr').textContent = '';
    $('#uNomor').removeAttribute('aria-invalid');
    FIELDS.forEach(([jb, inp, err, st]) => {
      $(inp).value = '';
      $(err).textContent = '';
      $(st).textContent = (jb === 'PPT' ? r.berkasppt : r.berkaslaporan) ? 'Sudah diunggah. Pilih file baru untuk menggantinya.' : `Belum diunggah. Maksimal ${MAKS_MB} MB.`;
    });
    $('#dlg').showModal();
  }

  const readB64 = file => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] || '');
    fr.onerror = () => rej(new Error('File tidak terbaca. Pilih ulang file, lalu coba lagi.'));
    fr.readAsDataURL(file);
  });

  $('#formUpload').addEventListener('submit', async e => {
    e.preventDefault();
    if (uploading || !cur) return;
    $('#dlgErr').textContent = '';
    let bad = null;
    const nomor = $('#uNomor').value.trim();
    $('#errNomor').textContent = nomor ? '' : 'Isi NISN Anda.';
    nomor ? $('#uNomor').removeAttribute('aria-invalid') : ($('#uNomor').setAttribute('aria-invalid', 'true'), (bad = $('#uNomor')));

    const dipilih = [];
    FIELDS.forEach(([jb, inp, err, , label]) => {
      const file = $(inp).files[0];
      let msg = '';
      if (file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!EXT[jb].includes(ext)) msg = `Format ${label} harus ${EXT[jb].map(x => '.' + x).join(', ')}.`;
        else if (file.size > MAKS_MB * 1048576) msg = `Ukuran file maksimal ${MAKS_MB} MB.`;
        else dipilih.push([jb, file]);
      }
      $(err).textContent = msg;
      msg ? $(inp).setAttribute('aria-invalid', 'true') : $(inp).removeAttribute('aria-invalid');
      if (msg && !bad) bad = $(inp);
    });
    if (!bad && !dipilih.length) { $('#dlgErr').textContent = 'Pilih minimal satu file untuk diunggah.'; return; }
    if (bad) { bad.focus(); return; }

    uploading = true;
    const btn = $('#dlgKirim'), label = btn.textContent;
    btn.setAttribute('aria-busy', 'true');
    let terkirim = 0;
    try {
      for (const [jb, file] of dipilih) {
        btn.textContent = `Mengunggah ${jb === 'PPT' ? 'PPT' : 'laporan'}…`;
        const data = await readB64(file);
        await api('uploadBerkas', { idSidang: cur.idsidang, nomor, jenisBerkas: jb, namaFile: file.name, data }, 180000);
        terkirim++;
      }
      toast('Berkas tersimpan.');
      $('#dlg').close();
    } catch (err) {
      $('#dlgErr').textContent = `Berkas belum terunggah. ${err.message}`;
    } finally {
      uploading = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = label;
      if (terkirim) load();
    }
  });
  $('#dlgTutup').addEventListener('click', () => { if (!uploading) $('#dlg').close(); });
  $('#dlg').addEventListener('cancel', e => { if (uploading) e.preventDefault(); });
  $('#uNomor').addEventListener('input', e => { $('#errNomor').textContent = ''; e.target.removeAttribute('aria-invalid'); });

  /* ---------- Event ---------- */
  $('#fTgl').value = todayJakarta();
  $('#filters').addEventListener('toggle', e => { $('#fpanel').hidden = !e.target.open; });
  ['fTgl', 'fJenis', 'fKelas', 'fStatus'].forEach(id => $('#' + id).addEventListener('change', load));
  $('#fCari').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 400); });
  $('#btnRefresh').addEventListener('click', load);
  $('#btnReset').addEventListener('click', reset);
  $('#chips').addEventListener('click', e => {
    const c = e.target.closest('[data-clear]');
    if (!c) return;
    $({ jenis: '#fJenis', kelas: '#fKelas', status: '#fStatus' }[c.dataset.clear]).value = 'SEMUA';
    load();
  });
  $('#frame').addEventListener('click', e => {
    const u = e.target.closest('[data-up]');
    if (u) return openUpload(rows[+u.dataset.up]);
    const a = e.target.closest('[data-act]');
    if (a) return a.dataset.act === 'reset' ? reset() : load();
    const b = e.target.closest('[data-pg]');
    if (b && b.getAttribute('aria-disabled') !== 'true') { page += +b.dataset.pg; renderTable(); }
  });
  load();
})();
