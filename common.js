// مشترك بين كل الصفحات: غيّر إعدادات Supabase هنا مرة واحدة فقط
// ===== أدخل بيانات مشروعك هنا (Project Settings > API) =====
const SUPABASE_URL = "https://ibznldpkdrqgcdnrxwnj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imliem5sZHBrZHJxZ2NkbnJ4d25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5OTUwODUsImV4cCI6MjExMDU3MTA4NX0.LUyefDjCMWnac-cytLMkmOOLIPtgr0GdsPTWAqewJfw";
// النطاق الذي يُضاف تلقائيا لاسم المستخدم (admin تصبح admin@cclsadrar.com)
const EMAIL_DOMAIN = "cclsadrar.com";
// رصيد أقل من هذا الحد (بالقنطار) يظهر بلون تحذيري (يمكن تخصيصه من الإعدادات)
const LOW_STOCK_KEY = "ccls_low_stock_threshold";
const DEFAULT_LOW_STOCK = 5;
function getLowStockThreshold() {
  try {
    const raw = localStorage.getItem(LOW_STOCK_KEY);
    if (raw !== null && raw !== "") {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0) return v;
    }
  } catch (_) {}
  return DEFAULT_LOW_STOCK;
}
// ===========================================================
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today = () => new Date().toISOString().slice(0, 10);
const n = v => Number(v).toLocaleString("fr-FR", {maximumFractionDigits: 2});
const tbl = (h, rows) => rows.length
  ? `<table><thead><tr>${h.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`
  : `<p style="color:var(--mu)">لا توجد بيانات بعد.</p>`;
let tt;
function toast(m, bad) {
  const t = $("#toast"); t.textContent = m; t.style.background = bad ? "var(--bad)" : "var(--tx)";
  t.style.display = "block"; clearTimeout(tt); tt = setTimeout(() => t.style.display = "none", 3500);
}
async function loadProducts() {
  const { data } = await sb.from("products").select("name").order("name");
  $("#pl").innerHTML = (data || []).map(p => `<option value="${esc(p.name)}">`).join("");
}
async function productId(name) {
  const { data, error } = await sb.from("products").upsert({ name: name.trim() }, { onConflict: "name" }).select("id").single();
  if (error) throw error;
  return data.id;
}
function csv(name, h, rows) {
  const q = v => '"' + String(v ?? "").replace(/\r?\n/g, " ").replace(/"/g, '""') + '"';
  const t = "\ufeff" + [h, ...rows].map(r => r.map(q).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([t], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}-${today()}.csv`; a.click();
}

// ===== مشترك: الاتصال، الصلاحيات، الدخول، التنقل =====
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// المناصب والصلاحيات تأتي من قاعدة البيانات (جداول roles و app_permissions و role_permissions)
const ROLES = {}, PERMS = {}, DEFAULTS = {}, PERM_PAGES = {};
let ADMIN_ROLES = new Set();
const PAGES = [
  ["reception.html", "1. استقبال الملفات", ["index.html", "reception.html"]],
  ["index.html", "2. الفواتير والوارد", ["index.html"]],
  ["bons.html", "3. أذون الخروج", ["index.html", "warehouse.html", "bons.html"]],
  ["warehouse.html", "4. تسيير المخزن", ["warehouse.html"]],
  ["crops.html", "5. إحصائيات الزراعات", ["index.html", "warehouse.html", "crops.html"]],
  ["users.html", "6. المستخدمون", ["users.html"]]
];
async function loadCatalog() {
  const [r, p, rp] = await Promise.all([
    sb.from("roles").select("*").order("sort_order").order("name"),
    sb.from("app_permissions").select("*").order("sort_order"),
    sb.from("role_permissions").select("*")]);
  const err = r.error || p.error || rp.error; if (err) throw err;
  [ROLES, PERMS, DEFAULTS, PERM_PAGES].forEach(o => { for (const k in o) delete o[k]; });
  ADMIN_ROLES = new Set();
  r.data.forEach(x => { ROLES[x.code] = x.name; DEFAULTS[x.code] = []; if (x.is_admin) ADMIN_ROLES.add(x.code); });
  p.data.forEach(x => { PERMS[x.code] = x.label; PERM_PAGES[x.code] = x.pages || []; });
  rp.data.forEach(x => { (DEFAULTS[x.role_code] ??= []).push(x.perm_code); });
  ADMIN_ROLES.forEach(c => DEFAULTS[c] = Object.keys(PERMS));
}
// منصب مسؤول = كل الصلاحيات؛ قائمة في permissions = صلاحيات خاصة؛ غير ذلك = صلاحيات المنصب
const permsOf = p => !p || p.is_blocked === true ? [] :
  ADMIN_ROLES.has(p.role) ? Object.keys(PERMS) :
  Array.isArray(p.permissions) ? p.permissions : DEFAULTS[p.role] || [];
let ME = null;

const LOGIN_HTML = `<div id="login" class="box" hidden>
  <h2>تسجيل الدخول</h2>
  <form id="lf">
    <label>اسم المستخدم<input name="email" type="text" required autocomplete="username" autocapitalize="none" spellcheck="false"></label>
    <label>كلمة المرور<input name="password" type="password" required></label>
    <button class="p">دخول</button>
  </form>
</div>
`;
const ACCOUNT_HTML = `<section id="account" hidden>
  <h2>الإعدادات - الحد الأدنى للمخزن</h2>
  <form id="fs" style="margin-bottom:18px">
    <label>الحد الأدنى للمخزن (قنطار - Threshold)<input name="threshold" id="cfgThreshold" type="number" step="any" min="0" required></label>
    <button class="p">حفظ الإعدادات</button>
    <button type="button" class="f" id="resetThreshold">الافتراضي (5)</button>
  </form>
  <h2>تغيير كلمة المرور</h2>
  <form id="fa">
    <label>كلمة المرور الجديدة<input name="p1" type="password" minlength="6" required autocomplete="new-password"></label>
    <label>تأكيد كلمة المرور<input name="p2" type="password" minlength="6" required autocomplete="new-password"></label>
    <button class="p">حفظ كلمة المرور</button>
  </form>
</section>`;

function lockForms() {
document.querySelectorAll("form").forEach(f => {
  const h = f.onsubmit; if (!h) return;
  f.onsubmit = async e => {
    const b = f.querySelector("button.p");
    if (b.disabled) { e.preventDefault(); return; }
    const t = b.textContent; b.disabled = true; b.textContent = "جارٍ الحفظ...";
    try { await h.call(f, e); } finally { b.disabled = false; b.textContent = t; }
  };
});
}

function startApp({ page, tabs, ready }) {
  $("main").insertAdjacentHTML("afterbegin", LOGIN_HTML);
  $("#app").insertAdjacentHTML("beforeend", ACCOUNT_HTML);
  const nav = $("nav");
  let backdrop = $(".nav-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    backdrop.hidden = true;
    document.body.appendChild(backdrop);
  }
  const syncHeaderHeight = () => {
    const h = $("header");
    if (h) document.documentElement.style.setProperty("--header-h", `${h.offsetHeight}px`);
  };
  syncHeaderHeight();
  if (typeof ResizeObserver !== "undefined" && $("header")) {
    new ResizeObserver(syncHeaderHeight).observe($("header"));
  }
  window.addEventListener("resize", syncHeaderHeight);

  const setNavOpen = openState => {
    nav.classList.toggle("open", openState);
    backdrop.hidden = !openState;
  };
  backdrop.onclick = () => setNavOpen(false);

  nav.innerHTML = tabs.map(t => `<button data-t="${t[0]}">${t[1]}</button>`).join("");
  const byKey = Object.fromEntries(tabs.map(t => [t[0], t]));

  function show(k) {
    document.querySelectorAll("main section").forEach(s => s.hidden = true);
    (k === "account" ? ["account"] : byKey[k][2]).forEach(id => $("#" + id).hidden = false);
    nav.querySelectorAll("button").forEach(b => b.setAttribute("aria-current", b.dataset.t === k));
    setNavOpen(false);
    if (k !== "account") { if ($("#pl")) loadProducts(); byKey[k][3](); }
  }
  nav.querySelectorAll("button").forEach(b => b.onclick = () => show(b.dataset.t));
  window.showAppTab = show;
  $("#menu").onclick = () => setNavOpen(!nav.classList.contains("open"));

  $("#lf").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    let user = f.get("email").trim().toLowerCase();
    if (!user.includes("@")) user += "@" + EMAIL_DOMAIN;
    const { error } = await sb.auth.signInWithPassword({ email: user, password: f.get("password") });
    if (error) toast("تعذّر الدخول: " + error.message, 1);
  };
  $("#out").onclick = () => sb.auth.signOut();
  $("#pwb").textContent = "الإعدادات";
  $("#pwb").onclick = () => {
    $("#cfgThreshold").value = getLowStockThreshold();
    show("account");
  };
  $("#fs").onsubmit = async e => {
    e.preventDefault();
    const val = Number(new FormData(e.target).get("threshold"));
    if (!Number.isFinite(val) || val < 0) return toast("أدخل قيمة صالحة للحد الأدنى", 1);
    localStorage.setItem(LOW_STOCK_KEY, String(val));
    window.dispatchEvent(new CustomEvent("ccls:threshold-change", { detail: val }));
    toast(`تم حفظ الحد الأدنى للمخزن: ${n(val)} قنطار`);
  };
  $("#resetThreshold").onclick = () => {
    localStorage.setItem(LOW_STOCK_KEY, String(DEFAULT_LOW_STOCK));
    $("#cfgThreshold").value = DEFAULT_LOW_STOCK;
    window.dispatchEvent(new CustomEvent("ccls:threshold-change", { detail: DEFAULT_LOW_STOCK }));
    toast(`تمت استعادة القيمة الافتراضية (${DEFAULT_LOW_STOCK} قنطار)`);
  };
  $("#fa").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), p = f.get("p1");
    if (p !== f.get("p2")) return toast("كلمتا المرور غير متطابقتين", 1);
    const { error } = await sb.auth.updateUser({ password: p });
    if (error) return toast(error.message, 1);
    toast("تم تغيير كلمة المرور"); e.target.reset();
  };

  async function enter(s) {
    try { await loadCatalog(); } catch (x) { $("#app").hidden = true; $("#cfg").textContent = "تعذّر تحميل المناصب والصلاحيات: " + x.message + " (نفّذ supabase-setup.sql)"; $("#cfg").hidden = false; return; }
    const { data: me } = await sb.from("profiles").select("*").eq("user_id", s.user.id).maybeSingle();
    ME = me ? { ...me, id: s.user.id } : { id: s.user.id };
    const P = permsOf(me), ok = tabs.filter(t => P.includes(t[0]) || (Array.isArray(t[4]) ? t[4].some(x => P.includes(x)) : t[4] && P.includes(t[4])));
    $("#who").textContent = me ? `${me.full_name} - ${ROLES[me.role] || me.role || ""}` : "";
    $("#links").innerHTML = PAGES.filter(p =>
      Object.keys(PERMS).some(k => P.includes(k) && (PERM_PAGES[k] || []).some(pg => p[2].includes(pg)))
    )
      .map(p => `<a class="lk" href="${p[0]}"${p[0] === page + ".html" ? ' aria-current="page"' : ""}>${p[1]}</a>`).join("");
    nav.querySelectorAll("button").forEach(b => b.hidden = !ok.some(t => t[0] === b.dataset.t));
    if (!ok.length) {
      $("#app").hidden = true;
      $("#cfg").textContent = P.length ? "ليست لديك صلاحية على هذه الصفحة. استعمل الروابط في أعلى الصفحة." : "حسابك لا يملك صلاحية بعد. راجع مسؤول النظام لتعيين دورك.";
      $("#cfg").hidden = false; return;
    }
    $("#cfg").hidden = true;
    if (ready) ready();
    show(ok[0][0]);
    requestAnimationFrame(syncHeaderHeight);
  }
  sb.auth.onAuthStateChange((_, s) => {
    $("#login").hidden = !!s; $("#app").hidden = !s; $("#out").hidden = !s; $("#pwb").hidden = !s;
    $("#menu").classList.toggle("on", !!s);
    if (!s) { $("#who").textContent = ""; $("#links").innerHTML = ""; $("#cfg").hidden = true; setNavOpen(false); requestAnimationFrame(syncHeaderHeight); return; }
    setTimeout(() => enter(s), 0);
  });
  lockForms();
}
