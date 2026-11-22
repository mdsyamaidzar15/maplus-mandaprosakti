// Monitoring: hanya progres. Tidak menampilkan nilai maupun judul TA.
(() => {
  const { api, esc, todayJakarta, JENIS, badge, toast } = App;
  const $ = s => document.querySelector(s);
  let timer = null, seq = 0;

  const filters = () => ({
    tanggal: $('#fTgl').value,
    jenisSidang: $('#fJenis').value,
    status: $('#fStatus').value,
    keyword: $('#fCari').value.trim()
  });

  function renderStats(s) {
    const items = [
      ['Total peserta', s.total],
      ['Belum dimulai', s.belumdimulai],
      ['Proses penilaian', s.proses ?? s.prosespenilaian],
      ['Selesai', s.selesai],
      ['Belum ada penguji', s.belumadapenguji]
    ];
    $('#stats').innerHTML = items.map(([l, v]) => `<div class="stat"><b>${esc(v ?? 0)}</b><span>${l}</span></div>`).join('');
  }

  // Cadangan bila endpoint ringkasan gagal: hitung dari daftar yang sudah dimuat.
  function statsFromRows(rows) {
    const c = st => rows.filter(r => String(r.status).toUpperCase() === st).length;
    return {
      total: rows.length, belumdimulai: c('BELUM DIMULAI'), proses: c('PROSES PENILAIAN'),
      selesai: c('SELESAI'), belumadapenguji: c('BELUM ADA PENGUJI')
    };
  }

  async function load() {
    const my = ++seq; // abaikan respons lama jika filter berubah saat menunggu
    const f = filters();
    $('#rows').innerHTML = '<tr><td colspan="8" class="loading">Memuat data…</td></tr>';
    try {
      const [rows, ringkasan] = await Promise.all([
        api('getMonitoringSidang', f),
        api('getRingkasanMonitoring', f).catch(() => null)
      ]);
      if (my !== seq) return;
      renderStats(ringkasan && ringkasan.total != null ? ringkasan : statsFromRows(rows));
      if (!rows.length) {
        $('#rows').innerHTML = '<tr><td colspan="8" class="empty">Tidak ada peserta sidang untuk filter ini.</td></tr>';
      } else {
        $('#rows').innerHTML = rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><b>${esc(r.namasiswa)}</b></td>
            <td>${esc(r.kelasasal)}</td>
            <td>${esc(r.kelasprodistik)}</td>
            <td>${esc(JENIS[r.jenissidang] || r.jenissidang)}</td>
            <td>${esc(r.sesi)}</td>
            <td>${esc(r.jumlahnilai ?? r.terisi ?? 0)}/${esc(r.jumlahpenguji ?? r.totalpenguji ?? 0)}</td>
            <td>${badge(r.status)}</td>
          </tr>`).join('');
      }
      $('#updated').textContent = 'Diperbarui ' + new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
    } catch (e) {
      if (my !== seq) return;
      $('#rows').innerHTML = `<tr><td colspan="8" class="empty">${esc(e.message)}</td></tr>`;
      toast(e.message, 'err');
    }
  }

  $('#fTgl').value = todayJakarta(); // default: hari ini (Asia/Jakarta)
  ['fTgl', 'fJenis', 'fStatus'].forEach(id => $('#' + id).addEventListener('change', load));
  $('#fCari').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 400); });
  $('#btnRefresh').addEventListener('click', load);
  load();
})();
