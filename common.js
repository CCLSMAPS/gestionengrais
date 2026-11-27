// مشترك بين كل الصفحات: غيّر إعدادات Supabase هنا مرة واحدة فقط
// ===== أدخل بيانات مشروعك هنا (Project Settings > API) =====
const SUPABASE_URL = "https://ibznldpkdrqgcdnrxwnj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imliem5sZHBrZHJxZ2NkbnJ4d25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5OTUwODUsImV4cCI6MjExMDU3MTA4NX0.LUyefDjCMWnac-cytLMkmOOLIPtgr0GdsPTWAqewJfw";
// النطاق الذي يُضاف تلقائيا لاسم المستخدم (admin تصبح admin@cclsadrar.com)
const EMAIL_DOMAIN = "cclsadrar.com";
// رصيد أقل من هذا الحد (بالقنطار) يظهر بلون تحذيري (يمكن تخصيصه من الإعدادات)
const LOW_STOCK_KEY = "ccls_low_stock_threshold";
const DEFAULT_LOW_STOCK = 5;
const THEME_KEY = "ccls_theme";
const APP_SETTINGS_KEY = "ccls_app_settings";
const APP_VERSION = "2.4.0";

const DEFAULT_APP_SETTINGS = {
  theme: "auto",
  density: "comfortable",
  decimals: 2,
  numberLocale: "fr-FR",
  threshold: DEFAULT_LOW_STOCK,
  expiryAlertDays: 30,
  unitLabel: "قنطار",
  orgName: "الديوان الجزائري المهني للحبوب - تعاونية الحبوب والبقول الجافة أدرار (CCLS ADRAR)",
  orgCity: "أدرار",
  activeCampaign: "2026/2027",
  reportFooter: "نظام تسيير مخزون الأسمدة - CCLS ADRAR",
  printShowLogo: true,
  printOrientation: "landscape",
  blockOverWithdraw: true,
  enableQueueAppointments: true,
  enableFarmerNotifications: true,
  notifyChannelDefault: "whatsapp",
  notifyTplInvoice: "تعاونية CCLS أدرار: السيد {farmer}، فاتورتكم رقم {invoice} ({product} - {qty} قنطار) جاهزة للسحب من المخزن.",
  notifyTplArrival: "تعاونية CCLS أدرار: السيد {farmer}، نُعلمكم بوصول سماد {product} للمخزن ويمكنكم التقدم للسحب وفق فاتورتكم رقم {invoice}.",
  notifyTplQueue: "تعاونية CCLS أدرار: السيد {farmer}، تم تحديد موعدكم للسحب يوم {date} برقم الدور ({queue}) في {warehouse}.",
  soundFeedback: false,
  autoLogoutMin: 0
};

function getAppSettings() {
  const merged = { ...DEFAULT_APP_SETTINGS };
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        Object.assign(merged, parsed);
      }
    }
    const legacyThreshold = localStorage.getItem(LOW_STOCK_KEY);
    if (legacyThreshold !== null && legacyThreshold !== "" && !raw) {
      const v = Number(legacyThreshold);
      if (Number.isFinite(v) && v >= 0) merged.threshold = v;
    }
    const legacyTheme = localStorage.getItem(THEME_KEY);
    if ((legacyTheme === "light" || legacyTheme === "dark" || legacyTheme === "auto") && !raw) {
      merged.theme = legacyTheme;
    }
  } catch (_) {}
  merged.threshold = Number.isFinite(Number(merged.threshold)) && Number(merged.threshold) >= 0 ? Number(merged.threshold) : DEFAULT_LOW_STOCK;
  merged.expiryAlertDays = Number.isFinite(Number(merged.expiryAlertDays)) && Number(merged.expiryAlertDays) >= 1 ? Number(merged.expiryAlertDays) : 30;
  merged.decimals = [0, 1, 2].includes(Number(merged.decimals)) ? Number(merged.decimals) : 2;
  merged.autoLogoutMin = [0, 15, 30, 60].includes(Number(merged.autoLogoutMin)) ? Number(merged.autoLogoutMin) : 0;
  merged.numberLocale = merged.numberLocale === "ar-DZ" ? "ar-DZ" : "fr-FR";
  merged.density = merged.density === "compact" ? "compact" : "comfortable";
  merged.printOrientation = merged.printOrientation === "portrait" ? "portrait" : "landscape";
  merged.printShowLogo = merged.printShowLogo !== false;
  merged.blockOverWithdraw = merged.blockOverWithdraw !== false;
  merged.enableQueueAppointments = merged.enableQueueAppointments !== false;
  merged.enableFarmerNotifications = merged.enableFarmerNotifications !== false;
  merged.notifyChannelDefault = merged.notifyChannelDefault === "sms" ? "sms" : "whatsapp";
  merged.notifyTplInvoice = String(merged.notifyTplInvoice || DEFAULT_APP_SETTINGS.notifyTplInvoice);
  merged.notifyTplArrival = String(merged.notifyTplArrival || DEFAULT_APP_SETTINGS.notifyTplArrival);
  merged.notifyTplQueue = String(merged.notifyTplQueue || DEFAULT_APP_SETTINGS.notifyTplQueue);
  merged.soundFeedback = merged.soundFeedback === true;
  return merged;
}

function saveAppSettings(patch) {
  const next = { ...getAppSettings(), ...(patch || {}) };
  try {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next));
    localStorage.setItem(LOW_STOCK_KEY, String(next.threshold));
    localStorage.setItem(THEME_KEY, next.theme);
  } catch (_) {}
  applyVisualSettings(next);
  window.dispatchEvent(new CustomEvent("ccls:settings-change", { detail: next }));
  return next;
}

function resetAppSettings() {
  try {
    localStorage.removeItem(APP_SETTINGS_KEY);
    localStorage.setItem(LOW_STOCK_KEY, String(DEFAULT_LOW_STOCK));
    localStorage.setItem(THEME_KEY, "auto");
  } catch (_) {}
  const fresh = getAppSettings();
  applyVisualSettings(fresh);
  window.dispatchEvent(new CustomEvent("ccls:settings-change", { detail: fresh }));
  window.dispatchEvent(new CustomEvent("ccls:threshold-change", { detail: fresh.threshold }));
  return fresh;
}

function applyVisualSettings(settings) {
  const s = settings || getAppSettings();
  if (typeof document !== "undefined" && document.documentElement) {
    if (s.density === "compact") document.documentElement.setAttribute("data-density", "compact");
    else document.documentElement.removeAttribute("data-density");
    if (s.theme === "light" || s.theme === "dark") document.documentElement.setAttribute("data-theme", s.theme);
    else document.documentElement.removeAttribute("data-theme");
  }
}

function getLowStockThreshold() {
  try {
    const raw = localStorage.getItem(LOW_STOCK_KEY);
    if (raw !== null && raw !== "") {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0) return v;
    }
  } catch (_) {}
  return getAppSettings().threshold;
}

window.getAppSettings = getAppSettings;
window.saveAppSettings = saveAppSettings;
window.resetAppSettings = resetAppSettings;

function normalizeDzPhone(raw) {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (!digits) return { local: "", intl: "" };
  if (digits.startsWith("00213")) {
    const core = digits.slice(5);
    return core.length >= 8 ? { local: "0" + core, intl: "213" + core } : { local: "", intl: "" };
  }
  if (digits.startsWith("213")) {
    const core = digits.slice(3);
    return core.length >= 8 ? { local: "0" + core, intl: "213" + core } : { local: "", intl: "" };
  }
  if (digits.startsWith("0") && digits.length >= 9) {
    return { local: digits, intl: "213" + digits.slice(1) };
  }
  if (digits.length >= 8) {
    return { local: digits, intl: digits.length === 9 ? "213" + digits : digits };
  }
  return { local: "", intl: "" };
}

function renderNotificationMessage(templateKey, vars = {}) {
  const s = getAppSettings();
  const tpl = templateKey === "arrival"
    ? s.notifyTplArrival
    : templateKey === "queue"
    ? s.notifyTplQueue
    : s.notifyTplInvoice;
  return String(tpl || "")
    .replace(/\{farmer\}/g, String(vars.farmer || "الفلاح الكريم"))
    .replace(/\{invoice\}/g, String(vars.invoice || "—"))
    .replace(/\{product\}/g, String(vars.product || "السماد"))
    .replace(/\{qty\}/g, String(vars.qty ?? "—"))
    .replace(/\{date\}/g, String(vars.date || today()))
    .replace(/\{queue\}/g, String(vars.queue ?? "—"))
    .replace(/\{warehouse\}/g, String(vars.warehouse || "المخزن الرئيسي"));
}

function buildFarmerNotificationLinks({ phone, message }) {
  const parsed = normalizeDzPhone(phone);
  const text = String(message || "").trim();
  const waUrl = parsed.intl
    ? `https://wa.me/${encodeURIComponent(parsed.intl)}?text=${encodeURIComponent(text)}`
    : "";
  const smsUrl = parsed.local
    ? `sms:${encodeURIComponent(parsed.local)}?body=${encodeURIComponent(text)}`
    : "";
  return {
    cleanPhone: parsed.local,
    intlPhone: parsed.intl,
    waUrl,
    smsUrl
  };
}

async function dispatchFarmerNotification({
  farmer_name,
  phone,
  channel,
  event_type,
  message,
  invoice_no = null,
  product_name = null
}) {
  const s = getAppSettings();
  if (!s.enableFarmerNotifications) {
    throw new Error("نظام إشعارات الفلاحين متوقف حالياً من الإعدادات");
  }
  const ch = channel === "sms" ? "sms" : "whatsapp";
  const links = buildFarmerNotificationLinks({ phone, message });
  if (!links.cleanPhone) {
    throw new Error("رقم هاتف الفلاح غير صالح للإرسال");
  }

  let webhookSent = false;
  try {
    const sess = await sb.auth.getSession();
    const token = sess?.data?.session?.access_token;
    if (token && typeof fetch === "function") {
      const resp = await fetch("/api/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          farmer_name,
          phone: links.intlPhone,
          channel: ch,
          event_type,
          message
        })
      });
      if (resp.ok) {
        const resJson = await resp.json();
        webhookSent = resJson?.mode === "webhook_sent";
      }
    }
  } catch (_) {}

  const record = {
    farmer_name: String(farmer_name || "فلاح").trim(),
    phone: links.cleanPhone,
    channel: ch,
    event_type: String(event_type || "invoice_ready"),
    message: String(message || "").trim(),
    invoice_no: invoice_no ? String(invoice_no) : null,
    product_name: product_name ? String(product_name) : null,
    status: webhookSent ? "sent_gateway" : "prepared_link",
    created_by: ME?.full_name || ME?.email || null
  };

  let savedDb = false;
  try {
    const { data, error } = await sb.from("farmer_notifications").insert(record).select().single();
    if (!error && data) {
      savedDb = true;
    }
  } catch (_) {}

  if (!savedDb) {
    try {
      const key = "ccls_farmer_notifications_v1";
      const cur = JSON.parse(localStorage.getItem(key) || "[]");
      const list = Array.isArray(cur) ? cur : [];
      list.push({ id: Date.now(), created_at: new Date().toISOString(), ...record });
      localStorage.setItem(key, JSON.stringify(list.slice(-200)));
    } catch (_) {}
  }

  return { ...links, webhookSent, savedDb };
}

window.normalizeDzPhone = normalizeDzPhone;
window.renderNotificationMessage = renderNotificationMessage;
window.buildFarmerNotificationLinks = buildFarmerNotificationLinks;
window.dispatchFarmerNotification = dispatchFarmerNotification;

// ===========================================================
// الحذف الناعم وسلة المحذوفات (Soft Delete & Recycle Bin)
// ===========================================================
const RECYCLE_BIN_KEY = "ccls_recycle_bin_v1";
const INVOICE_NOTES_KEY = "ccls_invoice_notes_v1";
const SESSION_KEY_STORE = "ccls_active_session_key";

function readLocalRecycleBin() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECYCLE_BIN_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}
function writeLocalRecycleBin(rows) {
  try { localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify((rows || []).slice(0, 300))); } catch (_) {}
}

function stripNonColumnFields(obj) {
  if (!obj || typeof obj !== "object") return {};
  const copy = { ...obj };
  delete copy.products;
  delete copy.invoices;
  delete copy.warehouses;
  return copy;
}

async function softDeleteItem({
  entityType,
  tableName,
  entityLabel,
  originalId,
  payload,
  localOnly = false
}) {
  const cleanPayload = stripNonColumnFields(payload || {});
  const origIdStr = String(originalId ?? cleanPayload.id ?? "");

  if (!localOnly && tableName && origIdStr) {
    const { error: delErr } = await sb.from(tableName).delete().eq("id", originalId ?? cleanPayload.id);
    if (delErr) {
      return { ok: false, error: delErr };
    }
  }

  const binRecord = {
    entity_type: String(entityType || tableName || "record"),
    entity_table: String(tableName || ""),
    entity_label: String(entityLabel || origIdStr || "سجل محذوف"),
    original_id: origIdStr || null,
    payload: cleanPayload,
    deleted_by: ME?.full_name || ME?.email || "مستخدم",
    deleted_at: new Date().toISOString()
  };

  let savedRemote = false;
  let finalEntry = { id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...binRecord, _localOnly: true };
  try {
    const { data, error } = await sb.from("recycle_bin").insert(binRecord).select().single();
    if (!error && data) {
      savedRemote = true;
      finalEntry = data;
    }
  } catch (_) {}

  const cur = readLocalRecycleBin();
  cur.unshift(finalEntry);
  writeLocalRecycleBin(cur);
  return { ok: true, savedRemote, item: finalEntry };
}

async function readRecycleBin() {
  const localRows = readLocalRecycleBin().filter(x => !x.restored_at);
  try {
    const { data, error } = await sb
      .from("recycle_bin")
      .select("*")
      .is("restored_at", null)
      .order("deleted_at", { ascending: false })
      .limit(300);
    if (!error && Array.isArray(data)) {
      const remoteIds = new Set(data.map(x => `${x.entity_table}|${x.original_id}|${x.deleted_at}`));
      const extraLocal = localRows.filter(x => x._localOnly && !remoteIds.has(`${x.entity_table}|${x.original_id}|${x.deleted_at}`));
      const merged = [...data, ...extraLocal].sort((a, b) =>
        String(b.deleted_at || "").localeCompare(String(a.deleted_at || ""))
      );
      return { rows: merged, remote: true };
    }
  } catch (_) {}
  return { rows: localRows, remote: false };
}

function syncLocalCacheAfterRestore(tableName, restoredRow) {
  const mapKey = {
    stock_adjustments: "ccls_stock_adjustments_v1",
    warehouse_transfers: "ccls_warehouse_transfers_v1",
    drivers_registry: "ccls_drivers_registry_v1",
    bon_sorties: "ccls_bons_2026_2027",
    dossier_receptions: "ccls_dossiers_2026_2027",
    pickup_appointments: "ccls_pickup_queue_v1",
    invoice_notes: INVOICE_NOTES_KEY
  }[tableName];
  if (!mapKey || !restoredRow) return;
  try {
    const cur = JSON.parse(localStorage.getItem(mapKey) || "[]");
    const list = Array.isArray(cur) ? cur : [];
    if (!list.some(x => String(x.id) === String(restoredRow.id))) {
      list.unshift(restoredRow);
      localStorage.setItem(mapKey, JSON.stringify(list));
    }
  } catch (_) {}
}

async function restoreRecycleItem(binItem) {
  if (!binItem || !binItem.entity_table) return { ok: false, error: { message: "سجل غير صالح للاسترجاع" } };
  const tableName = binItem.entity_table;
  const clean = stripNonColumnFields(binItem.payload || {});
  let restoredRow = { ...clean };

  const localOnlyTables = new Set();
  let insertedRemote = false;
  if (!localOnlyTables.has(tableName)) {
    try {
      let { data, error } = await sb.from(tableName).insert(clean).select().single();
      if (error && error.code === "23505") {
        const { id, ...withoutId } = clean;
        const retry = await sb.from(tableName).insert(withoutId).select().single();
        data = retry.data;
        error = retry.error;
      }
      if (!error && data) {
        insertedRemote = true;
        restoredRow = data;
      } else if (error && !/does not exist|relation/i.test(error.message || "")) {
        return { ok: false, error };
      }
    } catch (_) {}
  }

  if (!insertedRemote) {
    if (!restoredRow.id) restoredRow.id = Date.now();
  }
  syncLocalCacheAfterRestore(tableName, restoredRow);

  if (binItem.id && !String(binItem.id).startsWith("local-")) {
    try {
      await sb.from("recycle_bin").update({
        restored_at: new Date().toISOString(),
        restored_by: ME?.full_name || ME?.email || "مستخدم"
      }).eq("id", binItem.id);
    } catch (_) {}
  }
  const localLeft = readLocalRecycleBin().filter(x => String(x.id) !== String(binItem.id));
  writeLocalRecycleBin(localLeft);
  return { ok: true, restoredRow };
}

async function purgeRecycleItem(binItem) {
  if (!binItem) return { ok: false };
  if (binItem.id && !String(binItem.id).startsWith("local-")) {
    const { error } = await sb.from("recycle_bin").delete().eq("id", binItem.id);
    if (error) return { ok: false, error };
  }
  const localLeft = readLocalRecycleBin().filter(x => String(x.id) !== String(binItem.id));
  writeLocalRecycleBin(localLeft);
  return { ok: true };
}

window.softDeleteItem = softDeleteItem;
window.readRecycleBin = readRecycleBin;
window.restoreRecycleItem = restoreRecycleItem;
window.purgeRecycleItem = purgeRecycleItem;

// ===========================================================
// ملاحظات سريعة (Sticky Notes) على أي فاتورة
// ===========================================================
function readLocalInvoiceNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INVOICE_NOTES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}
function writeLocalInvoiceNotes(rows) {
  try { localStorage.setItem(INVOICE_NOTES_KEY, JSON.stringify((rows || []).slice(0, 400))); } catch (_) {}
}

async function fetchInvoiceNotes(invoiceId = null) {
  let rows = readLocalInvoiceNotes();
  let remote = false;
  try {
    let q = sb.from("invoice_notes").select("*").order("created_at", { ascending: false }).limit(400);
    if (invoiceId != null) q = q.eq("invoice_id", invoiceId);
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      remote = true;
      if (invoiceId == null) {
        rows = data;
        writeLocalInvoiceNotes(data);
      } else {
        rows = data;
      }
    }
  } catch (_) {}
  if (!remote && invoiceId != null) {
    rows = rows.filter(n => String(n.invoice_id) === String(invoiceId));
  }
  return { rows, remote };
}

function ensureStickyNotesModal() {
  if (typeof document === "undefined" || !document.body) return null;
  let modal = document.getElementById("stickyNotesModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "stickyNotesModal";
  modal.className = "sticky-modal-backdrop";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="sticky-modal" role="dialog" aria-modal="true" aria-labelledby="stickyModalTitle">
      <div class="sticky-modal-head">
        <div>
          <h3 id="stickyModalTitle" style="margin:0">ملاحظات الفاتورة</h3>
          <small id="stickyModalSub" style="color:var(--mu)"></small>
        </div>
        <button type="button" class="f" id="closeStickyModalBtn">إغلاق</button>
      </div>
      <form id="stickyNoteForm" style="margin:12px 0;grid-template-columns:1fr auto;gap:8px;align-items:end">
        <label style="grid-column:1/-1;margin:0">إضافة ملاحظة سريعة للفريق
          <textarea id="stickyNoteInput" rows="2" required placeholder="مثال: الفلاح سيُكمل الشحن غداً صباحاً / يرجى مراجعة رقم البطاقة..." style="width:100%;padding:8px 10px;border:1px solid var(--bd);border-radius:8px;background:var(--card);color:var(--tx);font-family:inherit"></textarea>
        </label>
        <label style="margin:0">الأولوية
          <select id="stickyNotePriority">
            <option value="info">معلومة عادية</option>
            <option value="urgent">تنبيه عاجل</option>
            <option value="resolved">تمت المتابعة</option>
          </select>
        </label>
        <button type="submit" class="p" id="addStickyNoteBtn">حفظ الملاحظة</button>
      </form>
      <div id="stickyNotesList" class="sticky-notes-list"></div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", e => {
    if (e.target === modal) modal.hidden = true;
  });
  modal.querySelector("#closeStickyModalBtn").onclick = () => { modal.hidden = true; };
  return modal;
}

async function openInvoiceNotesModal({ invoiceId, invoiceRef = "", farmerName = "", onChange = null }) {
  const modal = ensureStickyNotesModal();
  if (!modal) return;
  modal.hidden = false;
  modal.querySelector("#stickyModalTitle").textContent = `ملاحظات سريعة — فاتورة ${invoiceRef || "#" + invoiceId}`;
  modal.querySelector("#stickyModalSub").textContent = farmerName ? `الفلاح: ${farmerName}` : "تواصل فوري بين المستخدمين على الفاتورة";

  let notes = [];
  let hasRemote = false;

  const renderList = () => {
    const box = modal.querySelector("#stickyNotesList");
    if (!notes.length) {
      box.innerHTML = `<p class="empty-state">لا توجد ملاحظات مسجلة على هذه الفاتورة بعد.</p>`;
      return;
    }
    const prioMeta = {
      urgent: ["عاجل", "sticky-card sticky-urgent"],
      resolved: ["تمت المتابعة ✓", "sticky-card sticky-resolved"],
      info: ["معلومة", "sticky-card sticky-info"]
    };
    box.innerHTML = notes.map(note => {
      const pm = prioMeta[note.resolved ? "resolved" : (note.priority || "info")] || prioMeta.info;
      const dt = String(note.created_at || "").slice(0, 16).replace("T", " ");
      return `
        <div class="${pm[1]}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <strong>${esc(note.author_name || "مستخدم")} <small style="color:var(--mu)">(${esc(pm[0])})</small></strong>
            <small style="color:var(--mu)">${esc(dt)}</small>
          </div>
          <p style="margin:0 0 8px;white-space:pre-wrap;font-size:.9rem">${esc(note.note_text)}</p>
          <div class="action-group">
            <button type="button" class="f" data-toggle-note="${esc(note.id)}">${note.resolved ? "إعادة فتح" : "تمت المتابعة ✓"}</button>
            <button type="button" class="f btn-danger" data-del-note="${esc(note.id)}">حذف</button>
          </div>
        </div>`;
    }).join("");
    if (typeof applyActionPermissions === "function") applyActionPermissions(modal);
  };

  const reload = async () => {
    const res = await fetchInvoiceNotes(invoiceId);
    notes = res.rows || [];
    hasRemote = res.remote;
    renderList();
    if (typeof onChange === "function") onChange(notes);
  };

  modal.querySelector("#stickyNoteForm").onsubmit = async e => {
    e.preventDefault();
    const txt = modal.querySelector("#stickyNoteInput").value.trim();
    if (!txt) return;
    const prio = modal.querySelector("#stickyNotePriority").value || "info";
    const row = {
      invoice_id: Number(invoiceId),
      invoice_ref: String(invoiceRef || ""),
      author_name: ME?.full_name || ME?.email || "مستخدم",
      author_role: ROLES[ME?.role] || ME?.role || "",
      priority: prio,
      note_text: txt,
      resolved: prio === "resolved"
    };
    if (hasRemote) {
      const { data, error } = await sb.from("invoice_notes").insert(row).select().single();
      if (!error && data) notes.unshift(data);
      else return toast(error?.message || "تعذّر حفظ الملاحظة", 1);
    } else {
      const localItem = { id: Date.now(), created_at: new Date().toISOString(), ...row };
      notes.unshift(localItem);
      const all = readLocalInvoiceNotes();
      all.unshift(localItem);
      writeLocalInvoiceNotes(all);
    }
    modal.querySelector("#stickyNoteInput").value = "";
    toast("تمت إضافة الملاحظة السريعة");
    renderList();
    if (typeof onChange === "function") onChange(notes);
  };

  modal.querySelector("#stickyNotesList").onclick = async e => {
    const tBtn = e.target.closest("[data-toggle-note]");
    if (tBtn) {
      const id = tBtn.dataset.toggleNote;
      const target = notes.find(x => String(x.id) === String(id));
      if (!target) return;
      const nextRes = !target.resolved;
      if (hasRemote) {
        const { error } = await sb.from("invoice_notes").update({ resolved: nextRes, priority: nextRes ? "resolved" : "info" }).eq("id", target.id);
        if (error) return toast(error.message, 1);
      }
      target.resolved = nextRes;
      target.priority = nextRes ? "resolved" : "info";
      const all = readLocalInvoiceNotes().map(x => String(x.id) === String(id) ? { ...x, resolved: nextRes, priority: target.priority } : x);
      writeLocalInvoiceNotes(all);
      renderList();
      if (typeof onChange === "function") onChange(notes);
      return;
    }
    const dBtn = e.target.closest("[data-del-note]");
    if (dBtn) {
      const id = dBtn.dataset.delNote;
      const target = notes.find(x => String(x.id) === String(id));
      if (!target || !confirm("نقل هذه الملاحظة إلى سلة المحذوفات؟")) return;
      const res = await softDeleteItem({
        entityType: "ملاحظة فاتورة",
        tableName: "invoice_notes",
        entityLabel: `ملاحظة على فاتورة ${target.invoice_ref || target.invoice_id}`,
        originalId: target.id,
        payload: target,
        localOnly: !hasRemote
      });
      if (!res.ok) return toast(res.error?.message || "تعذّر الحذف", 1);
      notes = notes.filter(x => String(x.id) !== String(id));
      writeLocalInvoiceNotes(readLocalInvoiceNotes().filter(x => String(x.id) !== String(id)));
      toast("نُقلت الملاحظة إلى سلة المحذوفات");
      renderList();
      if (typeof onChange === "function") onChange(notes);
    }
  };

  await reload();
}

window.fetchInvoiceNotes = fetchInvoiceNotes;
window.openInvoiceNotesModal = openInvoiceNotesModal;

// ===========================================================
// سجل جلسات المستخدمين ومراقبة الإنهاء عن بُعد
// ===========================================================
function describeDeviceLabel(uaOverride) {
  const ua = uaOverride != null ? String(uaOverride) : (typeof navigator !== "undefined" ? String(navigator.userAgent || "") : "");
  const os = /Windows/i.test(ua) ? "Windows"
    : /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iOS/i.test(ua) ? "iOS"
    : /Mac OS/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux" : "جهاز غير معروف";
  const br = /Edg\//i.test(ua) ? "Edge"
    : /Chrome\//i.test(ua) ? "Chrome"
    : /Firefox\//i.test(ua) ? "Firefox"
    : /Safari\//i.test(ua) ? "Safari" : "متصفح";
  return `${os} · ${br}`;
}

function getOrCreateSessionKey() {
  try {
    if (typeof sessionStorage === "undefined") return "sess-" + Date.now();
    let k = sessionStorage.getItem(SESSION_KEY_STORE);
    if (!k) {
      k = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY_STORE, k);
    }
    return k;
  } catch (_) {
    return "sess-" + Date.now();
  }
}

let sessionHeartbeatTimer = null;
let sessionRevokeAlerted = false;

async function syncUserSessionHeartbeat(statusOverride = "active") {
  try {
    if (!ME?.id || typeof sb?.auth?.getSession !== "function") return;
    const sess = await sb.auth.getSession();
    const token = sess?.data?.session?.access_token;
    if (!token) return;
    const sessionKey = getOrCreateSessionKey();
    const deviceLabel = describeDeviceLabel();
    const nowIso = new Date().toISOString();

    if (typeof fetch === "function") {
      try {
        const resp = await fetch("/api/sessions/heartbeat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            session_key: sessionKey,
            device_label: deviceLabel,
            status: statusOverride
          })
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json?.revoked) {
            return handleRemoteRevocation();
          }
        }
      } catch (_) {}
    }

    // Sync with Supabase user_sessions table if installed
    try {
      const { data: existing } = await sb
        .from("user_sessions")
        .select("id, status")
        .eq("session_key", sessionKey)
        .maybeSingle();
      if (existing && existing.status === "revoked") {
        return handleRemoteRevocation();
      }
      if (existing) {
        const patch = statusOverride === "ended"
          ? { status: "ended", last_seen_at: nowIso, logout_at: nowIso }
          : { last_seen_at: nowIso };
        await sb.from("user_sessions").update(patch).eq("id", existing.id);
      } else if (statusOverride !== "ended") {
        await sb.from("user_sessions").insert({
          session_key: sessionKey,
          user_id: ME.id,
          user_email: ME.email || "",
          full_name: ME.full_name || ME.email || "مستخدم",
          role_code: ME.role || "",
          device_label: deviceLabel,
          user_agent: typeof navigator !== "undefined" ? String(navigator.userAgent || "").slice(0, 180) : "",
          status: "active",
          login_at: nowIso,
          last_seen_at: nowIso
        });
      }
    } catch (_) {}
  } catch (_) {}
}

async function handleRemoteRevocation() {
  if (sessionRevokeAlerted) return;
  sessionRevokeAlerted = true;
  clearInterval(sessionHeartbeatTimer);
  sessionHeartbeatTimer = null;
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(SESSION_KEY_STORE);
  } catch (_) {}
  toast("تم إنهاء هذه الجلسة عن بُعد من طرف مسؤول النظام", 1);
  setTimeout(() => { sb.auth.signOut(); }, 600);
}

function startSessionMonitor() {
  clearInterval(sessionHeartbeatTimer);
  sessionRevokeAlerted = false;
  syncUserSessionHeartbeat("active");
  sessionHeartbeatTimer = setInterval(() => syncUserSessionHeartbeat("active"), 15000);
}

function stopSessionMonitor() {
  clearInterval(sessionHeartbeatTimer);
  sessionHeartbeatTimer = null;
}

window.describeDeviceLabel = describeDeviceLabel;
window.getOrCreateSessionKey = getOrCreateSessionKey;

const PRODUCT_LOSS_PCT_KEY = "ccls_product_loss_pct_v1";
const BON_PHOTOS_KEY = "ccls_bon_photos_v1";

function readProductLossPctMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRODUCT_LOSS_PCT_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveProductLossPctMap(items) {
  const map = readProductLossPctMap();
  (items || []).forEach(p => {
    if (!p) return;
    const pct = Number(p.normal_loss_pct ?? p.normalLossPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return;
    const cleanPct = Number(pct.toFixed(2));
    if (p.id != null && p.id !== "") map[`id:${p.id}`] = cleanPct;
    const nameKey = String(p.name || "").trim().toUpperCase();
    if (nameKey) map[`name:${nameKey}`] = cleanPct;
  });
  try {
    localStorage.setItem(PRODUCT_LOSS_PCT_KEY, JSON.stringify(map));
  } catch (_) {}
  return map;
}

function getProductNormalLossPct(product, fallbackMap) {
  if (product && typeof product === "object") {
    const direct = Number(product.normal_loss_pct);
    if (Number.isFinite(direct) && direct >= 0) return direct;
    const map = fallbackMap || readProductLossPctMap();
    if (product.id != null && Number.isFinite(Number(map[`id:${product.id}`]))) {
      return Number(map[`id:${product.id}`]);
    }
    const nameKey = String(product.name || "").trim().toUpperCase();
    if (nameKey && Number.isFinite(Number(map[`name:${nameKey}`]))) {
      return Number(map[`name:${nameKey}`]);
    }
    return 0;
  }
  const map = fallbackMap || readProductLossPctMap();
  const strKey = String(product || "").trim().toUpperCase();
  if (strKey && Number.isFinite(Number(map[`name:${strKey}`]))) {
    return Number(map[`name:${strKey}`]);
  }
  return 0;
}

function evaluateProductLossTolerance({ lossQty = 0, baselineQty = 0, normalLossPct = 0 } = {}) {
  const loss = Math.max(0, Number(lossQty) || 0);
  const base = Math.max(0, Number(baselineQty) || 0);
  const pct = Math.min(100, Math.max(0, Number(normalLossPct) || 0));
  const allowedQty = Number(((base * pct) / 100).toFixed(4));
  const actualLossPct = base > 0 ? Number(((loss / base) * 100).toFixed(2)) : (loss > 0 ? 100 : 0);
  const hasLoss = loss > 0;
  const hasMargin = pct > 0 && base > 0;
  const withinNormal = hasLoss && hasMargin && loss <= allowedQty + 1e-6;
  const isAbnormal = hasLoss && !withinNormal;
  const excessQty = isAbnormal ? Number(Math.max(0, loss - allowedQty).toFixed(2)) : 0;
  return {
    lossQty: Number(loss.toFixed(2)),
    baselineQty: Number(base.toFixed(2)),
    normalLossPct: Number(pct.toFixed(2)),
    allowedQty: Number(allowedQty.toFixed(2)),
    excessQty,
    actualLossPct,
    hasLoss,
    hasMargin,
    withinNormal,
    isAbnormal
  };
}

window.readProductLossPctMap = readProductLossPctMap;
window.saveProductLossPctMap = saveProductLossPctMap;
window.getProductNormalLossPct = getProductNormalLossPct;
window.evaluateProductLossTolerance = evaluateProductLossTolerance;


// ===========================================================
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today = () => new Date().toISOString().slice(0, 10);
const n = v => {
  const s = getAppSettings();
  return Number(v).toLocaleString(s.numberLocale, { maximumFractionDigits: s.decimals });
};
function applyTheme(mode) {
  const m = mode === "light" || mode === "dark" ? mode : "auto";
  saveAppSettings({ theme: m });
  window.dispatchEvent(new CustomEvent("ccls:theme-change", { detail: m }));
}
applyVisualSettings();

const tbl = (h, rows) => rows.length
  ? `<table><thead><tr>${h.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`
  : `<p class="empty-state">لا توجد بيانات مسجلة لعرضها حالياً.</p>`;

function playFeedbackTone(isErr) {
  try {
    if (!getAppSettings().soundFeedback) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = isErr ? 260 : 660;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch (_) {}
}

let tt;
function toast(m, bad) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = m;
  t.style.background = bad ? "var(--bad)" : "var(--tx)";
  t.style.display = "block";
  clearTimeout(tt);
  tt = setTimeout(() => t.style.display = "none", 3500);
  playFeedbackTone(!!bad);
}

async function loadProducts() {
  const { data } = await sb.from("products").select("name").order("name");
  if ($("#pl")) $("#pl").innerHTML = (data || []).map(p => `<option value="${esc(p.name)}">`).join("");
}
async function productId(name) {
  const clean = String(name || "").trim();
  if (!clean) throw new Error("يرجى إدخال اسم المنتج");
  const { data, error } = await sb.from("products").upsert({ name: clean }, { onConflict: "name" }).select("id").single();
  if (error) throw error;
  return data.id;
}
function csv(name, h, rows) {
  if (!hasBtnPerm("btn:csv")) return toast("ليس لديك صلاحية تصدير ملفات CSV", 1);
  const safeCell = v => {
    const s = String(v ?? "").replace(/\r?\n/g, " ");
    const neutralized = /^[=+\-@\t\r]/.test(s) && !/^-\d+(\.\d+)?$/.test(s) ? "'" + s : s;
    return '"' + neutralized.replace(/"/g, '""') + '"';
  };
  const t = "\ufeff" + [h, ...rows].map(r => r.map(safeCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([t], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ===== مشترك: الاتصال، الصلاحيات، الدخول، التنقل =====
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// المناصب والصلاحيات تأتي من قاعدة البيانات (جداول roles و app_permissions و role_permissions)
const ROLES = {}, PERMS = {}, DEFAULTS = {}, PERM_PAGES = {};
let ADMIN_ROLES = new Set();

const RBAC_V2_MARKER = "rbac:v2";

// صلاحيات الصفحات الصريحة (يمكن تفعيل أو تعطيل كل صفحة للمستخدم)
const PAGE_PERMS = {
  "page:analytics": ["analytics.html", "لوحة التحكم التحليلية"],
  "page:reception": ["reception.html", "1. استقبال الملفات"],
  "page:index": ["index.html", "2. الفواتير والوارد"],
  "page:bons": ["bons.html", "3. أذون الخروج"],
  "page:warehouse": ["warehouse.html", "4. تسيير المخزن"],
  "page:crops": ["crops.html", "5. إحصائيات الزراعات"],
  "page:users": ["users.html", "6. المستخدمون والصلاحيات"]
};

// صلاحيات التحكم في الأزرار والعمليات عبر كامل النظام
const BTN_PERMS = {
  "btn:create": "إضافة وحفظ بيانات جديدة",
  "btn:edit": "تعديل السجلات والكميات",
  "btn:delete": "حذف السجلات",
  "btn:print": "طباعة الوثائق والتقارير",
  "btn:pdf": "تصدير ملفات PDF",
  "btn:csv": "تصدير جداول CSV / Excel",
  "btn:refresh": "تحديث وإعادة تحميل البيانات"
};

// صلاحيات متقدمة إضافية
const FEAT_PERMS = {
  "feat:financials": "عرض الأسعار والقيم المالية (دج)",
  "feat:settings_system": "تعديل إعدادات المؤسسة والمخزون والنسخ الاحتياطي",
  "feat:audit_view": "عرض سجل النشاط والتعديلات"
};

const PAGES = [
  ["analytics.html", "لوحة التحكم", ["index.html", "warehouse.html", "crops.html", "reception.html", "bons.html"]],
  ["reception.html", "1. استقبال الملفات", ["index.html", "reception.html"]],
  ["index.html", "2. الفواتير والوارد", ["index.html"]],
  ["bons.html", "3. أذون الخروج", ["index.html", "warehouse.html", "bons.html"]],
  ["warehouse.html", "4. تسيير المخزن", ["warehouse.html"]],
  ["crops.html", "5. إحصائيات الزراعات", ["index.html", "warehouse.html", "crops.html"]],
  ["users.html", "6. المستخدمون", ["users.html"]]
];

function allKnownPermCodes() {
  return [
    RBAC_V2_MARKER,
    ...Object.keys(PERMS),
    ...Object.keys(PAGE_PERMS),
    ...Object.keys(BTN_PERMS),
    ...Object.keys(FEAT_PERMS)
  ];
}

function isRbacV2(perms) {
  return Array.isArray(perms) && (
    perms.includes(RBAC_V2_MARKER) ||
    perms.some(x => typeof x === "string" && (x.startsWith("page:") || x.startsWith("btn:") || x.startsWith("feat:")))
  );
}

function legacyPageAccess(perms, pageFile) {
  const entry = PAGES.find(p => p[0] === pageFile);
  if (!entry) return false;
  return Object.keys(PERMS).some(k => perms.includes(k) && (PERM_PAGES[k] || []).some(pg => entry[2].includes(pg)));
}

function hasPageAccess(perms, pageFile) {
  if (!Array.isArray(perms) || !perms.length) return false;
  if (isRbacV2(perms)) {
    const entry = Object.entries(PAGE_PERMS).find(([, v]) => v[0] === pageFile);
    return entry ? perms.includes(entry[0]) : false;
  }
  return legacyPageAccess(perms, pageFile);
}

function expandLegacyPermsToV2(perms) {
  if (!Array.isArray(perms)) return [];
  if (isRbacV2(perms)) return [...new Set(perms)];
  const pages = Object.entries(PAGE_PERMS)
    .filter(([, [file]]) => legacyPageAccess(perms, file))
    .map(([code]) => code);
  const btns = perms.length ? Object.keys(BTN_PERMS) : [];
  const feats = perms.length ? Object.keys(FEAT_PERMS) : [];
  return [...new Set([RBAC_V2_MARKER, ...perms, ...pages, ...btns, ...feats])];
}

let ME = null;
let ME_PERMS = [];

function hasBtnPerm(code, perms = ME_PERMS) {
  if (ME && ADMIN_ROLES.has(ME.role)) return true;
  if (!Array.isArray(perms)) return false;
  if (!isRbacV2(perms)) return true;
  return perms.includes(code);
}

function hasFeatPerm(code, perms = ME_PERMS) {
  if (ME && ADMIN_ROLES.has(ME.role)) return true;
  if (!Array.isArray(perms)) return false;
  if (!isRbacV2(perms)) return true;
  return perms.includes(code);
}

window.hasPageAccess = hasPageAccess;
window.hasBtnPerm = hasBtnPerm;
window.hasFeatPerm = hasFeatPerm;
window.expandLegacyPermsToV2 = expandLegacyPermsToV2;
window.RBAC_V2_MARKER = RBAC_V2_MARKER;
window.PAGE_PERMS = PAGE_PERMS;
window.BTN_PERMS = BTN_PERMS;
window.FEAT_PERMS = FEAT_PERMS;

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
  ADMIN_ROLES.forEach(c => DEFAULTS[c] = allKnownPermCodes());
}

// منصب مسؤول = كل الصلاحيات؛ قائمة في permissions = صلاحيات خاصة؛ غير ذلك = صلاحيات المنصب
const permsOf = p => !p || p.is_blocked === true ? [] :
  ADMIN_ROLES.has(p.role) ? allKnownPermCodes() :
  Array.isArray(p.permissions) ? p.permissions : DEFAULTS[p.role] || [];

function applyActionPermissions(root = document) {
  if (!ME) return;
  const isAdmin = ADMIN_ROLES.has(ME.role);
  const canCreate = isAdmin || hasBtnPerm("btn:create");
  const canEdit = isAdmin || hasBtnPerm("btn:edit");
  const canDelete = isAdmin || hasBtnPerm("btn:delete");
  const canPrint = isAdmin || hasBtnPerm("btn:print");
  const canPdf = isAdmin || hasBtnPerm("btn:pdf");
  const canCsv = isAdmin || hasBtnPerm("btn:csv");
  const canRefresh = isAdmin || hasBtnPerm("btn:refresh");
  const canSysSettings = isAdmin || hasFeatPerm("feat:settings_system");

  const toggleEls = (selector, allowed, disableOnly = false) => {
    root.querySelectorAll(selector).forEach(el => {
      if (el.closest("#account")) return;
      if (disableOnly) {
        el.disabled = !allowed;
        if (!allowed) el.title = "غير مصرح بالتعديل حسب صلاحيات حسابك";
      } else {
        el.hidden = !allowed;
        if ("disabled" in el) el.disabled = !allowed;
      }
    });
  };

  toggleEls("[data-del], [data-del-i], [data-del-p], [data-del-r], [data-del-inv], [data-del-log], [data-del-adj], [data-del-queue], [data-del-transfer], [data-del-driver], [data-del-note], [data-purge-bin], [data-act='del'], button.btn-danger", canDelete);
  toggleEls("[data-edit], [data-edit-i], [data-edit-p], [data-edit-r], [data-edit-inv], [data-edit-log], [data-edit-bon], [data-edit-adj], [data-edit-driver], [data-queue-status], [data-toggle-note]", canEdit);
  toggleEls("[data-restore-bin]", canEdit || canCreate);
  toggleEls("[data-revoke-session]", isAdmin);
  toggleEls("input[data-sup-idx]", canEdit, true);
  toggleEls("#wT button[data-id]:not([data-act='del']), #cT button[data-id]:not([data-act='del']), #pT button[data-id]", canEdit);

  toggleEls("#printDashBtn, #printDossiers, #doPrintBtn, #printBonBtn, #printEtatBtn, #printQueueBtn, [data-bon], [data-slip]", canPrint);
  toggleEls("#pdfDashBtn, #pdfDossiers, #pdfSlipBtn, #pdfBonBtn", canPdf);
  toggleEls("#exportCropCsv, #exportRemainingCsv, #exportMonthlyCsv, #exportYoYCsv, #xd, #xb, #xlow, #xi, #xl, #xc, #xAdj, #xQueue, #xTransfers, #xDrivers", canCsv);
  toggleEls("#dashRefresh", canRefresh);

  // Create forms submit buttons (allow save if creating or currently in edit mode with edit permission)
  toggleEls("#addLine, #submitDossierBtn, #submitInvBtn, #submitPickupBtn, #submitReceiptBtn, #submitAdjBtn, #submitQueueBtn, #submitTransferBtn, #submitDriverBtn, #addStickyNoteBtn, #fw button.p, #fc button.p, #fp2 button.p, #fBon button.p, #fu button.p, #fro button.p", canCreate);
  if (!canCreate && !canEdit) {
    toggleEls("#fi button.p, #fp button.p, #fr button.p, #fAdj button.p, #fqApp button.p, #fTransfer button.p, #fDriver button.p", false);
  }
  toggleEls("#fInvEdit button.p, #fLogEdit button.p", canEdit);
  toggleEls("#toggleQueueFeatureBtn, #toggleNotifyFeatureBtn", canSysSettings, true);

  // Explicit data-perm support
  root.querySelectorAll("[data-perm]").forEach(el => {
    const req = el.dataset.perm;
    if (!req) return;
    const allowed = isAdmin || (req.startsWith("feat:") ? hasFeatPerm(req) : hasBtnPerm(req));
    el.hidden = !allowed;
  });

  // System settings restriction inside #account
  const sysSec = $("#cfgSystemGuard");
  if (sysSec) {
    sysSec.querySelectorAll("input, select, button").forEach(el => {
      if (el.id === "cfgTheme") return;
      el.disabled = !canSysSettings;
    });
    const sysNote = $("#cfgSysNote");
    if (sysNote) sysNote.hidden = canSysSettings;
  }
}
window.applyActionPermissions = applyActionPermissions;

const LOGIN_HTML = `<div id="login" class="box" hidden>
  <div class="login-brand">
    <img src="f761c70c-5eb3-4726-ab98-708bc5fb8c35.jfif" alt="شعار CCLS ADRAR" onerror="this.style.display='none'">
    <h2>تسيير مخزون الأسمدة</h2>
    <p>تعاونية الحبوب والبقول الجافة أدرار · CCLS ADRAR</p>
  </div>
  <form id="lf">
    <label>اسم المستخدم<input name="email" type="text" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="مثال: admin"></label>
    <label>كلمة المرور<input name="password" type="password" required placeholder="••••••••"></label>
    <button class="p">دخول إلى النظام</button>
  </form>
</div>
`;

const ACCOUNT_HTML = `<section id="account" hidden>
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--bd)">
    <div>
      <h2 style="margin:0;padding:0;border:0">مركز الإعدادات الاحترافي</h2>
      <span style="color:var(--mu);font-size:.83rem">تخصيص النظام، هوية المؤسسة، تنبيهات المخزون، الأمان، والنسخ الاحتياطي</span>
    </div>
    <span id="cfgVersionBadge" style="color:var(--mu);font-size:.82rem">الإصدار v${APP_VERSION}</span>
  </div>

  <div class="settings-tabs" id="cfgTabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
    <button type="button" class="f" data-cfg-tab="profile" aria-pressed="true">الحساب والأمان</button>
    <button type="button" class="f" data-cfg-tab="org" aria-pressed="false">المؤسسة والطباعة</button>
    <button type="button" class="f" data-cfg-tab="inventory" aria-pressed="false">المخزون والتنبيهات</button>
    <button type="button" class="f" data-cfg-tab="features" aria-pressed="false">المواعيد والإشعارات</button>
    <button type="button" class="f" data-cfg-tab="appearance" aria-pressed="false">المظهر والعرض</button>
    <button type="button" class="f" data-cfg-tab="backup" aria-pressed="false">النسخ الاحتياطي والنظام</button>
  </div>

  <div class="cfg-pane" data-cfg-pane="profile">
    <div class="info" id="cfgProfileSummary" style="margin-bottom:16px"></div>
    <h3>الأمان وكلمة المرور</h3>
    <form id="fa" style="margin-bottom:18px">
      <label>كلمة المرور الجديدة<input name="p1" id="cfgP1" type="password" minlength="6" required autocomplete="new-password"></label>
      <label>تأكيد كلمة المرور<input name="p2" id="cfgP2" type="password" minlength="6" required autocomplete="new-password"></label>
      <button class="p">حفظ كلمة المرور</button>
    </form>
    <div id="cfgPwStrength" style="font-size:.82rem;color:var(--mu);margin:-10px 0 18px"></div>
    <h3>القفل التلقائي للجلسة</h3>
    <form id="fSec">
      <label>تسجيل الخروج تلقائياً عند الخمول
        <select name="autoLogoutMin" id="cfgAutoLogout">
          <option value="0">معطّل (البقاء متصلاً)</option>
          <option value="15">بعد 15 دقيقة</option>
          <option value="30">بعد 30 دقيقة</option>
          <option value="60">بعد 60 دقيقة</option>
        </select>
      </label>
      <button class="p">حفظ إعداد الأمان</button>
    </form>
  </div>

  <div id="cfgSystemGuard">
    <div id="cfgSysNote" class="alert-warn" hidden>ليس لديك صلاحية تعديل إعدادات النظام والمؤسسة؛ يمكنك الاطلاع عليها فقط.</div>

    <div class="cfg-pane" data-cfg-pane="org" hidden>
      <h3>بيانات المؤسسة وهوية التقارير الرسمية</h3>
      <form id="fOrg">
        <label style="grid-column:1/-1">الاسم الرسمي للمؤسسة / التعاونية
          <input name="orgName" id="cfgOrgName" required>
        </label>
        <label>الولاية / الوحدة
          <input name="orgCity" id="cfgOrgCity">
        </label>
        <label>الموسم الفلاحي الافتراضي
          <input name="activeCampaign" id="cfgCampaign" placeholder="2026/2027">
        </label>
        <label style="grid-column:1/-1">تذييل التقارير والمطبوعات
          <input name="reportFooter" id="cfgReportFooter">
        </label>
        <label>اتجاه صفحات تقارير PDF الافتراضي
          <select name="printOrientation" id="cfgPrintOrientation">
            <option value="landscape">أفقي (Landscape A4)</option>
            <option value="portrait">عمودي (Portrait A4)</option>
          </select>
        </label>
        <label style="flex-direction:row;align-items:center;gap:8px;color:var(--tx);padding-top:18px">
          <input type="checkbox" name="printShowLogo" id="cfgShowLogo"> إظهار شعار التعاونية في التقارير المطبوعة
        </label>
        <button class="p">حفظ بيانات المؤسسة</button>
      </form>
    </div>

    <div class="cfg-pane" data-cfg-pane="inventory" hidden>
      <h3>حدود التنبيه وقواعد تسيير المخزون</h3>
      <form id="fs" style="margin-bottom:18px">
        <label>الحد الأدنى للمخزن (Threshold)<input name="threshold" id="cfgThreshold" type="number" step="any" min="0" required></label>
        <label>التنبيه قبل انتهاء الصلاحية (بالأيام)<input name="expiryAlertDays" id="cfgExpiryDays" type="number" min="1" max="365" required></label>
        <label>وحدة القياس الافتراضية
          <select name="unitLabel" id="cfgUnitLabel">
            <option value="قنطار">قنطار (QTX)</option>
            <option value="طن">طن (T)</option>
          </select>
        </label>
        <label style="flex-direction:row;align-items:center;gap:8px;color:var(--tx);padding-top:18px">
          <input type="checkbox" name="blockOverWithdraw" id="cfgBlockOver"> تنبيه ومنع تجاوز الرصيد عند التسليم
        </label>
        <button class="p">حفظ إعدادات المخزون</button>
        <button type="button" class="f" id="resetThreshold">الافتراضي (5)</button>
      </form>
    </div>

    <div class="cfg-pane" data-cfg-pane="features" hidden>
      <h3>نظام المواعيد وإشعارات الفلاحين (SMS / واتساب)</h3>
      <form id="fOps">
        <label style="flex-direction:row;align-items:center;gap:8px;color:var(--tx);grid-column:1/-1">
          <input type="checkbox" name="enableQueueAppointments" id="cfgEnableQueue"> تفعيل نظام المواعيد وأرقام الدور لتخفيف الازدحام أمام المخزن
        </label>
        <label style="flex-direction:row;align-items:center;gap:8px;color:var(--tx);grid-column:1/-1">
          <input type="checkbox" name="enableFarmerNotifications" id="cfgEnableNotify"> تفعيل إشعارات SMS أو واتساب للفلاح (عند جاهزية الفاتورة أو وصول الصنف)
        </label>
        <label>قناة الإرسال الافتراضية
          <select name="notifyChannelDefault" id="cfgNotifyChannel">
            <option value="whatsapp">واتساب (WhatsApp)</option>
            <option value="sms">رسالة نصية (SMS)</option>
          </select>
        </label>
        <label style="grid-column:1/-1">قالب رسالة جاهزية الفاتورة
          <input name="notifyTplInvoice" id="cfgTplInvoice">
        </label>
        <label style="grid-column:1/-1">قالب رسالة وصول الصنف للمخزن
          <input name="notifyTplArrival" id="cfgTplArrival">
        </label>
        <label style="grid-column:1/-1">قالب رسالة الموعد ورقم الدور
          <input name="notifyTplQueue" id="cfgTplQueue">
        </label>
        <button class="p">حفظ إعدادات المزايا التشغيلية</button>
      </form>
    </div>

    <div class="cfg-pane" data-cfg-pane="appearance" hidden>
      <h3>المظهر، الجداول، وتنسيق الأرقام</h3>
      <form id="ft">
        <label>وضع العرض
          <select name="theme" id="cfgTheme">
            <option value="auto">تلقائي (حسب إعدادات الجهاز)</option>
            <option value="light">الوضع الفاتح</option>
            <option value="dark">الوضع الداكن</option>
          </select>
        </label>
        <label>كثافة الجداول والواجهات
          <select name="density" id="cfgDensity">
            <option value="comfortable">مريح (قياسي)</option>
            <option value="compact">مضغوط (لعرض بيانات أكثر)</option>
          </select>
        </label>
        <label>تنسيق الأرقام
          <select name="numberLocale" id="cfgNumLocale">
            <option value="fr-FR">أرقام لاتينية قياسية (1 250,5)</option>
            <option value="ar-DZ">تنسيق الجزائر العربي</option>
          </select>
        </label>
        <label>عدد الخانات العشرية
          <select name="decimals" id="cfgDecimals">
            <option value="0">بدون كسور (0)</option>
            <option value="1">خانة واحدة (0.0)</option>
            <option value="2">خانتان (0.00)</option>
          </select>
        </label>
        <label style="flex-direction:row;align-items:center;gap:8px;color:var(--tx);padding-top:18px">
          <input type="checkbox" name="soundFeedback" id="cfgSound"> تفعيل التنبيه الصوتي الخفيف عند الحفظ
        </label>
        <button class="p">حفظ تفضيلات العرض</button>
      </form>
    </div>

    <div class="cfg-pane" data-cfg-pane="backup" hidden>
      <h3>النسخ الاحتياطي، الاستعادة، وحالة النظام</h3>
      <div class="cards" id="cfgSysCards" style="margin-bottom:14px"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
        <button type="button" class="p" id="backupExportBtn">تصدير نسخة احتياطية JSON</button>
        <label class="f" style="display:inline-flex;flex-direction:row;align-items:center;gap:6px;margin:0;cursor:pointer;padding:9px 14px;border:1px solid var(--bd);border-radius:8px;background:var(--card);color:var(--tx);min-height:42px">
          <span>استيراد نسخة احتياطية JSON</span>
          <input type="file" id="backupImportInput" accept="application/json,.json" hidden>
        </label>
        <button type="button" class="f" id="testConnBtn">فحص الاتصال بقاعدة البيانات</button>
        <button type="button" class="f" id="clearCacheBtn">تنظيف الذاكرة المؤقتة المحلية</button>
        <button type="button" class="f btn-danger" id="resetAllSettingsBtn">استعادة كل الإعدادات الافتراضية</button>
      </div>
      <div id="cfgDiagMsg" class="info" hidden></div>
    </div>
  </div>
</section>`;

function lockForms() {
  document.querySelectorAll("form").forEach(f => {
    const h = f.onsubmit; if (!h) return;
    f.onsubmit = async e => {
      const b = f.querySelector("button.p");
      if (!b) return h.call(f, e);
      if (b.disabled) { e.preventDefault(); return; }
      const t = b.textContent; b.disabled = true; b.textContent = "جارٍ الحفظ...";
      try { await h.call(f, e); } finally { b.disabled = false; b.textContent = t; }
    };
  });
}

function setupIdleAutoLogout() {
  let idleTimer = null;
  const resetTimer = () => {
    clearTimeout(idleTimer);
    const mins = Number(getAppSettings().autoLogoutMin || 0);
    if (!ME || !mins || mins <= 0) return;
    idleTimer = setTimeout(async () => {
      toast("تم تسجيل الخروج تلقائياً بسبب الخمول", 1);
      await sb.auth.signOut();
    }, mins * 60 * 1000);
  };
  ["mousemove", "keydown", "click", "touchstart"].forEach(ev => {
    window.addEventListener(ev, resetTimer, { passive: true });
  });
  window.addEventListener("ccls:settings-change", resetTimer);
  resetTimer();
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
    if (k !== "account" && !byKey[k]) return;
    document.querySelectorAll("main section").forEach(s => s.hidden = true);
    (k === "account" ? ["account"] : byKey[k][2]).forEach(id => { const el = $("#" + id); if (el) el.hidden = false; });
    nav.querySelectorAll("button").forEach(b => b.setAttribute("aria-current", b.dataset.t === k));
    setNavOpen(false);
    if (k !== "account") {
      if ($("#pl")) loadProducts();
      byKey[k][3]();
    } else {
      syncSettingsUI();
    }
    requestAnimationFrame(() => applyActionPermissions());
  }
  nav.querySelectorAll("button").forEach(b => b.onclick = () => show(b.dataset.t));
  window.showAppTab = show;
  $("#menu").onclick = () => setNavOpen(!nav.classList.contains("open"));

  // Auto-apply button permissions whenever tables or UI dynamically re-render
  let permRaf = 0;
  if (typeof MutationObserver !== "undefined" && $("#app")) {
    const obs = new MutationObserver(() => {
      if (permRaf) cancelAnimationFrame(permRaf);
      permRaf = requestAnimationFrame(() => applyActionPermissions($("#app")));
    });
    obs.observe($("#app"), { childList: true, subtree: true });
  }

  $("#lf").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    let user = f.get("email").trim().toLowerCase();
    if (!user.includes("@")) user += "@" + EMAIL_DOMAIN;
    const { error } = await sb.auth.signInWithPassword({ email: user, password: f.get("password") });
    if (error) toast("تعذّر الدخول: " + error.message, 1);
  };
  $("#out").onclick = async () => {
    await syncUserSessionHeartbeat("ended");
    stopSessionMonitor();
    try { if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(SESSION_KEY_STORE); } catch (_) {}
    sb.auth.signOut();
  };

  // Settings tab switching
  $("#cfgTabs").onclick = e => {
    const btn = e.target.closest("[data-cfg-tab]");
    if (!btn) return;
    const target = btn.dataset.cfgTab;
    $("#cfgTabs").querySelectorAll("[data-cfg-tab]").forEach(b => b.setAttribute("aria-pressed", b.dataset.cfgTab === target));
    document.querySelectorAll("#account .cfg-pane").forEach(p => {
      p.hidden = p.dataset.cfgPane !== target;
    });
    if (target === "backup") refreshSystemDiagCards();
  };

  function refreshSystemDiagCards() {
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        if (k.startsWith("ccls_")) bytes += (k.length + (localStorage.getItem(k) || "").length) * 2;
      }
    } catch (_) {}
    const kb = (bytes / 1024).toFixed(1);
    const online = navigator.onLine ? "متصل بالشبكة" : "غير متصل";
    $("#cfgSysCards").innerHTML = [
      ["إصدار النظام", `v${APP_VERSION}`],
      ["حالة الاتصال", online],
      ["البيانات المحلية", `${kb} KB`],
      ["الموسم النشط", getAppSettings().activeCampaign || "2026/2027"]
    ].map(([l, v]) => `<div class="card"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");
  }

  function syncSettingsUI() {
    const s = getAppSettings();
    $("#cfgThreshold").value = s.threshold;
    $("#cfgExpiryDays").value = s.expiryAlertDays;
    $("#cfgUnitLabel").value = s.unitLabel;
    $("#cfgBlockOver").checked = !!s.blockOverWithdraw;

    if ($("#cfgEnableQueue")) $("#cfgEnableQueue").checked = !!s.enableQueueAppointments;
    if ($("#cfgEnableNotify")) $("#cfgEnableNotify").checked = !!s.enableFarmerNotifications;
    if ($("#cfgNotifyChannel")) $("#cfgNotifyChannel").value = s.notifyChannelDefault || "whatsapp";
    if ($("#cfgTplInvoice")) $("#cfgTplInvoice").value = s.notifyTplInvoice || "";
    if ($("#cfgTplArrival")) $("#cfgTplArrival").value = s.notifyTplArrival || "";
    if ($("#cfgTplQueue")) $("#cfgTplQueue").value = s.notifyTplQueue || "";

    $("#cfgTheme").value = s.theme;
    $("#cfgDensity").value = s.density;
    $("#cfgNumLocale").value = s.numberLocale;
    $("#cfgDecimals").value = String(s.decimals);
    $("#cfgSound").checked = !!s.soundFeedback;

    $("#cfgOrgName").value = s.orgName;
    $("#cfgOrgCity").value = s.orgCity;
    $("#cfgCampaign").value = s.activeCampaign;
    $("#cfgReportFooter").value = s.reportFooter;
    $("#cfgPrintOrientation").value = s.printOrientation;
    $("#cfgShowLogo").checked = !!s.printShowLogo;
    $("#cfgAutoLogout").value = String(s.autoLogoutMin || 0);

    const allowedPages = PAGES.filter(p => hasPageAccess(ME_PERMS, p[0])).map(p => p[1]);
    $("#cfgProfileSummary").innerHTML = `
      <div><strong>المستخدم:</strong> ${esc(ME?.full_name || "-")} (<small>${esc((ME?.email || "").split("@")[0] || "-")}</small>)</div>
      <div><strong>المنصب / الدور:</strong> ${esc(ROLES[ME?.role] || ME?.role || "-")}</div>
      <div><strong>الصفحات المفعَّلة (${allowedPages.length}):</strong> ${allowedPages.length ? esc(allowedPages.join(" · ")) : "لا توجد"}</div>
    `;
    refreshSystemDiagCards();
    applyActionPermissions();
  }

  $("#pwb").textContent = "الإعدادات";
  $("#pwb").onclick = () => {
    syncSettingsUI();
    show("account");
  };

  $("#cfgP1").oninput = e => {
    const val = e.target.value || "";
    const meter = $("#cfgPwStrength");
    if (!val) { meter.textContent = ""; return; }
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/\d/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const label = score <= 2 ? "ضعيفة — يُفضّل إضافة أرقام وحروف كبيرة" : score <= 3 ? "متوسطة" : "قوية";
    meter.textContent = `قوة كلمة المرور: ${label}`;
    meter.style.color = score <= 2 ? "var(--bad)" : score <= 3 ? "var(--ac)" : "var(--pr)";
  };

  $("#cfgTheme").onchange = e => {
    applyTheme(e.target.value);
    toast("تم تحديث مظهر الواجهة");
  };
  $("#ft").onsubmit = async e => {
    e.preventDefault();
    saveAppSettings({
      theme: $("#cfgTheme").value,
      density: $("#cfgDensity").value,
      numberLocale: $("#cfgNumLocale").value,
      decimals: Number($("#cfgDecimals").value),
      soundFeedback: $("#cfgSound").checked
    });
    window.dispatchEvent(new CustomEvent("ccls:theme-change", { detail: $("#cfgTheme").value }));
    toast("تم حفظ تفضيلات المظهر والعرض");
  };

  $("#fOrg").onsubmit = async e => {
    e.preventDefault();
    if (!hasFeatPerm("feat:settings_system")) return toast("ليست لديك صلاحية تعديل إعدادات المؤسسة", 1);
    saveAppSettings({
      orgName: $("#cfgOrgName").value.trim() || DEFAULT_APP_SETTINGS.orgName,
      orgCity: $("#cfgOrgCity").value.trim() || "أدرار",
      activeCampaign: $("#cfgCampaign").value.trim() || "2026/2027",
      reportFooter: $("#cfgReportFooter").value.trim() || DEFAULT_APP_SETTINGS.reportFooter,
      printOrientation: $("#cfgPrintOrientation").value,
      printShowLogo: $("#cfgShowLogo").checked
    });
    toast("تم حفظ بيانات المؤسسة والطباعة");
  };

  $("#fs").onsubmit = async e => {
    e.preventDefault();
    if (!hasFeatPerm("feat:settings_system")) return toast("ليست لديك صلاحية تعديل إعدادات المخزون", 1);
    const val = Number($("#cfgThreshold").value);
    const expDays = Number($("#cfgExpiryDays").value);
    if (!Number.isFinite(val) || val < 0) return toast("أدخل قيمة صالحة للحد الأدنى", 1);
    if (!Number.isFinite(expDays) || expDays < 1) return toast("أدخل عدداً صالحاً لأيام التنبيه", 1);
    saveAppSettings({
      threshold: val,
      expiryAlertDays: expDays,
      unitLabel: $("#cfgUnitLabel").value,
      blockOverWithdraw: $("#cfgBlockOver").checked
    });
    window.dispatchEvent(new CustomEvent("ccls:threshold-change", { detail: val }));
    toast(`تم حفظ إعدادات المخزون (الحد الأدنى: ${n(val)} ${getAppSettings().unitLabel})`);
  };
  $("#resetThreshold").onclick = () => {
    if (!hasFeatPerm("feat:settings_system")) return toast("ليست لديك صلاحية تعديل إعدادات المخزون", 1);
    saveAppSettings({ threshold: DEFAULT_LOW_STOCK });
    $("#cfgThreshold").value = DEFAULT_LOW_STOCK;
    window.dispatchEvent(new CustomEvent("ccls:threshold-change", { detail: DEFAULT_LOW_STOCK }));
    toast(`تمت استعادة الحد الأدنى الافتراضي (${DEFAULT_LOW_STOCK})`);
  };

  if ($("#fOps")) {
    $("#fOps").onsubmit = async e => {
      e.preventDefault();
      if (!hasFeatPerm("feat:settings_system")) return toast("ليست لديك صلاحية تعديل إعدادات النظام", 1);
      saveAppSettings({
        enableQueueAppointments: $("#cfgEnableQueue").checked,
        enableFarmerNotifications: $("#cfgEnableNotify").checked,
        notifyChannelDefault: $("#cfgNotifyChannel").value,
        notifyTplInvoice: $("#cfgTplInvoice").value.trim() || DEFAULT_APP_SETTINGS.notifyTplInvoice,
        notifyTplArrival: $("#cfgTplArrival").value.trim() || DEFAULT_APP_SETTINGS.notifyTplArrival,
        notifyTplQueue: $("#cfgTplQueue").value.trim() || DEFAULT_APP_SETTINGS.notifyTplQueue
      });
      toast("تم حفظ إعدادات المواعيد وإشعارات الفلاحين");
    };
  }

  $("#fSec").onsubmit = async e => {
    e.preventDefault();
    saveAppSettings({ autoLogoutMin: Number($("#cfgAutoLogout").value || 0) });
    toast("تم حفظ إعداد القفل التلقائي للجلسة");
  };

  $("#fa").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), p = f.get("p1");
    if (p !== f.get("p2")) return toast("كلمتا المرور غير متطابقتين", 1);
    const { error } = await sb.auth.updateUser({ password: p });
    if (error) return toast(error.message, 1);
    toast("تم تغيير كلمة المرور");
    e.target.reset();
    $("#cfgPwStrength").textContent = "";
  };

  $("#backupExportBtn").onclick = () => {
    if (!hasFeatPerm("feat:settings_system")) return toast("ليست لديك صلاحية النسخ الاحتياطي", 1);
    const keys = [
      APP_SETTINGS_KEY, LOW_STOCK_KEY, THEME_KEY,
      "ccls_dossiers_2026_2027", "ccls_invoice_meta", "ccls_bons_2026_2027", "ccls_stock_in_expiry",
      "ccls_stock_adjustments_v1", "ccls_pickup_queue_v1", "ccls_farmer_notifications_v1",
      "ccls_warehouse_transfers_v1", "ccls_drivers_registry_v1", PRODUCT_LOSS_PCT_KEY, BON_PHOTOS_KEY,
      RECYCLE_BIN_KEY, INVOICE_NOTES_KEY
    ];
    const data = {};
    keys.forEach(k => {
      try { const v = localStorage.getItem(k); if (v !== null) data[k] = v; } catch (_) {}
    });
    const payload = { app: "CCLS ADRAR", version: APP_VERSION, exportedAt: new Date().toISOString(), data };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ccls-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("تم تصدير النسخة الاحتياطية بنجاح");
  };

  $("#backupImportInput").onchange = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!hasFeatPerm("feat:settings_system")) return toast("ليست لديك صلاحية استيراد النسخ الاحتياطية", 1);
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed.data !== "object") throw new Error("ملف النسخة الاحتياطية غير صالح");
      const allowedKeys = new Set([
        APP_SETTINGS_KEY, LOW_STOCK_KEY, THEME_KEY,
        "ccls_dossiers_2026_2027", "ccls_invoice_meta", "ccls_bons_2026_2027", "ccls_stock_in_expiry",
        "ccls_stock_adjustments_v1", "ccls_pickup_queue_v1", "ccls_farmer_notifications_v1",
        "ccls_warehouse_transfers_v1", "ccls_drivers_registry_v1", PRODUCT_LOSS_PCT_KEY, BON_PHOTOS_KEY,
        RECYCLE_BIN_KEY, INVOICE_NOTES_KEY
      ]);
      Object.entries(parsed.data).forEach(([k, v]) => {
        if (allowedKeys.has(k) && typeof v === "string") localStorage.setItem(k, v);
      });
      applyVisualSettings();
      syncSettingsUI();
      toast("تمت استعادة النسخة الاحتياطية بنجاح");
    } catch (err) {
      toast(err?.message || "تعذّر قراءة ملف النسخة الاحتياطية", 1);
    }
  };

  $("#testConnBtn").onclick = async () => {
    const msgEl = $("#cfgDiagMsg");
    msgEl.hidden = false;
    msgEl.textContent = "جارٍ فحص الاتصال بقاعدة البيانات...";
    const t0 = performance.now();
    const { error } = await sb.from("warehouses").select("id").limit(1);
    const ms = Math.round(performance.now() - t0);
    if (error) {
      msgEl.style.color = "var(--bad)";
      msgEl.textContent = `فشل الاتصال: ${error.message}`;
    } else {
      msgEl.style.color = "var(--pr)";
      msgEl.textContent = `الاتصال سليم بقاعدة البيانات (زمن الاستجابة: ${ms} مللي ثانية)`;
    }
  };

  $("#clearCacheBtn").onclick = () => {
    if (!hasFeatPerm("feat:settings_system")) return toast("ليست لديك صلاحية تنظيف الذاكرة المؤقتة", 1);
    if (!confirm("هل تريد حذف البيانات المخزنة مؤقتاً في هذا المتصفح (مع الإبقاء على تسجيل الدخول)؟")) return;
    [
      "ccls_dossiers_2026_2027", "ccls_invoice_meta", "ccls_bons_2026_2027", "ccls_stock_in_expiry",
      "ccls_stock_adjustments_v1", "ccls_pickup_queue_v1", "ccls_farmer_notifications_v1",
      "ccls_warehouse_transfers_v1", "ccls_drivers_registry_v1", PRODUCT_LOSS_PCT_KEY, BON_PHOTOS_KEY,
      RECYCLE_BIN_KEY, INVOICE_NOTES_KEY
    ].forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
    refreshSystemDiagCards();
    toast("تم تنظيف الذاكرة المؤقتة بنجاح");
  };

  $("#resetAllSettingsBtn").onclick = () => {
    if (!hasFeatPerm("feat:settings_system")) return toast("ليست لديك صلاحية استعادة الإعدادات", 1);
    if (!confirm("استعادة جميع إعدادات النظام والمظهر إلى القيم الافتراضية؟")) return;
    resetAppSettings();
    syncSettingsUI();
    toast("تمت استعادة الإعدادات الافتراضية");
  };

  setupIdleAutoLogout();

  async function enter(s) {
    try { await loadCatalog(); } catch (x) { $("#app").hidden = true; $("#cfg").textContent = "تعذّر تحميل المناصب والصلاحيات: " + x.message + " (نفّذ supabase-setup.sql)"; $("#cfg").hidden = false; return; }
    const { data: me } = await sb.from("profiles").select("*").eq("user_id", s.user.id).maybeSingle();
    ME = me ? { ...me, id: s.user.id, email: me.email || s.user.email } : { id: s.user.id, email: s.user.email };
    const P = permsOf(me);
    ME_PERMS = P;
    const currentPageFile = page + ".html";
    const pageAllowed = hasPageAccess(P, currentPageFile);
    const tabMatched = tabs.filter(t => P.includes(t[0]) || (Array.isArray(t[4]) ? t[4].some(x => P.includes(x)) : t[4] && P.includes(t[4])));
    const ok = pageAllowed ? (tabMatched.length ? tabMatched : (isRbacV2(P) ? tabs : [])) : [];

    $("#who").textContent = me ? `${me.full_name} - ${ROLES[me.role] || me.role || ""}` : "";
    $("#links").innerHTML = PAGES.filter(p => hasPageAccess(P, p[0]))
      .map(p => `<a class="lk" href="${p[0]}"${p[0] === currentPageFile ? ' aria-current="page"' : ""}>${p[1]}</a>`).join("");
    nav.querySelectorAll("button").forEach(b => b.hidden = !ok.some(t => t[0] === b.dataset.t));
    if (!ok.length) {
      $("#app").hidden = true;
      $("#cfg").textContent = me?.is_blocked === true
        ? "تم تعليق هذا الحساب من قِبل مسؤول النظام. يرجى مراجعة الإدارة."
        : (P.length ? "ليست لديك صلاحية على هذه الصفحة. استعمل الروابط في أعلى الصفحة." : "حسابك لا يملك صلاحية بعد. راجع مسؤول النظام لتعيين دورك.");
      $("#cfg").hidden = false; return;
    }
    $("#cfg").hidden = true;
    startSessionMonitor();
    if (ready) ready();
    show(ok[0][0]);
    requestAnimationFrame(() => {
      syncHeaderHeight();
      applyActionPermissions();
    });
  }
  sb.auth.onAuthStateChange((_, s) => {
    $("#login").hidden = !!s; $("#app").hidden = !s; $("#out").hidden = !s; $("#pwb").hidden = !s;
    $("#menu").classList.toggle("on", !!s);
    if (!s) {
      stopSessionMonitor();
      ME = null; ME_PERMS = [];
      $("#who").textContent = ""; $("#links").innerHTML = ""; $("#cfg").hidden = true; setNavOpen(false);
      requestAnimationFrame(syncHeaderHeight);
      return;
    }
    setTimeout(() => enter(s), 0);
  });
  lockForms();
}
