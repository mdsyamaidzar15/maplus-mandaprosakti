// Monitoring: hanya progres. Tidak menampilkan nilai maupun judul TA.
(() => {
  const { api, esc, todayJakarta, fmtTgl, JENIS, badge, icon, skeleton, emptyState, paginate, pagerHtml, toast } = App;
  const $ = s => document.querySelector(s);
  let rows = [], page = 1, timer = null, seq = 0;

  const filters = () => ({ tanggal: $('#fTgl').value, jenisSidang: $('#fJenis').value, status: $('#fStatus').value, keyword: $('#fCari').value.trim() });
  const STAT_LABEL = { 'BELUM DIMULAI': 'Belum dimulai', 'PROSES PENILAIAN': 'Proses penilaian', 'SELESAI': 'Selesai', 'BELUM ADA PENGUJI': 'Belum ada penguji' };

  function renderChips() {
    const f = filters(), out = [`<span class="chip"><span class="chip-in">Tanggal: ${esc(fmtTgl(f.tanggal))}</span></span>`];
    const add = (k, label) => out.push(`<button class="chip" type="button" data-clear="${k}"><span class="chip-in">${esc(label)} ${icon('x', 14)}</span><span class="sr">Hapus filter ${esc(label)}</span></button>`);
    if (f.jenisSidang !== 'SEMUA') add('jenis', 'Jenis: ' + (JENIS[f.jenisSidang] || f.jenisSidang));
    if (f.status !== 'SEMUA') add('status', 'Status: ' + (STAT_LABEL[f.status] || f.status));
    $('#chips').innerHTML = out.join('');
  }

  function statsFromRows(r) {
    const c = s => r.filter(x => String(x.status).toUpperCase() === s).length;
    return { total: r.length, belumdimulai: c('BELUM DIMULAI'), proses: c('PROSES PENILAIAN'), selesai: c('SELESAI'), belumadapenguji: c('BELUM ADA PENGUJI') };
  }

  function renderTable() {
    const f = $('#frame');
    if (!rows.length) {
      const aktif = filters().jenisSidang !== 'SEMUA' || filters().status !== 'SEMUA' || filters().keyword;
      f.innerHTML = aktif
        ? emptyState('Tidak ada peserta yang cocok', 'Ubah atau atur ulang filter untuk melihat peserta sidang lainnya.', 'Atur ulang filter', 'reset')
        : emptyState('Belum ada peserta sidang pada tanggal ini', 'Peserta tampil di sini setelah admin menjadwalkan sidang pada tanggal terpilih.', 'Muat ulang', 'reload');
      return;
    }
    const g = paginate(rows, page);
    const off = (g.page - 1) * 25;
    f.innerHTML = `<div class="scroll"><table>
      <thead><tr><th>No</th><th>Nama siswa</th><th>Kelas asal</th><th>Kelas PRODISTIK</th><th>Jenis sidang</th><th>Ruang</th><th>Progres</th><th>Status</th></tr></thead>
      <tbody>${g.items.map((r, i) => `<tr>
        <td class="num">${off + i + 1}</td><td><b>${esc(r.namasiswa)}</b></td><td>${esc(r.kelasasal)}</td><td>${esc(r.kelasprodistik)}</td>
        <td>${esc(JENIS[r.jenissidang] || r.jenissidang)}</td><td>${esc(r.sesi)}</td>
        <td class="num">${esc(r.jumlahnilai ?? r.terisi ?? 0)}/${esc(r.jumlahpenguji ?? r.totalpenguji ?? 0)}</td><td>${badge(r.status)}</td></tr>`).join('')}
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
      const s = ring && ring.total != null ? ring : statsFromRows(list);
      $('#ringkas').textContent = `${s.total ?? 0} peserta: ${s.belumdimulai ?? 0} belum dimulai, ${s.proses ?? s.prosespenilaian ?? 0} proses penilaian, ${s.selesai ?? 0} selesai, ${s.belumadapenguji ?? 0} belum ada penguji.`;
      renderTable();
      $('#updated').textContent = 'Diperbarui ' + new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
    } catch (e) {
      if (my !== seq) return;
      $('#ringkas').textContent = 'Ringkasan tidak tersedia.';
      $('#frame').innerHTML = emptyState('Data sidang tidak dapat dimuat', e.message, 'Muat ulang', 'reload');
    }
  }

  function reset() { $('#fJenis').value = 'SEMUA'; $('#fStatus').value = 'SEMUA'; $('#fCari').value = ''; load(); }

  $('#fTgl').value = todayJakarta();
  $('#filters').addEventListener('toggle', e => { $('#fpanel').hidden = !e.target.open; });
  ['fTgl', 'fJenis', 'fStatus'].forEach(id => $('#' + id).addEventListener('change', load));
  $('#fCari').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 400); });
  $('#btnRefresh').addEventListener('click', load);
  $('#btnReset').addEventListener('click', reset);
  $('#chips').addEventListener('click', e => {
    const c = e.target.closest('[data-clear]');
    if (!c) return;
    $(c.dataset.clear === 'jenis' ? '#fJenis' : '#fStatus').value = 'SEMUA';
    load();
  });
  $('#frame').addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a) return a.dataset.act === 'reset' ? reset() : load();
    const b = e.target.closest('[data-pg]');
    if (b && b.getAttribute('aria-disabled') !== 'true') { page += +b.dataset.pg; renderTable(); }
  });
  load();
})();
