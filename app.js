"use strict";
// ===== Konfigurasi =====
const API = "https://udpoppswvgswzsbcinvk.supabase.co/functions/v1/swift-function";
const TZ = "Asia/Jakarta";
const SEGAR_MS = 15000;

const $ = (id) => document.getElementById(id);
const rp = (n) => (n < 0 ? "-" : "") + "Rp" + Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const rpPendek = (n) => n >= 1e9 ? (n / 1e9).toFixed(1).replace(".", ",") + "M" : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(".", ",").replace(/,?0+$/, "") + "jt" : n >= 1e3 ? Math.round(n / 1e3) + "rb" : String(Math.round(n));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tglPanjang = (iso) => new Date(iso + "T12:00:00+07:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const tglPendek = (iso) => new Date(iso + "T12:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: TZ });
const blnPendek = (ym) => new Date(ym + "-15T12:00:00Z").toLocaleDateString("id-ID", { month: "short" }).replace(".", "");
const blnPanjang = (ym) => new Date(ym + "-15T12:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
const jam = (ts) => { const w = new Date(new Date(ts).getTime() + 7 * 3600e3); return String(w.getUTCHours()).padStart(2, "0") + "." + String(w.getUTCMinutes()).padStart(2, "0"); };
const geser = (iso, h) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + h); return d.toISOString().slice(0, 10); };
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const sum = (xs) => xs.reduce((a, x) => a + x.nominal, 0);

const STATUS = [
  { teks: "Hemat beud", warna: "var(--hemat)", ikon: '<path d="M5 12l4 4 10-10"/>' },
  { teks: "Normal", warna: "var(--normal)", ikon: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>' },
  { teks: "Abnormal", warna: "var(--abnormal)", ikon: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.01"/>' },
  { teks: "Boncos", warna: "var(--boncos)", ikon: '<path d="M12 3c2 4 6 5 6 10a6 6 0 0 1-12 0c0-3 2-4 3-7 1 2 2 2 3 3 0-2 0-4 0-6z"/>' },
];
const TIPE = {
  keluar: { label: "", warna: "var(--keluar)", tanda: "−" },
  jual: { label: "jual", warna: "var(--jual)", tanda: "+" },
  masuk: { label: "masuk", warna: "var(--masuk)", tanda: "+" },
  investasi: { label: "invest", warna: "var(--invest)", tanda: "→" },
  device: { label: "device", warna: "var(--device)", tanda: "→" },
  keluarga: { label: "keluarga", warna: "var(--keluarga)", tanda: "→" },
};

// ===== Sesi (token disimpan di perangkat ini saja) =====
let token = "";
try { token = localStorage.getItem("duitku_sesi") || ""; } catch (e) {}
const simpanToken = (t) => { token = t; try { t ? localStorage.setItem("duitku_sesi", t) : localStorage.removeItem("duitku_sesi"); } catch (e) {} };

async function api(aksi, body, pakaiToken = true) {
  const headers = { "Content-Type": "application/json" };
  if (pakaiToken && token) headers.Authorization = "Bearer " + token;
  const res = await fetch(`${API}?aksi=${aksi}`, { method: "POST", headers, body: JSON.stringify(body || {}), cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ===== Login =====
function infoLogin(teks, jenis) {
  $("infoLogin").textContent = teks || "";
  $("infoLogin").classList.toggle("err", jenis === "err");
  $("infoLogin").classList.toggle("ok", jenis === "ok");
}
function tampilLogin(pesan, jenis = "err") {
  clearInterval(timer);
  $("layarApp").hidden = true; $("layarLogin").hidden = false;
  $("btnUlang").hidden = true;
  infoLogin(pesan, pesan ? jenis : "");
}
$("btnKode").addEventListener("click", async () => {
  $("btnKode").disabled = true; infoLogin("Mengirim kode…");
  try {
    const r = await api("minta_kode", {}, false);
    infoLogin(r.data.pesan || r.data.error || "Gagal mengirim kode.", r.data.ok ? "ok" : "err");
    if (r.data.ok) { $("tahap2").hidden = false; $("btnMasuk").hidden = false; $("btnKode").textContent = "Kirim ulang kode"; $("kode").value = ""; $("kode").focus(); }
  } catch (e) { infoLogin("Tidak bisa terhubung ke server. Cek internet lalu coba lagi.", "err"); }
  setTimeout(() => { $("btnKode").disabled = false; }, 60000);
});
let sedangMasuk = false;
$("formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (sedangMasuk) return;                         // cegah kirim 2x (auto-submit + tombol)
  const kode = $("kode").value.replace(/\D/g, "");
  if (kode.length !== 6) { infoLogin("Kode harus 6 angka.", "err"); return; }
  sedangMasuk = true; $("btnMasuk").disabled = true; $("kode").readOnly = true;
  infoLogin("Memeriksa kode…");
  try {
    const r = await api("masuk", { kode }, false);
    if (r.data.ok && r.data.token) {
      simpanToken(r.data.token);
      infoLogin("Kode benar ✓ Memuat dashboard…", "ok");
      const berhasil = await muat();
      if (berhasil) { $("kode").value = ""; clearInterval(timer); timer = setInterval(() => { if (!document.hidden) muat(); }, SEGAR_MS); }
    } else {
      infoLogin(r.data.pesan || r.data.error || "Kode salah.", "err");
      $("kode").select();
    }
  } catch (e2) { infoLogin("Tidak bisa terhubung ke server. Cek internet lalu coba lagi.", "err"); }
  sedangMasuk = false; $("btnMasuk").disabled = false; $("kode").readOnly = false;
});
$("kode").addEventListener("input", () => {
  $("kode").value = $("kode").value.replace(/\D/g, "").slice(0, 6);
  if ($("kode").value.length === 6 && !sedangMasuk) $("formLogin").requestSubmit();
});
$("btnUlang").addEventListener("click", () => { infoLogin("Memuat…"); mulai(); });
$("btnKeluar").addEventListener("click", async () => {
  try { await api("keluar"); } catch (e) {}
  simpanToken(""); data = null; tampilLogin("Kamu sudah keluar.", "ok");
});

// ===== Muat data =====
let data = null, timer = null, idTerlihat = null, modeArus = "bulan";
async function muat() {
  let r;
  try { r = await api("data"); }
  catch (e) { return gagalMuat("tidak bisa terhubung ke server"); }
  if (r.status === 401) { simpanToken(""); tampilLogin("Sesi login sudah berakhir atau tidak valid. Ketuk “Kirim kode” untuk masuk lagi."); return false; }
  if (r.status !== 200 || r.data.error) return gagalMuat(`server menjawab ${r.status}${r.data.error ? ": " + r.data.error : ""}`);
  data = r.data;
  $("layarLogin").hidden = true; $("layarApp").hidden = false; $("btnUlang").hidden = true;
  $("peringatan").hidden = !data.peringatan; $("peringatan").textContent = data.peringatan || "";
  try { render(); }
  catch (e) { console.error(e); $("peringatan").hidden = false; $("peringatan").textContent = "Sebagian tampilan gagal dimuat (" + e.message + "). Pastikan bot di Supabase sudah versi terbaru."; }
  $("live").classList.remove("off"); $("liveTxt").textContent = "Live";
  return true;
}
function gagalMuat(alasan) {
  $("live").classList.add("off"); $("liveTxt").textContent = "Offline";
  if ($("layarApp").hidden) {                  // belum pernah tampil → jangan biarkan layar kosong
    $("layarLogin").hidden = false;
    infoLogin(`Sudah masuk, tapi data gagal dimuat (${alasan}). Ketuk “Coba muat lagi”.`, "err");
    $("btnUlang").hidden = false;
  }
  return false;
}
function mulai() { clearInterval(timer); muat(); timer = setInterval(() => { if (!document.hidden) muat(); }, SEGAR_MS); }

// ===== Render =====
const SAMAR = '<span class="samar">Rp••••••</span>';
const IKON_KUNCI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>', IKON_BUKA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/></svg>';
const panelKunci = (teks) => `<div class="kunci-panel">${IKON_KUNCI}<div>${teks}</div><button class="tombol kecil" type="button" data-buka>Buka dengan PIN</button></div>`;
function render() {
  const d = data, hari = d.hariIni, bulan = hari.slice(0, 7), s = d.status, kunci = !!d.terkunci;
  document.body.classList.toggle("terkunci-ui", kunci);
  $("kunciIkon").innerHTML = kunci ? IKON_KUNCI : IKON_BUKA;
  $("kunciTxt").textContent = kunci ? "Terkunci" : "Terbuka";
  $("btnKunci").classList.toggle("buka", !kunci);
  $("btnKunci").setAttribute("aria-label", kunci ? "Buka bagian rahasia dengan PIN" : "Kunci lagi bagian rahasia");
  const st = STATUS[s.status.kode] ?? STATUS[0];
  document.documentElement.style.setProperty("--warna", st.warna);
  $("tgl").textContent = tglPanjang(hari);
  $("halo").textContent = "Halo, " + (d.nama || "kamu");

  // hero
  hitungNaik($("angka"), s.bersih);
  $("miniAngka").textContent = rp(s.bersih) + " · " + st.teks;
  $("status").innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${st.ikon}</svg>${st.teks}`;
  $("pesan").textContent = s.status.pesan + (s.jual ? ` Sudah dikurangi hasil jual barang ${rp(s.jual)}.` : "");
  gambarGauge(s);
  const keluarHariIni = sum(d.transaksi.filter((x) => x.tipe === "keluar" && x.tanggal === hari));
  $("ketHari").textContent = "Hari ini " + rp(keluarHariIni);
  $("ketGaji").textContent = kunci ? "Batas & gaji terkunci" : `Boncos > ${rpPendek(s.batas.boncos)} · gaji ${rpPendek(s.gaji)}`;

  // stat
  const blnIni = d.bulanan.find((x) => x.bulan === bulan) || {};
  const thn = d.tahunan.find((x) => x.tahun === hari.slice(0, 4)) || {};
  if (kunci) {
    ["kaya", "masukBln", "invBln", "plEst"].forEach((id) => { $(id).innerHTML = SAMAR; });
    $("masukThn").textContent = "ketuk untuk buka dengan PIN";
    $("invTarget").textContent = "terkunci";
    $("invBar").style.width = "0%";
    $("plJudul").textContent = "Paylater";
    $("plSisa").textContent = "terkunci";
  } else {
    $("kaya").textContent = rp(d.investasi.total);
    const pl = d.paylater || { total: 0, sisa: 0, namaBulan: "" };
    $("plJudul").textContent = pl.sisa ? `Paylater · dipotong 1 ${pl.namaBulan}` : "Paylater";
    $("plEst").textContent = pl.sisa ? rp(pl.total) : "Tidak ada tagihan";
    $("plSisa").textContent = pl.sisa ? `sisa tagihan ${rp(pl.sisa)} · belum dihitung pengeluaran` : "belanja paylater baru dihitung tiap tgl 1";
    $("masukBln").textContent = rp(blnIni.masuk || 0);
    $("masukThn").textContent = "Tahun ini " + rp(thn.masuk || 0);
    const invBln = blnIni.investasi || 0, target = s.rencana[0].n;
    $("invBln").textContent = rp(invBln);
    $("invTarget").textContent = `target ${rpPendek(target)} · ${Math.round((invBln / target) * 100)}%`;
    requestAnimationFrame(() => { $("invBar").style.width = Math.min(100, (invBln / target) * 100) + "%"; });
  }
  $("devThn").textContent = rp(thn.device || 0);
  $("kelBln").textContent = rp(blnIni.keluarga || 0);

  gambarArus();
  gambarHarian();

  // kategori
  const keluarBln = d.transaksi.filter((x) => x.tipe === "keluar" && x.tanggal.startsWith(bulan));
  const per = {};
  keluarBln.forEach((x) => { per[x.kategori] = per[x.kategori] || { n: 0, w: x.warna }; per[x.kategori].n += x.nominal; });
  const kats = Object.entries(per).sort((a, c) => c[1].n - a[1].n);
  const maks = kats.length ? kats[0][1].n : 1;
  $("kategori").innerHTML = kats.length ? kats.map(([nm, k]) =>
    `<div class="kat" style="--c:${esc(k.w)}"><span class="nm">${esc(nm)}</span><span class="vl">${rp(k.n)}</span><div class="trk"><b data-w="${(k.n / maks) * 100}"></b></div></div>`).join("")
    : `<div class="kosong">Belum ada pengeluaran bulan ini.</div>`;
  requestAnimationFrame(() => $("kategori").querySelectorAll("b[data-w]").forEach((el) => { el.style.width = el.dataset.w + "%"; }));

  // portofolio
  if (kunci) {
    $("invTotal").textContent = "terkunci";
    $("porto").innerHTML = panelKunci("Portofolio investasi terkunci");
  } else {
    $("invTotal").textContent = "total " + rp(d.investasi.total);
    $("porto").innerHTML = d.investasi.per.length
      ? d.investasi.per.map((p) => `<div class="baris" style="--c:var(--invest)"><div class="t"><div class="n">${esc(p.nama)}</div><div class="m">${Math.round((p.total / d.investasi.total) * 100)}% portofolio</div></div><div class="a">${rp(p.total)}</div></div>`).join("")
      : `<div class="kosong">Belum ada investasi. Kirim <b>invest etf 5jt</b> ke bot.</div>`;
  }

  // utang
  if (kunci) $("utang").innerHTML = panelKunci("Utang, piutang &amp; paylater terkunci");
  else {
  const pl = d.paylater || { total: 0, sisa: 0, namaBulan: "" };
  const blok = (arah, judul, tanda, warna) => {
    const xs = d.utang.filter((x) => x.arah === arah);
    return `<div class="grup"><span>${judul}</span><span>${xs.length ? rp(xs.reduce((a, x) => a + x.sisa, 0)) : "—"}</span></div>` +
      (xs.length ? xs.map((x) => `<div class="baris" style="--c:${warna}"><div class="t"><div class="n">${esc(x.nama)}</div>${x.catatan ? `<div class="m">${esc(x.catatan)}</div>` : ""}</div><div class="a">${tanda}${rp(x.sisa)}</div></div>`).join("") : `<div class="kosong">Tidak ada</div>`);
  };
  const blokPL = () => {
    const xs = d.utang.filter((x) => x.arah === "paylater");
    const kepala = `<div class="grup"><span>Tagihan paylater${xs.length ? ` · estimasi 1 ${esc(pl.namaBulan)} ${rp(pl.total)}` : ""}</span><span>${xs.length ? rp(pl.sisa) : "—"}</span></div>`;
    if (!xs.length) return kepala + `<div class="kosong">Tidak ada</div>`;
    return kepala + xs.map((x) => {
      const cic = x.tenor > 1 ? ` · ${rp(x.cicilan)}/bln, terbayar ${x.cicilanKe} dari ${x.tenor}` : "";
      return `<div class="baris" style="--c:var(--abnormal)"><div class="t"><div class="n">${esc(x.nama)} · ${esc(x.catatan || "Belanja")}</div><div class="m">sisa ${rp(x.sisa)}${cic}</div></div><div class="a">−${rp(x.sisa)}</div></div>`;
    }).join("");
  };
  $("utang").innerHTML = blok("piutang", "Orang utang ke kamu", "", "var(--masuk)") + blok("utang", "Kamu utang ke orang", "−", "var(--boncos)") + blokPL();
  }

  // pengingat
  $("pengingat").innerHTML = d.pengingat.length ? d.pengingat.map((r) => {
    const tg = new Date(new Date(r.waktu).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
    const tunggu = r.status === "terkirim" ? ` · balas <b>ok F${r.id}</b>` : "";
    return `<div class="baris" style="--c:var(--normal)"><div class="t"><div class="n">F${r.id} · ${esc(r.kegiatan)}</div><div class="m">${tglPanjang(tg)}, ${jam(r.waktu)}${tunggu}</div></div><div class="a">${r.nominal ? rp(r.nominal) : ""}</div></div>`;
  }).join("") : `<div class="kosong">Tidak ada pengingat. Contoh di WA: <b>F isi paket papa 15/10 12.30 100rb</b></div>`;

  // transaksi
  const terbaru = d.transaksi.slice(0, 30);
  if (!terbaru.length) $("trx").innerHTML = `<div class="kosong">Belum ada catatan. Kirim <b>kopi 22rb</b> ke bot WA.</div>`;
  else {
    const grup = {};
    terbaru.forEach((x) => (grup[x.tanggal] = grup[x.tanggal] || []).push(x));
    const label = (tg) => tg === hari ? "Hari ini" : tg === geser(hari, -1) ? "Kemarin" : tglPanjang(tg);
    $("trx").innerHTML = Object.entries(grup).map(([tg, xs]) =>
      `<div class="grup"><span>${label(tg)}</span><span>${rp(sum(xs.filter((x) => x.tipe === "keluar")))}</span></div>` +
      xs.map((x) => {
        const t = TIPE[x.tipe] || TIPE.keluar;
        return `<div class="baris${idTerlihat !== null && x.id > idTerlihat ? " baru" : ""}" style="--c:${esc(x.warna)}"><div class="t"><div class="n">${esc(x.deskripsi)}${t.label ? `<span class="tag" style="color:${t.warna}">${t.label}</span>` : ""}</div><div class="m">${esc(x.kategori)} · ${jam(x.waktu)}${x.metode ? " · " + esc(x.metode) : ""}</div></div><div class="a" style="color:${t.warna}">${x.nominal == null ? SAMAR : t.tanda + rp(x.nominal)}</div></div>`;
      }).join("")).join("");
  }
  idTerlihat = d.transaksi.length ? Math.max(...d.transaksi.map((x) => x.id)) : 0;
  $("upd").textContent = "terakhir " + jam(new Date().toISOString());
  pasangSorotan();
}

// ===== Gauge setengah lingkaran (zona hemat / normal / abnormal / boncos) =====
function gambarGauge(s) {
  // terkunci: server hanya kirim rasio (tanpa gaji/batas) → gambar dengan skala relatif
  const b = s.batas || { hemat: 0.5, normal: 0.75, boncos: 1 }, nilai = s.batas ? s.bersih : (s.rasio || 0);
  const maks = b.boncos * 1.25, R = 52, cx = 64, cy = 64, keliling = Math.PI * R;
  const titik = (f) => { const a = Math.PI * (1 - f); return [cx + R * Math.cos(a), cy - R * Math.sin(a)]; };
  const busur = (f0, f1) => { const [x0, y0] = titik(f0), [x1, y1] = titik(f1); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
  const zona = [[0, b.hemat, "#86EFAC"], [b.hemat, b.normal, "#BAE6FD"], [b.normal, b.boncos, "#FCD34D"], [b.boncos, maks, "#FCA5A5"]];
  const f = Math.min(1, nilai / maks);
  const svg = $("gauge");
  svg.innerHTML =
    zona.map(([a, z, w]) => `<path d="${busur(a / maks + 0.004, z / maks - 0.004)}" fill="none" stroke="${w}" stroke-opacity=".9" stroke-width="10" stroke-linecap="butt"/>`).join("") +
    `<path class="isi-arc" d="${busur(0, 1)}" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" stroke-dasharray="${keliling}" stroke-dashoffset="${keliling}"/>` +
    `<g class="jarum" style="transform: rotate(0deg)"><line x1="${cx}" y1="${cy}" x2="${cx - R + 22}" y2="${cy}" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5.5" fill="#FFFFFF"/><circle cx="${cx - 1.4}" cy="${cy - 1.4}" r="1.6" fill="#1D4ED8" fill-opacity=".6"/></g>`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    svg.querySelector(".isi-arc").style.strokeDashoffset = String(keliling * (1 - f));
    svg.querySelector(".jarum").style.transform = `rotate(${(f * 180).toFixed(1)}deg)`;
  }));
  const pct = Math.round((nilai / b.boncos) * 100);
  $("persen").innerHTML = `${pct}%<small>dari batas</small>`;
  $("gaugeWrap").setAttribute("aria-label", s.batas ? `${pct}% dari batas boncos ${rp(b.boncos)}` : `${pct}% dari batas boncos`);
}

// ===== Tilt 3D halus pada kartu utama (satu objek fokus saja) =====
(function pasangTilt() {
  const el = $("hero");
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover)").matches) return;
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transition = "transform 16ms linear";
    el.style.transform = `rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg)`;
    el.style.setProperty("--hx", (px + 0.5) * 100 + "%"); el.style.setProperty("--hy", (py + 0.5) * 100 + "%");
  });
  el.addEventListener("pointerleave", () => { el.style.transition = ""; el.style.transform = ""; el.style.removeProperty("--hx"); el.style.removeProperty("--hy"); });
})();

// angka naik halus
function hitungNaik(el, ke) {
  const dari = Number(el.dataset.n || 0);
  el.dataset.n = ke;
  const tulis = (v) => { el.innerHTML = `<small>Rp</small>${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`; };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || dari === ke) return tulis(ke);
  const t0 = performance.now(), dur = 900;
  const langkah = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); tulis(dari + (ke - dari) * e); if (p < 1) requestAnimationFrame(langkah); };
  requestAnimationFrame(langkah);
}

// ===== Grafik (SVG buatan sendiri) =====
const NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attr) { const e = document.createElementNS(NS, tag); for (const k in attr) e.setAttribute(k, attr[k]); return e; }

function grafikBatang(wadah, tip, kolom, seri, opsi = {}) {
  wadah.querySelectorAll("svg").forEach((x) => x.remove());
  const W = Math.max(280, Math.round(wadah.clientWidth || 320)), H = opsi.tinggi || 220, padB = 26, padT = 18;
  const maks = Math.max(1, ...kolom.flatMap((k) => seri.map((s) => k[s.key] || 0)));
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opsi.label || "grafik" });
  // garis bantu
  [0.5, 1].forEach((f) => {
    const y = padT + (H - padB - padT) * (1 - f);
    svg.appendChild(svgEl("line", { x1: 0, x2: W, y1: y, y2: y, stroke: css("--line"), "stroke-dasharray": "2 4" }));
    const t = svgEl("text", { x: 0, y: y - 5, "text-anchor": "start", fill: css("--ink-3"), "font-size": 10.5, "font-family": "Plus Jakarta Sans, system-ui, sans-serif", "font-weight": 600 }); t.textContent = rpPendek(maks * f); svg.appendChild(t);
  });
  const lebarKol = W / kolom.length, gap = Math.max(2, lebarKol * 0.22), lb = (lebarKol - gap) / seri.length;
  kolom.forEach((k, i) => {
    const g = svgEl("g", { class: "grp", tabindex: 0 });
    g.appendChild(svgEl("rect", { x: i * lebarKol, y: 0, width: lebarKol, height: H, fill: "transparent" }));
    seri.forEach((s, j) => {
      const v = k[s.key] || 0, h = Math.max(v ? 2 : 0, (v / maks) * (H - padB - padT));
      const r = svgEl("rect", { class: "batang", x: i * lebarKol + gap / 2 + j * lb, y: H - padB - h, width: Math.max(1, lb - 1), height: h, rx: Math.min(4, lb / 2), fill: s.warna });
      if (opsi.sorot && opsi.sorot(k)) r.setAttribute("stroke", css("--accent"));
      g.appendChild(r);
    });
    if (!opsi.labelTiap || i % opsi.labelTiap === 0 || i === kolom.length - 1) {
      const t = svgEl("text", { x: i * lebarKol + lebarKol / 2, y: H - 8, "text-anchor": "middle", fill: css("--ink-3"), "font-size": 11, "font-family": "Plus Jakarta Sans, system-ui, sans-serif", "font-weight": 600 });
      t.textContent = k.label; svg.appendChild(t);
    }
    const tampil = () => {
      tip.innerHTML = `<b>${esc(k.judul || k.label)}</b><br>` + seri.map((s) => `${s.nama}: ${rp(k[s.key] || 0)}`).join("<br>");
      const rect = wadah.getBoundingClientRect(), skala = 1;
      tip.style.left = Math.min(rect.width - 70, Math.max(70, (i * lebarKol + lebarKol / 2) * skala)) + "px";
      tip.style.top = (padT + 10) * skala + "px"; tip.classList.add("on");
    };
    g.addEventListener("mouseenter", tampil); g.addEventListener("focus", tampil); g.addEventListener("click", tampil);
    g.addEventListener("mouseleave", () => tip.classList.remove("on")); g.addEventListener("blur", () => tip.classList.remove("on"));
    svg.appendChild(g);
  });
  wadah.insertBefore(svg, tip);
  // tumbuh dari bawah saat pertama terlihat
  svg.querySelectorAll(".batang").forEach((r, i) => { r.style.transform = "scaleY(0)"; r.style.transitionDelay = (i * 12) + "ms"; });
  requestAnimationFrame(() => requestAnimationFrame(() => svg.querySelectorAll(".batang").forEach((r) => { r.style.transform = "scaleY(1)"; })));
}

const SERI_ARUS = [
  { key: "keluarBersih", nama: "Pengeluaran bersih", warna: css("--keluar") || "#0B1B3A" },
  { key: "masuk", nama: "Penghasilan", warna: css("--masuk") || "#16A34A" },
  { key: "investasi", nama: "Investasi", warna: css("--invest") || "#1E5EFF" },
  { key: "device", nama: "Device & tool", warna: css("--device") || "#7A5AF8" },
];
function gambarArus() {
  const d = data; if (!d) return;
  const bersih = (x) => Math.max(0, (x.keluar || 0) - (x.jual || 0));
  const kolom = modeArus === "bulan"
    ? d.bulanan.map((x) => ({ ...x, keluarBersih: bersih(x), label: blnPendek(x.bulan), judul: blnPanjang(x.bulan) }))
    : (d.tahunan.length ? d.tahunan : [{ tahun: d.hariIni.slice(0, 4) }]).map((x) => ({ ...x, keluarBersih: bersih(x), label: x.tahun, judul: "Tahun " + x.tahun }));
  $("judulArus").textContent = modeArus === "bulan" ? "12 bulan terakhir" : "Per tahun";
  const seri = d.terkunci ? SERI_ARUS.filter((x) => x.key !== "masuk" && x.key !== "investasi") : SERI_ARUS;
  grafikBatang($("grafikArus"), $("tipArus"), kolom, seri, { tinggi: 230, labelTiap: modeArus === "bulan" ? 2 : 1, label: "Grafik arus kas" });
}
function gambarHarian() {
  const d = data, hari = d.hariIni;
  const kolom = Array.from({ length: 14 }, (_, i) => {
    const tg = geser(hari, i - 13);
    return { tg, v: sum(d.transaksi.filter((x) => x.tipe === "keluar" && x.tanggal === tg)), label: tglPendek(tg).split(" ")[0], judul: tglPanjang(tg) };
  });
  grafikBatang($("grafikHarian"), $("tipHarian"), kolom, [{ key: "v", nama: "Pengeluaran", warna: css("--accent") || "#1E5EFF" }], { tinggi: 160, labelTiap: 2, sorot: (k) => k.tg === hari, label: "Pengeluaran 14 hari" });
  const aktif = kolom.filter((k) => k.v > 0);
  $("rata").textContent = aktif.length ? "rata-rata " + rp(aktif.reduce((a, k) => a + k.v, 0) / aktif.length) + "/hari aktif" : "";
}
let ukuranTerakhir = innerWidth;
addEventListener("resize", () => { if (data && Math.abs(innerWidth - ukuranTerakhir) > 30) { ukuranTerakhir = innerWidth; gambarArus(); gambarHarian(); } });
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
  modeArus = b.dataset.mode;
  let ukuranTerakhir = innerWidth;
addEventListener("resize", () => { if (data && Math.abs(innerWidth - ukuranTerakhir) > 30) { ukuranTerakhir = innerWidth; gambarArus(); gambarHarian(); } });
document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  gambarArus();
}));

// ===== Efek: sorotan kursor, scroll, header =====
function pasangSorotan() {
  document.querySelectorAll(".kartu:not([data-sorot])").forEach((k) => {
    k.dataset.sorot = "1";
    k.addEventListener("pointermove", (e) => { const r = k.getBoundingClientRect(); k.style.setProperty("--x", e.clientX - r.left + "px"); k.style.setProperty("--y", e.clientY - r.top + "px"); });
  });
}
const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("tampak"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }) : null;
document.querySelectorAll(".muncul").forEach((el, i) => { el.style.transitionDelay = Math.min(i, 4) * 60 + "ms"; io ? io.observe(el) : el.classList.add("tampak"); });

let jalan = false;
addEventListener("scroll", () => {
  if (jalan) return; jalan = true;
  requestAnimationFrame(() => {
    const y = scrollY, maks = document.documentElement.scrollHeight - innerHeight;
    $("progres").style.transform = `scaleX(${maks > 0 ? y / maks : 0})`;
    $("bar").classList.toggle("kecil", y > 40);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {

    }
    jalan = false;
  });
}, { passive: true });

// ===== Kalkulator =====
function bacaAngka(s) {
  const m = String(s).toLowerCase().replace(/\s/g, "").match(/^(\d+(?:[.,]\d+)*)(rb|ribu|k|jt|juta)?$/);
  if (!m) return 0;
  if (m[2]) { const dm = m[1].match(/^(\d+)[.,](\d{1,2})$/); const v = dm ? parseFloat(dm[1] + "." + dm[2]) : parseInt(m[1].replace(/[.,]/g, ""), 10); return Math.round(v * (m[2].startsWith("j") ? 1e6 : 1e3)); }
  return parseInt(m[1].replace(/[.,]/g, ""), 10);
}
function rencanaBudget(gaji) {
  const bulat = (n) => Math.round(n / 1000) * 1000;
  let hidup = bulat(gaji * 0.15);
  const keluarga = bulat(gaji * 0.1);
  let keinginan = bulat(gaji * 0.05), darurat = bulat(gaji * 0.1);
  let invest = gaji - hidup - keluarga - keinginan - darurat;
  const maks = bulat(gaji * 0.5), min = bulat(gaji * 0.3);
  if (invest > maks) { darurat += invest - maks; invest = maks; }
  if (invest < min) {
    let kurang = min - invest;
    const a = Math.min(kurang, Math.max(0, keinginan - bulat(gaji * 0.02))); keinginan -= a; kurang -= a;
    const c = Math.min(kurang, Math.max(0, darurat - bulat(gaji * 0.05))); darurat -= c; kurang -= c;
    hidup -= kurang; invest = min;
  }
  return [
    { pos: "Investasi", isi: "ETF, saham, reksadana", n: invest },
    { pos: "Dana darurat", isi: "likuiditas + device & tool", n: darurat },
    { pos: "Biaya hidup", isi: "makan, minum, transport, tagihan", n: hidup },
    { pos: "Keluarga", isi: "kirim ortu, jatah preman", n: keluarga },
    { pos: "Keinginan", isi: "belanja, hiburan, mainan", n: keinginan },
  ];
}
function tabelKalku() {
  const g = bacaAngka($("gajiIn").value);
  if (!g) { $("tabelKalku").innerHTML = ""; return; }
  const r = rencanaBudget(g);
  $("tabelKalku").innerHTML = `<table><thead><tr><th>Pos</th><th class="r">%</th><th class="r">Nominal</th></tr></thead>
    <tbody>${r.map((x) => `<tr><td>${x.pos}<small>${x.isi}</small></td><td class="r">${Math.round((x.n / g) * 100)}%</td><td class="r">${rp(x.n)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td>Total</td><td class="r">100%</td><td class="r">${rp(g)}</td></tr></tfoot></table>
    <p class="ket" style="margin:10px 0 0">Indikator: hemat &lt; ${rpPendek(g * 0.1)} · normal ≤ ${rpPendek(g * 0.15)} · boncos &gt; ${rpPendek(g * 0.2)}. Batas harian ${rp(Math.floor(r[2].n / 30 / 1000) * 1000)}.</p>`;
}
$("btnKalku").addEventListener("click", () => {
  if (data?.terkunci) return bukaPin("Kalku memakai data gaji. Masukkan PIN untuk membukanya."); $("gajiIn").value = data?.status?.gaji ? String(data.status.gaji) : ""; $("infoKalku").textContent = ""; tabelKalku(); $("dlgKalku").showModal(); });
$("gajiIn").addEventListener("input", tabelKalku);
$("btnSimpanGaji").addEventListener("click", async () => {
  const g = bacaAngka($("gajiIn").value);
  if (!g) { $("infoKalku").textContent = "Isi gaji dulu, mis. 9jt"; return; }
  $("infoKalku").textContent = "Menyimpan…";
  try { const r = await api("gaji", { nilai: g }); $("infoKalku").textContent = r.status === 200 ? "Tersimpan ✓ (untuk mencatat sebagai penghasilan, kirim “gaji 9jt” di WA)" : "Gagal menyimpan."; if (r.status === 200) muat(); }
  catch (e) { $("infoKalku").textContent = "Gagal menyimpan."; }
});
$("live").addEventListener("click", muat);
let waktuSembunyi = 0;
document.addEventListener("visibilitychange", async () => {
  if (document.hidden) { waktuSembunyi = Date.now(); return; }
  if (!token) return;
  if (data && !data.terkunci && waktuSembunyi && Date.now() - waktuSembunyi > 60000) { try { await api("kunci"); } catch (e) {} }
  muat();
});

// ===== PIN: buka / kunci bagian rahasia =====
function bukaPin(ket) {
  $("pinIn").value = ""; $("infoPin").textContent = ""; $("infoPin").classList.remove("err");
  const pinSiap = data?.pinSiap !== false, adaPin = pinSiap && data?.adaPin !== false;
  $("pinKet").innerHTML = !pinSiap ? "Fitur PIN belum aktif: database belum di-upgrade. Jalankan <b>upgrade-v3c-pin.sql</b> di Supabase › SQL Editor, lalu muat ulang."
    : adaPin ? esc(ket || "Investasi, gaji & utang terkunci. Masukkan PIN 6 angka.")
    : "Kamu belum punya PIN. Kirim <b>pin</b> + 6 angka rahasiamu ke bot WA, lalu coba lagi.";
  $("pinIn").disabled = !adaPin; $("btnBuka").disabled = !adaPin;
  $("dlgPin").showModal();
  if (adaPin) setTimeout(() => $("pinIn").focus(), 50);
}
$("btnKunci").addEventListener("click", async () => {
  if (!data) return;
  if (data.terkunci) return bukaPin();
  try { await api("kunci"); } catch (e) {}
  muat();
});
document.addEventListener("click", (e) => {
  if (!data?.terkunci) return;
  if (e.target.closest("[data-buka]") || e.target.closest(".terkunci-ui [data-rahasia]")) bukaPin();
});
$("btnBatalPin").addEventListener("click", () => $("dlgPin").close());
$("pinIn").addEventListener("input", () => {
  $("pinIn").value = $("pinIn").value.replace(/\D/g, "").slice(0, 6);
  if ($("pinIn").value.length === 6) $("formPin").requestSubmit();
});
$("formPin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pin = $("pinIn").value;
  if (pin.length !== 6) { $("infoPin").textContent = "PIN harus 6 angka."; $("infoPin").classList.add("err"); return; }
  $("btnBuka").disabled = true; $("infoPin").classList.remove("err"); $("infoPin").textContent = "Memeriksa…";
  try {
    const r = await api("buka", { pin });
    if (r.status === 200) { $("dlgPin").close(); $("pinIn").value = ""; await muat(); }
    else {
      const salah = { 401: `PIN salah. Sisa ${r.data.sisa} percobaan.`, 409: "Belum ada PIN. Buat lewat WA: kirim pin + 6 angka.", 400: "PIN harus 6 angka." };
      $("infoPin").textContent = r.status === 429 ? `Terlalu banyak salah. Coba lagi setelah ${jam(r.data.sampai)}.` : (salah[r.status] || "Gagal membuka.");
      $("infoPin").classList.add("err"); $("pinIn").value = "";
      $("pinIn").classList.remove("goyang"); void $("pinIn").offsetWidth; $("pinIn").classList.add("goyang");
    }
  } catch (e2) { $("infoPin").textContent = "Tidak bisa terhubung."; $("infoPin").classList.add("err"); }
  $("btnBuka").disabled = false;
});

// ===== PWA =====
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));

// ===== Mulai =====
if (token) mulai(); else tampilLogin("");
