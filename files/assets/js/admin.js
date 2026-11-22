// Halaman admin. Setiap tab didefinisikan di TABS, lalu dirender oleh satu mesin tabel + form yang sama.
// Token admin hanya ada di sessionStorage dan dikirim ke backend untuk divalidasi di sana.
(() => {
  const { api, esc, key, todayJakarta, fmtTgl, JENIS, toast } = App;
  const $ = s => document.querySelector(s);

  let token = sessionStorage.getItem('adm_token') || '';
  let tab = 'ringkasan';
  let rows = [];          // baris yang sedang ditampilkan di tab aktif
  let editing = null;     // baris yang sedang diedit (null = tambah baru)
  const cache = {};       // cache tabel referensi (untuk dropdown)

  const STATUS = ['AKTIF', 'NONAKTIF'];
  const JENIS_OPT = [['PROPOSAL', 'Seminar Proposal'], ['SIDANG_AKHIR', 'Sidang Akhir']];

  // fields.k = nama kolom persis seperti header sheet; dikirim ke backend dalam objek "data".
  const TABS = {
    ringkasan: { label: 'Ringkasan' },
    penguji: {
      label: 'Penguji', tabel: 'PENGUJI', save: 'adminSavePenguji',
      fields: [
        { k: 'ID_PENGUJI', label: 'ID penguji', id: true, ph: 'PG003' },
        { k: 'NAMA_PENGUJI', label: 'Nama penguji', req: true },
        { k: 'STATUS', label: 'Status', type: 'select', opts: STATUS.map(s => [s, s]) },
        { k: 'KETERANGAN', label: 'Keterangan', type: 'textarea' }
      ]
    },
    peserta: {
      label: 'Peserta & jadwal', tabel: 'PESERTA_SIDANG', save: 'adminSavePeserta',
      fields: [
        { k: 'ID_SIDANG', label: 'ID sidang', id: true, ph: 'SD001' },
        { k: 'TANGGAL', label: 'Tanggal', type: 'date', req: true },
        { k: 'JENIS_SIDANG', label: 'Jenis sidang', type: 'select', opts: JENIS_OPT },
        { k: 'NIS', label: 'NIS', req: true },
        { k: 'NAMA_SISWA', label: 'Nama siswa', req: true },
        { k: 'KELAS_ASAL', label: 'Kelas asal' },
        { k: 'KELAS_PRODISTIK', label: 'Kelas PRODISTIK' },
        { k: 'PEMBIMBING', label: 'Pembimbing' },
        { k: 'SESI', label: 'Sesi' },
        { k: 'STATUS', label: 'Status', type: 'select', opts: STATUS.map(s => [s, s]) },
        { k: 'KETERANGAN', label: 'Keterangan', type: 'textarea' }
      ]
    },
    penugasan: {
      label: 'Penugasan', tabel: 'PENUGASAN_PENGUJI', save: 'adminSavePenugasan',
      fields: [
        { k: 'ID_PENUGASAN', label: 'ID penugasan', id: true, ph: 'TGS001' },
        { k: 'ID_SIDANG', label: 'Peserta sidang', type: 'ref', ref: 'PESERTA_SIDANG', val: 'idsidang',
          lbl: r => `${r.idsidang} — ${r.namasiswa} (${JENIS[r.jenissidang] || r.jenissidang}, ${fmtTgl(r.tanggal)})` },
        { k: 'ID_PENGUJI', label: 'Penguji', type: 'ref', ref: 'PENGUJI', val: 'idpenguji',
          lbl: r => `${r.idpenguji} — ${r.namapenguji}` },
        { k: 'URUTAN_PENGUJI', label: 'Urutan penguji', type: 'number' },
        { k: 'STATUS', label: 'Status', type: 'select', opts: STATUS.map(s => [s, s]) },
        { k: 'KETERANGAN', label: 'Keterangan', type: 'textarea' }
      ]
    },
    indikator: {
      label: 'Indikator', tabel: 'INDIKATOR', save: 'adminSaveIndikator',
      fields: [
        { k: 'ID_INDIKATOR', label: 'ID indikator', id: true, ph: 'IND001' },
        { k: 'JENIS_SIDANG', label: 'Jenis sidang', type: 'select', opts: JENIS_OPT },
        { k: 'NO', label: 'Nomor urut', type: 'number', req: true },
        { k: 'NAMA_INDIKATOR', label: 'Nama indikator', req: true },
        { k: 'DESKRIPSI', label: 'Deskripsi', type: 'textarea' },
        { k: 'BOBOT', label: 'Bobot (%)', type: 'number', req: true },
        { k: 'NILAI_MIN', label: 'Nilai minimum', type: 'number', req: true },
        { k: 'NILAI_MAX', label: 'Nilai maksimum', type: 'number', req: true },
        { k: 'STATUS', label: 'Status', type: 'select', opts: STATUS.map(s => [s, s]) }
      ]
    },
    penilaian: {
      label: 'Penilaian', readOnly: true, date: true,
      load: () => api('adminGetPenilaian', { token, tanggal: $('#fTanggal')?.value || '' }),
      cols: ['ID_NILAI', 'ID_PENUGASAN', 'ID_SIDANG', 'ID_PENGUJI', 'JENIS_SIDANG', 'NIS', 'NAMA_SISWA', 'JUDUL_TA',
        'NILAI_1', 'NILAI_2', 'NILAI_3', 'NILAI_4', 'NILAI_AKHIR', 'WAKTU_INPUT', 'WAKTU_UPDATE', 'STATUS']
    },
    pengaturan: {
      label: 'Pengaturan', readOnly: true, tabel: 'PENGATURAN',
      cols: ['KEY', 'VALUE', 'KETERANGAN']
    },
    log: {
      label: 'Log', readOnly: true,
      load: () => api('adminGetLog', { token, limit: 200 }),
      cols: ['ID_LOG', 'WAKTU', 'AKSI', 'ID_PENGUJI', 'ID_SIDANG', 'KETERANGAN', 'STATUS']
    }
  };

  const getTable = async (tabel, force) => {
    if (force || !cache[tabel]) cache[tabel] = await api('adminGetData', { token, tabel });
    return cache[tabel];
  };

  /* ---------- Login ---------- */
  function showApp(on) {
    $('#v-login').hidden = on;
    $('#v-app').hidden = !on;
    $('#btnKeluar').hidden = !on;
    if (on) {
      $('#tabs').innerHTML = Object.entries(TABS).map(([id, t]) =>
        `<button class="tab" role="tab" data-tab="${id}" aria-selected="${id === tab}">${t.label}</button>`).join('');
      renderTab();
    }
  }

  $('#formLogin').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#btnLogin');
    btn.disabled = true;
    try {
      const t = $('#inToken').value.trim();
      await api('adminLogin', { token: t });
      token = t;
      sessionStorage.setItem('adm_token', t);
      $('#inToken').value = '';
      showApp(true);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  });

  $('#btnKeluar').addEventListener('click', () => {
    token = '';
    sessionStorage.removeItem('adm_token');
    Object.keys(cache).forEach(k => delete cache[k]);
    showApp(false);
  });

  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', x === b));
    renderTab();
  });

  /* ---------- Render tab ---------- */
  async function renderTab() {
    const t = TABS[tab], panel = $('#panel');
    panel.innerHTML = '<div class="loading">Memuat…</div>';
    try {
      if (tab === 'ringkasan') return renderRingkasan(panel);

      const toolbar = `
        <div class="bar">
          <div style="flex:1;min-width:200px;max-width:340px"><label for="fCari">Cari</label><input id="fCari" type="search" placeholder="Ketik untuk menyaring…"></div>
          ${t.date ? `<div><label for="fTanggal">Tanggal</label><input id="fTanggal" type="date" value="${todayJakarta()}"></div>` : ''}
          ${t.readOnly ? '' : '<button class="btn" id="btnTambah" type="button">Tambah data</button>'}
        </div>`;
      panel.innerHTML = toolbar + '<div id="note"></div><div class="tablewrap"><table><thead></thead><tbody></tbody></table></div>';

      rows = t.load ? await t.load() : await getTable(t.tabel, true);
      drawTable();
      if (tab === 'indikator') bobotNotice();

      $('#fCari').addEventListener('input', drawTable);
      $('#fTanggal')?.addEventListener('change', renderTab);
      $('#btnTambah')?.addEventListener('click', () => openForm(null));
    } catch (e) {
      panel.innerHTML = `<div class="card empty">${esc(e.message)}</div>`;
    }
  }

  async function renderRingkasan(panel) {
    const s = await api('getRingkasanMonitoring', { tanggal: todayJakarta(), jenisSidang: 'SEMUA', status: 'SEMUA', keyword: '' });
    const items = [['Total peserta hari ini', s.total], ['Belum dimulai', s.belumdimulai],
      ['Proses penilaian', s.proses ?? s.prosespenilaian], ['Selesai', s.selesai], ['Belum ada penguji', s.belumadapenguji]];
    panel.innerHTML = `<p class="muted">Ringkasan sidang tanggal ${fmtTgl(todayJakarta())}.</p><div class="stats">` +
      items.map(([l, v]) => `<div class="stat"><b>${esc(v ?? 0)}</b><span>${l}</span></div>`).join('') + '</div>';
    if (+s.belumadapenguji > 0) {
      panel.insertAdjacentHTML('beforeend', '<div class="notice bad">Ada peserta tanpa penguji aktif. Atur di tab Penugasan.</div>');
    }
  }

  // Total bobot indikator aktif per jenis sidang harus 100.
  function bobotNotice() {
    const html = JENIS_OPT.map(([j, nama]) => {
      const total = rows.filter(r => r.jenissidang === j && String(r.status).toUpperCase() === 'AKTIF')
        .reduce((s, r) => s + (+r.bobot || 0), 0);
      const ok = Math.abs(total - 100) < 0.001;
      return `<div class="notice ${ok ? 'ok' : 'bad'}">${nama}: total bobot aktif ${total}% ${ok ? '(sudah 100%)' : '— harus tepat 100% sebelum dipakai menilai.'}</div>`;
    }).join('');
    $('#note').innerHTML = html;
  }

  function cell(col, v, mask) {
    if (mask) return '••••••';
    if (col === 'TANGGAL' || col === 'tanggal') return esc(fmtTgl(v));
    return esc(v);
  }

  function drawTable() {
    const t = TABS[tab];
    const cols = t.cols || t.fields.map(f => f.k);
    const q = ($('#fCari').value || '').toLowerCase();
    const shown = rows.filter(r => !q || Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)));
    const head = cols.map(c => `<th>${esc(c.replace(/_/g, ' ').toLowerCase().replace(/^./, m => m.toUpperCase()))}</th>`).join('') + (t.readOnly ? '' : '<th>Aksi</th>');
    document.querySelector('thead').innerHTML = `<tr>${head}</tr>`;
    document.querySelector('tbody').innerHTML = shown.length
      ? shown.map(r => {
          // Nilai pengaturan yang mengandung TOKEN/HASH disamarkan.
          const mask = tab === 'pengaturan' && /TOKEN|HASH|PIN/i.test(r.key || '');
          return '<tr>' + cols.map(c => `<td>${cell(c, r[key(c)], mask && c === 'VALUE')}</td>`).join('') +
            (t.readOnly ? '' : `<td><button class="btn ghost small" data-edit="${rows.indexOf(r)}" type="button">Ubah</button></td>`) + '</tr>';
        }).join('')
      : `<tr><td colspan="${cols.length + 1}" class="empty">Belum ada data.</td></tr>`;
  }

  $('#panel').addEventListener('click', e => {
    const b = e.target.closest('[data-edit]');
    if (b) openForm(rows[+b.dataset.edit]);
  });

  /* ---------- Form tambah/ubah ---------- */
  async function openForm(row) {
    editing = row;
    const t = TABS[tab];
    $('#dlgTitle').textContent = (row ? 'Ubah ' : 'Tambah ') + t.label.toLowerCase();
    $('#dlgErr').textContent = '';
    const refs = {};
    for (const f of t.fields.filter(f => f.type === 'ref')) refs[f.ref] = await getTable(f.ref);

    $('#dlgFields').innerHTML = t.fields.map(f => {
      const v = row ? (row[key(f.k)] ?? '') : (f.k === 'STATUS' ? 'AKTIF' : '');
      const id = 'f_' + f.k;
      let input;
      if (f.type === 'select') {
        input = `<select id="${id}">${f.opts.map(([val, lab]) => `<option value="${esc(val)}" ${String(v) === val ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
      } else if (f.type === 'ref') {
        const list = refs[f.ref].filter(r => !r.status || String(r.status).toUpperCase() === 'AKTIF' || String(r[f.val]) === String(v));
        input = `<select id="${id}"><option value="">— Pilih —</option>${list.map(r => `<option value="${esc(r[f.val])}" ${String(r[f.val]) === String(v) ? 'selected' : ''}>${esc(f.lbl(r))}</option>`).join('')}</select>`;
      } else if (f.type === 'textarea') {
        input = `<textarea id="${id}">${esc(v)}</textarea>`;
      } else {
        const val = f.type === 'date' ? String(v).slice(0, 10) : v;
        input = `<input id="${id}" type="${f.type || 'text'}" ${f.type === 'number' ? 'step="any"' : ''} value="${esc(val)}" placeholder="${esc(f.ph || '')}">`;
      }
      const lock = f.id && row ? 'data-lock' : '';
      return `<div class="field" ${lock}><label for="${id}">${esc(f.label)}${f.req || f.id ? ' *' : ''}</label>${input}</div>`;
    }).join('');
    if (row) document.querySelectorAll('[data-lock] input').forEach(i => (i.readOnly = true));
    $('#dlg').showModal();
  }

  $('#dlgBatal').addEventListener('click', () => $('#dlg').close());

  $('#formEdit').addEventListener('submit', async e => {
    e.preventDefault();
    const t = TABS[tab], data = {};
    for (const f of t.fields) {
      let v = $('#f_' + f.k).value.trim();
      if ((f.req || f.id || f.type === 'ref') && !v) return ($('#dlgErr').textContent = `${f.label} wajib diisi.`);
      if (f.type === 'number' && v !== '') v = Number(v);
      data[f.k] = v;
    }
    if (tab === 'indikator' && data.NILAI_MIN > data.NILAI_MAX) return ($('#dlgErr').textContent = 'Nilai minimum tidak boleh lebih besar dari maksimum.');
    if (editing && data.STATUS === 'NONAKTIF' && !confirm('Menonaktifkan data ini dapat memengaruhi data yang sudah memiliki penilaian. Lanjutkan?')) return;

    const btn = $('#dlgSimpan');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';
    try {
      await api(t.save, { token, mode: editing ? 'update' : 'create', data });
      toast('Data tersimpan.');
      $('#dlg').close();
      Object.keys(cache).forEach(k => delete cache[k]); // dropdown harus memuat ulang
      renderTab();
    } catch (err) {
      $('#dlgErr').textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan perubahan';
    }
  });

  /* ---------- Mulai ---------- */
  (async () => {
    if (!token) return showApp(false);
    try { await api('adminLogin', { token }); showApp(true); }
    catch { token = ''; sessionStorage.removeItem('adm_token'); showApp(false); }
  })();
})();
