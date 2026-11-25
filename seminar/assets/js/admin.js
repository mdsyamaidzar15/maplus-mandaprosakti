// Admin: tiap tab didefinisikan di TABS lalu dirender oleh satu mesin tabel + panel samping.
// Token hanya ada di sessionStorage dan divalidasi di backend pada setiap request.
(() => {
  const { api, esc, key, todayJakarta, fmtTgl, JENIS, icon, safeUrl, skeleton, emptyState, paginate, pagerHtml, toast } = App;
  const $ = s => document.querySelector(s);

  let token = sessionStorage.getItem('adm_token') || '';
  let tab = 'ringkasan', rows = [], q = '', page = 1, editing = null, confirmDeact = false;
  const cache = {};

  const STATUS = [['AKTIF', 'AKTIF'], ['NONAKTIF', 'NONAKTIF']];
  const JENIS_OPT = [['PROPOSAL', 'Seminar Proposal'], ['SIDANG_AKHIR', 'Sidang Akhir']];
  const LINK_HINT = 'Tempel link berbagi Google Drive. Atur akses ke "Siapa saja yang memiliki link" agar penguji dapat membuka.';

  // fields.k = nama kolom persis seperti header sheet; dikirim ke backend sebagai objek "data".
  const TABS = {
    ringkasan: { label: 'Ringkasan', readOnly: true, desc: 'Gambaran sidang hari ini.' },
    penguji: {
      label: 'Penguji', desc: 'Daftar penguji yang dapat menilai.', tabel: 'PENGUJI', save: 'adminSavePenguji',
      fields: [
        { k: 'ID_PENGUJI', label: 'ID penguji', id: true, ph: 'PG003' },
        { k: 'NAMA_PENGUJI', label: 'Nama penguji', req: true },
        { k: 'RUANG', label: 'Ruang', ph: 'Lab 1', hint: 'Ruang tempat penguji bertugas. Peserta otomatis mengikuti ruang penguji.' },
        { k: 'STATUS', label: 'Status', type: 'select', opts: STATUS },
        { k: 'KETERANGAN', label: 'Keterangan', type: 'textarea' }
      ]
    },
    peserta: {
      label: 'Peserta & jadwal', desc: 'Peserta sidang, jadwal, dan tautan dokumen Google Drive.', tabel: 'PESERTA_SIDANG', save: 'adminSavePeserta',
      fields: [
        { k: 'ID_SIDANG', label: 'ID sidang', id: true, ph: 'SD001' },
        { k: 'TANGGAL', label: 'Tanggal', type: 'date', req: true },
        { k: 'JENIS_SIDANG', label: 'Jenis sidang', type: 'select', opts: JENIS_OPT },
        { k: 'NIS', label: 'NIS', req: true },
        { k: 'NISN', label: 'NISN', ph: '0012345678', hint: 'Dipakai untuk nama file unggahan dan verifikasi siswa. Jika kosong, NIS dipakai.' },
        { k: 'NAMA_SISWA', label: 'Nama siswa', req: true },
        { k: 'KELAS_ASAL', label: 'Kelas asal' },
        { k: 'KELAS_PRODISTIK', label: 'Kelas PRODISTIK' },
        { k: 'PEMBIMBING', label: 'Pembimbing' },
        { k: 'SESI', label: 'Ruang (pengecualian)', ph: 'Lab 1', hint: 'Kosongkan agar ruang mengikuti penguji.' },
        { k: 'STATUS', label: 'Status', type: 'select', opts: STATUS },
        { k: 'LINK_PPT', label: 'Link PPT (Google Drive)', type: 'url', link: true, ph: 'https://drive.google.com/…', hint: LINK_HINT },
        { k: 'LINK_DRAFT_LAPORAN', label: 'Link draft laporan TA (Google Drive)', type: 'url', link: true, ph: 'https://drive.google.com/…', hint: LINK_HINT },
        { k: 'KETERANGAN', label: 'Keterangan', type: 'textarea' }
      ]
    },
    penugasan: {
      label: 'Penugasan', desc: 'Penguji yang menilai tiap peserta sidang.', tabel: 'PENUGASAN_PENGUJI', save: 'adminSavePenugasan',
      fields: [
        { k: 'ID_PENUGASAN', label: 'ID penugasan', id: true, ph: 'TGS001' },
        { k: 'ID_SIDANG', label: 'Peserta sidang', type: 'ref', ref: 'PESERTA_SIDANG', val: 'idsidang',
          lbl: r => `${r.idsidang} — ${r.namasiswa} (${JENIS[r.jenissidang] || r.jenissidang}, ${fmtTgl(r.tanggal)})` },
        { k: 'ID_PENGUJI', label: 'Penguji', type: 'ref', ref: 'PENGUJI', val: 'idpenguji', lbl: r => `${r.idpenguji} — ${r.namapenguji}` },
        { k: 'URUTAN_PENGUJI', label: 'Urutan penguji', type: 'number' },
        { k: 'STATUS', label: 'Status', type: 'select', opts: STATUS },
        { k: 'KETERANGAN', label: 'Keterangan', type: 'textarea' }
      ]
    },
    indikator: {
      label: 'Indikator', desc: 'Indikator dan bobot penilaian; total bobot aktif harus 100%.', tabel: 'INDIKATOR', save: 'adminSaveIndikator',
      fields: [
        { k: 'ID_INDIKATOR', label: 'ID indikator', id: true, ph: 'IND001' },
        { k: 'JENIS_SIDANG', label: 'Jenis sidang', type: 'select', opts: JENIS_OPT },
        { k: 'NO', label: 'Nomor urut', type: 'number', req: true },
        { k: 'NAMA_INDIKATOR', label: 'Nama indikator', req: true },
        { k: 'DESKRIPSI', label: 'Deskripsi', type: 'textarea' },
        { k: 'BOBOT', label: 'Bobot (%)', type: 'number', req: true },
        { k: 'NILAI_MIN', label: 'Nilai minimum', type: 'number', req: true },
        { k: 'NILAI_MAX', label: 'Nilai maksimum', type: 'number', req: true },
        { k: 'STATUS', label: 'Status', type: 'select', opts: STATUS }
      ]
    },
    penilaian: {
      label: 'Penilaian', desc: 'Nilai yang sudah masuk. Hanya dapat dilihat.', readOnly: true, date: true,
      load: () => api('adminGetPenilaian', { token, tanggal: $('#fTanggal')?.value || '' }),
      cols: ['ID_NILAI', 'ID_PENUGASAN', 'ID_SIDANG', 'ID_PENGUJI', 'JENIS_SIDANG', 'NIS', 'NAMA_SISWA', 'JUDUL_TA',
        'NILAI_1', 'NILAI_2', 'NILAI_3', 'NILAI_4', 'NILAI_AKHIR', 'WAKTU_INPUT', 'WAKTU_UPDATE', 'STATUS']
    },
    berkas: {
      label: 'Berkas', desc: 'Berkas PPT dan laporan yang diunggah siswa. Hanya dapat dilihat.', readOnly: true, tabel: 'UPLOAD_BERKAS',
      cols: ['WAKTU', 'NIS', 'NAMA_SISWA', 'KELAS_ASAL', 'JENIS_SIDANG', 'JENIS_BERKAS', 'NAMA_FILE', 'UKURAN_KB', 'LINK_FILE', 'STATUS']
    },
    pengaturan: {
      label: 'Pengaturan', desc: 'Pengaturan aplikasi. Ubah langsung di sheet PENGATURAN.', readOnly: true, tabel: 'PENGATURAN',
      cols: ['KEY', 'VALUE', 'KETERANGAN']
    },
    log: {
      label: 'Log', desc: 'Aktivitas terbaru (maksimal 200).', readOnly: true,
      load: () => api('adminGetLog', { token, limit: 200 }),
      cols: ['ID_LOG', 'WAKTU', 'AKSI', 'ID_PENGUJI', 'ID_SIDANG', 'KETERANGAN', 'STATUS']
    }
  };

  const getTable = async (tabel, force) => {
    if (force || !cache[tabel]) cache[tabel] = await api('adminGetData', { token, tabel });
    return cache[tabel];
  };
  const isReq = f => f.req || f.id || f.type === 'ref' || f.type === 'select';
  const WORDS = { id: 'ID', nis: 'NIS', nisn: 'NISN', ppt: 'PPT', ta: 'TA', kb: 'KB', sesi: 'Ruang (pengecualian)' };
  const headLabel = c => c.toLowerCase().split('_').map((w, i) => WORDS[w] || (i ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

  /* ---------- Masuk / keluar ---------- */
  function showApp(on) {
    $('#v-login').hidden = on;
    $('#v-app').hidden = !on;
    $('#btnKeluar').hidden = !on;
    if (!on) return;
    $('#tabs').innerHTML = Object.entries(TABS).map(([id, t]) =>
      `<button class="tab" type="button" data-tab="${id}" ${id === tab ? 'aria-current="page"' : ''}>${esc(t.label)}</button>`).join('');
    renderTab();
  }

  function switchTab(id) {
    tab = id;
    document.querySelectorAll('.tab').forEach(b => (b.dataset.tab === id ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    renderTab();
  }

  $('#formLogin').addEventListener('submit', async e => {
    e.preventDefault();
    const inp = $('#inToken'), err = $('#errToken'), btn = $('#btnLogin');
    const t = inp.value.trim();
    if (!t) { err.textContent = 'Isi token admin.'; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Memeriksa…';
    try {
      await api('adminLogin', { token: t });
      token = t;
      sessionStorage.setItem('adm_token', t);
      inp.value = '';
      showApp(true);
    } catch (ex) {
      err.textContent = ex.message;
      inp.setAttribute('aria-invalid', 'true');
    } finally {
      btn.removeAttribute('aria-busy');
      btn.textContent = 'Masuk';
    }
  });
  $('#inToken').addEventListener('input', e => { $('#errToken').textContent = ''; e.target.removeAttribute('aria-invalid'); });

  $('#btnKeluar').addEventListener('click', () => {
    token = '';
    sessionStorage.removeItem('adm_token');
    Object.keys(cache).forEach(k => delete cache[k]);
    showApp(false);
  });

  /* ---------- Render tab ---------- */
  const headHtml = t => `<div class="head"><div><h1>${esc(t.label)}</h1><p class="muted">${esc(t.desc)}</p></div>` +
    (t.readOnly ? '' : '<button class="btn" id="btnTambah" type="button" data-act="add">Tambah data</button>') + '</div>';

  async function renderTab() {
    const t = TABS[tab], my = tab, panel = $('#panel');
    q = ''; page = 1;
    if (tab === 'ringkasan') return renderRingkasan(panel, t);
    panel.innerHTML = headHtml(t) +
      `<div class="toolbar"><div class="field"><label for="fCari">Cari</label><input id="fCari" type="search" autocomplete="off"></div>` +
      (t.date ? `<div class="field fit"><label for="fTanggal">Tanggal</label><input id="fTanggal" type="date" value="${todayJakarta()}"></div>` : '') +
      '</div><div id="note"></div><div class="frame" id="frame" aria-live="polite"></div>';
    $('#frame').innerHTML = skeleton(6);
    try {
      const data = t.load ? await t.load() : await getTable(t.tabel, true);
      if (my !== tab) return;
      rows = data.slice();
      if (tab === 'berkas') rows.reverse(); // terbaru di atas
      if (!t.readOnly) rows.sort((a, b) => String(a[key(t.fields[0].k)]).localeCompare(String(b[key(t.fields[0].k)]), 'id', { numeric: true }));
      draw();
      if (tab === 'indikator') bobotNotice();
    } catch (e) {
      if (my !== tab) return;
      $('#frame').innerHTML = emptyState('Data tidak dapat dimuat', e.message, 'Muat ulang', 'reload');
    }
  }

  async function renderRingkasan(panel, t) {
    panel.innerHTML = headHtml(t) + skeleton(3);
    try {
      const s = await api('getRingkasanMonitoring', { tanggal: todayJakarta(), jenisSidang: 'SEMUA', status: 'SEMUA', keyword: '' });
      if (tab !== 'ringkasan') return;
      const items = [['Total peserta hari ini', s.total], ['Belum dimulai', s.belumdimulai], ['Proses penilaian', s.proses ?? s.prosespenilaian], ['Belum upload berkas', s.belumuploadberkas], ['Selesai', s.selesai]];
      panel.innerHTML = headHtml(t) + `<p class="muted">Tanggal ${esc(fmtTgl(todayJakarta()))}.</p><div class="stats">` +
        items.map(([l, v]) => `<div class="stat"><b>${esc(v ?? 0)}</b><span>${l}</span></div>`).join('') + '</div>' +
        (+s.belumadapenguji > 0 ? '<div class="notice bad">Ada peserta tanpa penguji aktif. <div class="row"><button class="btn secondary" type="button" data-goto="penugasan">Atur penugasan</button></div></div>' : '');
    } catch (e) {
      panel.innerHTML = headHtml(t) + `<div class="frame">${emptyState('Ringkasan tidak dapat dimuat', e.message, 'Muat ulang', 'reload')}</div>`;
    }
  }

  function bobotNotice() {
    $('#note').innerHTML = JENIS_OPT.map(([j, nama]) => {
      const total = rows.filter(r => r.jenissidang === j && String(r.status).toUpperCase() === 'AKTIF').reduce((s, r) => s + (+r.bobot || 0), 0);
      const ok = Math.abs(total - 100) < 0.001;
      return `<div class="notice ${ok ? 'ok' : 'bad'}">${nama}: total bobot aktif ${total}%. ${ok ? 'Sudah 100%.' : 'Harus tepat 100% sebelum dipakai menilai.'}</div>`;
    }).join('');
  }

  function cell(col, v, mask) {
    if (mask) return '••••••';
    if (/^LINK_/.test(col)) {
      const u = safeUrl(v);
      return u ? `<a class="lnk" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Buka ${icon('external-link', 14)}<span class="sr"> ${esc(headLabel(col))} di tab baru</span></a>` : '<span class="muted">Belum ada</span>';
    }
    return esc(col === 'TANGGAL' ? fmtTgl(v) : v);
  }

  function draw() {
    const t = TABS[tab], f = $('#frame');
    if (!f) return;
    const cols = t.cols || t.fields.filter(x => !/^(KETERANGAN|DESKRIPSI)$/.test(x.k)).map(x => x.k);
    const term = q.trim().toLowerCase();
    if (!rows.length) {
      f.innerHTML = t.readOnly
        ? emptyState(`Belum ada data ${t.label.toLowerCase()}`, 'Data tampil di sini setelah ada aktivitas atau setelah tanggal diubah.', 'Muat ulang', 'reload')
        : emptyState(`Belum ada data ${t.label.toLowerCase()}`, 'Tambahkan data pertama agar bisa dipakai pada penjadwalan dan penilaian.', 'Tambah data', 'add');
      return;
    }
    const list = rows.filter(r => !term || Object.values(r).some(v => String(v ?? '').toLowerCase().includes(term)));
    if (!list.length) {
      f.innerHTML = emptyState(`Tidak ada hasil untuk "${q}"`, 'Periksa ejaan, atau hapus pencarian untuk melihat semua data.', 'Hapus pencarian', 'clear');
      return;
    }
    const g = paginate(list, page);
    f.innerHTML = `<div class="scroll"><table><thead><tr>${cols.map(c => `<th>${esc(headLabel(c))}</th>`).join('')}${t.readOnly ? '' : '<th><span class="sr">Aksi</span></th>'}</tr></thead><tbody>` +
      g.items.map(r => {
        const mask = tab === 'pengaturan' && /TOKEN|HASH|PIN/i.test(r.key || '');
        return '<tr>' + cols.map(c => `<td>${cell(c, r[key(c)], mask && c === 'VALUE')}</td>`).join('') +
          (t.readOnly ? '' : `<td><button class="btn secondary" type="button" data-edit="${rows.indexOf(r)}">Ubah<span class="sr"> ${esc(r[key(t.fields[0].k)])}</span></button></td>`) + '</tr>';
      }).join('') + '</tbody></table></div>' + pagerHtml(g);
  }

  /* ---------- Klik & input di panel ---------- */
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); });
  $('#panel').addEventListener('click', e => {
    const g = e.target.closest('[data-goto]');
    if (g) return switchTab(g.dataset.goto);
    const a = e.target.closest('[data-act]');
    if (a) {
      if (a.dataset.act === 'reload') renderTab();
      if (a.dataset.act === 'clear') { q = ''; page = 1; $('#fCari').value = ''; draw(); }
      if (a.dataset.act === 'add') openForm(null);
      return;
    }
    const p = e.target.closest('[data-pg]');
    if (p && p.getAttribute('aria-disabled') !== 'true') { page += +p.dataset.pg; draw(); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) openForm(rows[+ed.dataset.edit]);
  });
  $('#panel').addEventListener('input', e => { if (e.target.id === 'fCari') { q = e.target.value; page = 1; draw(); } });
  $('#panel').addEventListener('change', e => { if (e.target.id === 'fTanggal') renderTab(); });

  /* ---------- Panel samping: tambah/ubah ---------- */
  function fieldMsg(f, raw) {
    const v = String(raw).trim();
    if (isReq(f) && !v) return (f.type === 'ref' || f.type === 'select' ? 'Pilih ' : 'Isi ') + f.label.toLowerCase() + '.';
    if (f.link && v && !safeUrl(v)) return 'Tempel link Google Drive yang diawali https://drive.google.com/ atau https://docs.google.com/.';
    if (f.type === 'number' && v !== '' && isNaN(Number(v.replace(',', '.')))) return `${f.label} harus berupa angka.`;
    return '';
  }
  function showErr(f) {
    const inp = $('#f_' + f.k), msg = fieldMsg(f, inp.value);
    $('#err_' + f.k).textContent = msg;
    msg ? inp.setAttribute('aria-invalid', 'true') : inp.removeAttribute('aria-invalid');
    return msg;
  }
  function resetSubmit() {
    confirmDeact = false;
    $('#dlgWarn').hidden = true;
    const b = $('#dlgSimpan');
    b.className = 'btn';
    b.textContent = 'Simpan perubahan';
  }

  async function openForm(row) {
    editing = row;
    const t = TABS[tab];
    $('#dlgTitle').textContent = (row ? 'Ubah ' : 'Tambah ') + t.label.toLowerCase();
    $('#dlgErr').textContent = '';
    resetSubmit();
    const refs = {};
    try { for (const f of t.fields.filter(f => f.type === 'ref')) refs[f.ref] = await getTable(f.ref); }
    catch (e) { toast(`Daftar pilihan tidak dapat dimuat. ${e.message}`, 'err'); return; }

    $('#dlgFields').innerHTML = t.fields.map(f => {
      const v = row ? (row[key(f.k)] ?? '') : (f.k === 'STATUS' ? 'AKTIF' : '');
      const id = 'f_' + f.k;
      const d = `aria-describedby="${f.hint ? 'h_' + f.k + ' ' : ''}err_${f.k}"`;
      let input;
      if (f.type === 'select') {
        input = `<select id="${id}" data-k="${f.k}" ${d} aria-required="true">${f.opts.map(([val, lab]) => `<option value="${esc(val)}" ${String(v) === val ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
      } else if (f.type === 'ref') {
        const list = refs[f.ref].filter(r => !r.status || String(r.status).toUpperCase() === 'AKTIF' || String(r[f.val]) === String(v));
        input = `<select id="${id}" data-k="${f.k}" ${d} aria-required="true"><option value="">Pilih</option>${list.map(r => `<option value="${esc(r[f.val])}" ${String(r[f.val]) === String(v) ? 'selected' : ''}>${esc(f.lbl(r))}</option>`).join('')}</select>`;
      } else if (f.type === 'textarea') {
        input = `<textarea id="${id}" data-k="${f.k}" ${d}>${esc(v)}</textarea>`;
      } else {
        const val = f.type === 'date' ? String(v).slice(0, 10) : v;
        input = `<input id="${id}" data-k="${f.k}" type="${f.type || 'text'}" ${f.type === 'number' ? 'step="any"' : ''} value="${esc(val)}" placeholder="${esc(f.ph || '')}" ${d} ${isReq(f) ? 'aria-required="true"' : ''} ${f.id && row ? 'readonly' : ''}>`;
      }
      return `<div class="field"><label for="${id}">${esc(f.label)} ${isReq(f) ? '<span class="req" aria-hidden="true">*</span>' : '<span class="muted">(opsional)</span>'}</label>${input}` +
        (f.hint ? `<p class="hint" id="h_${f.k}">${esc(f.hint)}</p>` : '') + `<div class="err" id="err_${f.k}" role="alert"></div></div>`;
    }).join('');
    $('#dlg').showModal();
  }

  $('#dlgFields').addEventListener('focusout', e => { const f = TABS[tab].fields.find(x => x.k === e.target.dataset?.k); if (f) showErr(f); });
  $('#dlgFields').addEventListener('input', e => {
    const k = e.target.dataset?.k;
    if (!k) return;
    if (e.target.getAttribute('aria-invalid') === 'true') { e.target.removeAttribute('aria-invalid'); $('#err_' + k).textContent = ''; }
    if (k === 'STATUS') resetSubmit();
  });
  $('#dlgBatal').addEventListener('click', () => $('#dlg').close());

  $('#formEdit').addEventListener('submit', async e => {
    e.preventDefault();
    if ($('#dlgSimpan').getAttribute('aria-busy') === 'true') return;
    const t = TABS[tab], data = {};
    let bad = null;
    for (const f of t.fields) {
      if (showErr(f) && !bad) bad = f;
      const v = $('#f_' + f.k).value.trim();
      data[f.k] = f.type === 'number' && v !== '' ? Number(v.replace(',', '.')) : v;
    }
    if (bad) { $('#f_' + bad.k).focus(); return; }
    if (tab === 'indikator' && data.NILAI_MIN > data.NILAI_MAX) {
      $('#dlgErr').textContent = 'Nilai minimum harus lebih kecil atau sama dengan nilai maksimum.';
      return;
    }

    // Konfirmasi bernama sebelum menonaktifkan (tanpa modal bertumpuk).
    const wasActive = editing && String(editing.status).toUpperCase() !== 'NONAKTIF';
    if (wasActive && data.STATUS === 'NONAKTIF' && !confirmDeact) {
      const nama = data.NAMA_PENGUJI || data.NAMA_SISWA || data.NAMA_INDIKATOR || data[t.fields[0].k];
      confirmDeact = true;
      $('#dlgWarn').textContent = `Nonaktifkan "${nama}"? Penilaian yang sudah ada tetap tersimpan, tetapi data ini tidak muncul lagi untuk penilaian baru.`;
      $('#dlgWarn').hidden = false;
      $('#dlgSimpan').className = 'btn danger';
      $('#dlgSimpan').textContent = `Nonaktifkan ${nama}`;
      $('#dlgBatal').focus(); // fokus awal pada Batalkan
      return;
    }

    const btn = $('#dlgSimpan'), label = btn.textContent;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Menyimpan…';
    $('#dlgErr').textContent = '';
    try {
      await api(t.save, { token, mode: editing ? 'update' : 'create', data });
      toast('Data tersimpan.');
      $('#dlg').close();
      Object.keys(cache).forEach(k => delete cache[k]);
      renderTab();
    } catch (err) {
      $('#dlgErr').textContent = `Data belum tersimpan. ${err.message}`; // isian tetap ada
    } finally {
      btn.removeAttribute('aria-busy');
      btn.textContent = label;
    }
  });

  /* ---------- Mulai ---------- */
  (async () => {
    if (!token) return showApp(false);
    try { await api('adminLogin', { token }); showApp(true); }
    catch { token = ''; sessionStorage.removeItem('adm_token'); showApp(false); }
  })();
})();
