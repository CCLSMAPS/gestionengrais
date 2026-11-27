import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname);
const DIST_DIR = path.resolve(ROOT_DIR, "dist");
const PUBLIC_ASSETS_DIR = path.resolve(ROOT_DIR, "public", "assets");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ibznldpkdrqgcdnrxwnj.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imliem5sZHBrZHJxZ2NkbnJ4d25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5OTUwODUsImV4cCI6MjExMDU3MTA4NX0.LUyefDjCMWnac-cytLMkmOOLIPtgr0GdsPTWAqewJfw";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DIRECTOR_SECRET = process.env.DIRECTOR_SECRET || crypto.randomBytes(32).toString("hex");
const NOTIFY_WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL || "";
const NOTIFY_WEBHOOK_TOKEN = process.env.NOTIFY_WEBHOOK_TOKEN || "";

app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jfif": "image/jpeg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

const COMPRESSIBLE_EXTS = new Set([".html", ".js", ".css", ".svg", ".json"]);

const ALLOWED_ROOT_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/analytics.html", "analytics.html"],
  ["/reception.html", "reception.html"],
  ["/bons.html", "bons.html"],
  ["/warehouse.html", "warehouse.html"],
  ["/crops.html", "crops.html"],
  ["/users.html", "users.html"],
  ["/dashboard.html", "dashboard.html"],
  ["/director.html", "director.html"],
  ["/verify.html", "verify.html"],
  ["/kiosk.html", "kiosk.html"],
  ["/manifest.json", "manifest.json"],
  ["/common.css", "common.css"],
  ["/common.js", "common.js"],
  ["/dossiers-data.js", "dossiers-data.js"],
  ["/bons-data.js", "bons-data.js"],
  ["/f761c70c-5eb3-4726-ab98-708bc5fb8c35.jfif", "f761c70c-5eb3-4726-ab98-708bc5fb8c35.jfif"],
]);

const ALLOWED_DIST_FILES = new Set([
  "warehouse-chart.js",
  "culture-chart.js",
  "analytics-dashboard.js",
  "dossiers-pdf.js",
]);

const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Content-Security-Policy", CSP_HEADER);
  next();
});

// ===== In-Memory Stores (Sanitized Non-PII Aggregates & Public Bon Summaries) =====
let latestDirectorSnapshot = null;
let latestKioskSnapshot = null;
const publicBonIndex = new Map(); // normalized bon_no -> { bon_no, sortie_date, camp, total_qty, items: [{ designation, qty }] }
const sessionAuditStore = new Map(); // session_key -> session record

function sanitizeDirectorSnapshot(raw) {
  if (!raw || typeof raw !== "object") return null;
  const safeStr = (v, max = 80) => String(v ?? "").trim().slice(0, max);
  const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  };
  const cards = Array.isArray(raw.cards)
    ? raw.cards.slice(0, 10).map((c) => ({
        label: safeStr(c?.label, 90),
        value: safeStr(c?.value, 60),
      }))
    : [];
  const crops = Array.isArray(raw.crops)
    ? raw.crops.slice(0, 20).map((r) => ({
        culture: safeStr(r?.culture, 40),
        invoicedQty: safeNum(r?.invoicedQty),
        withdrawnQty: safeNum(r?.withdrawnQty),
        remainingQty: safeNum(r?.remainingQty),
        invoiceCount: safeNum(r?.invoiceCount),
        topProduct: safeStr(r?.topProduct, 60),
      }))
    : [];
  const stock = Array.isArray(raw.stock)
    ? raw.stock.slice(0, 40).map((s) => ({
        name: safeStr(s?.name, 60),
        warehouse: safeStr(s?.warehouse, 60),
        received: safeNum(s?.received),
        withdrawn: safeNum(s?.withdrawn),
        balance: safeNum(s?.balance),
        unitPriceDzd: safeNum(s?.unitPriceDzd),
        valueDzd: safeNum(s?.valueDzd),
      }))
    : [];
  const stockValuationMonthly = Array.isArray(raw.stockValuationMonthly)
    ? raw.stockValuationMonthly.slice(-24).map((m) => ({
        month: safeStr(m?.month, 16),
        label: safeStr(m?.label, 40),
        qtyBalance: safeNum(m?.qtyBalance),
        valueDzd: safeNum(m?.valueDzd),
      }))
    : [];
  const kpiStats = raw.kpiStats && typeof raw.kpiStats === "object"
    ? {
        avgProcessingDays: safeNum(raw.kpiStats.avgProcessingDays),
        processedDossiersCount: safeNum(raw.kpiStats.processedDossiersCount),
        farmersToday: safeNum(raw.kpiStats.farmersToday),
        avgFarmersPerDay: safeNum(raw.kpiStats.avgFarmersPerDay),
        totalFarmersServed: safeNum(raw.kpiStats.totalFarmersServed),
      }
    : null;
  const adjustments = raw.adjustments && typeof raw.adjustments === "object"
    ? {
        damagedQty: safeNum(raw.adjustments.damagedQty),
        lostQty: safeNum(raw.adjustments.lostQty),
        returnedQty: safeNum(raw.adjustments.returnedQty),
        totalAmountDzd: safeNum(raw.adjustments.totalAmountDzd),
        count: safeNum(raw.adjustments.count),
      }
    : null;

  return {
    orgName: safeStr(raw.orgName || "تعاونية الحبوب والبقول الجافة أدرار (CCLS ADRAR)", 140),
    campaign: safeStr(raw.campaign || "2026/2027", 24),
    unitLabel: safeStr(raw.unitLabel || "قنطار", 20),
    updatedAt: safeStr(raw.updatedAt || new Date().toISOString(), 40),
    threshold: safeNum(raw.threshold ?? 5),
    totalStockValueDzd: safeNum(raw.totalStockValueDzd),
    cards,
    crops,
    stock,
    stockValuationMonthly,
    kpiStats,
    adjustments,
  };
}

function signDirectorToken(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", DIRECTOR_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyDirectorToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", DIRECTOR_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed || parsed.scope !== "director_readonly") return null;
    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isSafeExternalHttpsUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith(".local")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function verifySupabaseUser(req) {
  const auth = String(req.headers.authorization || "");
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token || token.length > 4096) return null;

  try {
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userResp.ok) return null;
    const user = await userResp.json();
    if (!user?.id) return null;

    const profResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=user_id,role,is_blocked,full_name&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    let profile = null;
    if (profResp.ok) {
      const rows = await profResp.json();
      profile = Array.isArray(rows) ? rows[0] || null : null;
    }
    if (profile?.is_blocked === true) return null;
    return { user, profile, token };
  } catch {
    return null;
  }
}

async function isAdminAuth(auth) {
  const role = String(auth?.profile?.role || "").trim().toLowerCase();
  if (!role) return false;
  if (role === "admin") return true;
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/roles?select=is_admin&code=eq.${encodeURIComponent(role)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${auth.token}`,
        },
      }
    );
    if (resp.ok) {
      const rows = await resp.json();
      return Boolean(Array.isArray(rows) && rows[0]?.is_admin);
    }
  } catch (_) {}
  return false;
}

async function fetchLiveDirectorStatsFromSupabase() {
  if (!SUPABASE_SERVICE_ROLE_KEY) return null;
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
  try {
    const [invRes, stockRes, adjRes, stockInRes, wRes, dosRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/invoice_balance?select=id,qty,taken,remaining,culture,product_name,unit_price,dossier_no,farmer_name,client_name&limit=2000`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/stock_analysis?select=name,warehouse,received,withdrawn,balance&limit=1000`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/stock_adjustments?select=adjustment_type,qty,amount_dzd&limit=1000`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/stock_in?select=entry_date,qty,products(name)&order=entry_date.asc&limit=2000`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/withdrawals?select=w_date,qty,invoice_id,invoices(dossier_no,farmer_name,client_name,unit_price,products(name))&order=w_date.asc&limit=2000`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/dossier_receptions?select=dossier_no,farmer_name,reception_date&limit=2000`, { headers }),
    ]);
    if (!invRes.ok || !stockRes.ok) return null;
    const invoices = await invRes.json();
    const stock = await stockRes.json();
    const adjs = adjRes.ok ? await adjRes.json() : [];
    const stockIn = stockInRes.ok ? await stockInRes.json() : [];
    const withdrawals = wRes.ok ? await wRes.json() : [];
    const dossiers = dosRes.ok ? await dosRes.json() : [];

    // Weighted avg unit price per product
    const priceAcc = new Map();
    for (const inv of invoices || []) {
      const pName = String(inv.product_name || "").trim().toUpperCase();
      const up = Number(inv.unit_price || 0);
      const q = Number(inv.qty || 1);
      if (pName && up > 0) {
        const cur = priceAcc.get(pName) || { sum: 0, w: 0 };
        cur.sum += up * (q > 0 ? q : 1);
        cur.w += q > 0 ? q : 1;
        priceAcc.set(pName, cur);
      }
    }
    const priceOf = (name) => {
      const entry = priceAcc.get(String(name || "").trim().toUpperCase());
      return entry && entry.w > 0 ? entry.sum / entry.w : 0;
    };

    const enrichedStock = (stock || []).map((s) => {
      const bal = Number(s.balance || 0);
      const up = priceOf(s.name);
      return {
        ...s,
        unitPriceDzd: Number(up.toFixed(2)),
        valueDzd: Number((Math.max(0, bal) * up).toFixed(2)),
      };
    });

    const totalStock = enrichedStock.reduce((s, r) => s + Number(r.balance || 0), 0);
    const totalStockValueDzd = enrichedStock.reduce((s, r) => s + Number(r.valueDzd || 0), 0);
    const totalWithdrawn = (invoices || []).reduce((s, r) => s + Number(r.taken || 0), 0);
    const totalInvRem = (invoices || []).reduce((s, r) => s + Number(r.remaining || 0), 0);
    const activeInv = (invoices || []).filter((r) => Number(r.remaining || 0) > 0).length;

    // Monthly valuation progression
    const monthDeltas = new Map();
    for (const r of Array.isArray(stockIn) ? stockIn : []) {
      const ym = String(r.entry_date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      const q = Number(r.qty || 0);
      const val = q * priceOf(r.products?.name);
      const cur = monthDeltas.get(ym) || { dq: 0, dv: 0 };
      cur.dq += q;
      cur.dv += val;
      monthDeltas.set(ym, cur);
    }
    for (const w of Array.isArray(withdrawals) ? withdrawals : []) {
      const ym = String(w.w_date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      const q = Number(w.qty || 0);
      const pName = w.invoices?.products?.name || "";
      const up = Number(w.invoices?.unit_price || 0) || priceOf(pName);
      const cur = monthDeltas.get(ym) || { dq: 0, dv: 0 };
      cur.dq -= q;
      cur.dv -= q * up;
      monthDeltas.set(ym, cur);
    }
    let runQ = 0, runV = 0;
    const stockValuationMonthly = [...monthDeltas.keys()].sort().map((ym) => {
      const d = monthDeltas.get(ym);
      runQ = Math.max(0, runQ + d.dq);
      runV = Math.max(0, runV + d.dv);
      return { month: ym, label: ym, qtyBalance: Number(runQ.toFixed(2)), valueDzd: Number(runV.toFixed(2)) };
    });

    // KPI Stats
    const dosDateByNo = new Map();
    for (const d of Array.isArray(dossiers) ? dossiers : []) {
      if (d.dossier_no && d.reception_date) dosDateByNo.set(String(d.dossier_no).trim().toUpperCase(), d.reception_date);
    }
    const firstWByInv = new Map();
    const farmersPerDay = new Map();
    const allFarmers = new Set();
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const w of Array.isArray(withdrawals) ? withdrawals : []) {
      if (w.invoice_id && w.w_date) {
        const k = String(w.invoice_id);
        if (!firstWByInv.has(k) || w.w_date < firstWByInv.get(k)) firstWByInv.set(k, w.w_date);
      }
      const fKey = String(`${w.invoices?.client_name || ""} ${w.invoices?.farmer_name || ""}`).trim().toUpperCase() || String(w.invoice_id || "");
      if (w.w_date && fKey) {
        if (!farmersPerDay.has(w.w_date)) farmersPerDay.set(w.w_date, new Set());
        farmersPerDay.get(w.w_date).add(fKey);
        allFarmers.add(fKey);
      }
    }
    let sumDays = 0, procCount = 0;
    for (const inv of invoices || []) {
      const firstW = firstWByInv.get(String(inv.id));
      const recDate = inv.dossier_no ? dosDateByNo.get(String(inv.dossier_no).trim().toUpperCase()) : "";
      if (firstW && recDate) {
        const diff = (new Date(firstW).getTime() - new Date(recDate).getTime()) / 86400000;
        if (Number.isFinite(diff) && diff >= 0 && diff <= 365) {
          sumDays += diff;
          procCount += 1;
        }
      }
    }
    const dayCounts = [...farmersPerDay.values()].map((s) => s.size);
    const kpiStats = {
      avgProcessingDays: procCount ? Number((sumDays / procCount).toFixed(1)) : 0,
      processedDossiersCount: procCount,
      farmersToday: farmersPerDay.get(todayStr)?.size || 0,
      avgFarmersPerDay: dayCounts.length ? Number((dayCounts.reduce((a, b) => a + b, 0) / dayCounts.length).toFixed(1)) : 0,
      totalFarmersServed: allFarmers.size,
    };

    const cropMap = new Map();
    for (const r of invoices || []) {
      const c = String(r.culture || "غير مصنف").trim() || "غير مصنف";
      const cur = cropMap.get(c) || { culture: c, invoicedQty: 0, withdrawnQty: 0, remainingQty: 0, invoiceCount: 0, topProduct: r.product_name || "—" };
      cur.invoicedQty += Number(r.qty || 0);
      cur.withdrawnQty += Number(r.taken || 0);
      cur.remainingQty += Number(r.remaining || 0);
      cur.invoiceCount += 1;
      cropMap.set(c, cur);
    }

    let damagedQty = 0, lostQty = 0, returnedQty = 0, totalAmountDzd = 0;
    for (const a of Array.isArray(adjs) ? adjs : []) {
      const q = Number(a.qty || 0);
      const amt = Number(a.amount_dzd || 0);
      totalAmountDzd += amt;
      if (a.adjustment_type === "damaged") damagedQty += q;
      else if (a.adjustment_type === "lost") lostQty += q;
      else returnedQty += q;
    }

    return sanitizeDirectorSnapshot({
      orgName: "تعاونية الحبوب والبقول الجافة أدرار (CCLS ADRAR)",
      campaign: "2026/2027",
      unitLabel: "قنطار",
      updatedAt: new Date().toISOString(),
      threshold: 5,
      totalStockValueDzd,
      cards: [
        { label: "الرصيد المتبقي بالمخازن", value: `${totalStock.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} قنطار` },
        { label: "قيمة المخزون الحالية (دج)", value: `${totalStockValueDzd.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} دج` },
        { label: "الكميات المسحوبة", value: `${totalWithdrawn.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} قنطار` },
        { label: "فواتير قيد السحب", value: String(activeInv) },
      ],
      crops: [...cropMap.values()].sort((a, b) => b.withdrawnQty - a.withdrawnQty),
      stock: enrichedStock,
      stockValuationMonthly,
      kpiStats,
      adjustments: { damagedQty, lostQty, returnedQty, totalAmountDzd, count: Array.isArray(adjs) ? adjs.length : 0 },
    });
  } catch {
    return null;
  }
}

// ===== API Routes =====
app.get("/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

// Public privacy-safe QR verification endpoint (NO PII returned)
app.get("/api/public/verify-bon", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const bonRaw = String(req.query.bon || "").trim();
  if (!bonRaw || bonRaw.length > 64) {
    return res.status(400).json({ valid: false, error: "رقم إذن الخروج غير صالح" });
  }
  const key = bonRaw.toLowerCase();

  // 1) Try privacy-safe Supabase RPC `verify_bon_public`
  try {
    const rpcKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const rpcResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_bon_public`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: rpcKey,
        Authorization: `Bearer ${rpcKey}`,
      },
      body: JSON.stringify({ p_bon_no: bonRaw }),
    });
    if (rpcResp.ok) {
      const rows = await rpcResp.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const items = rows.map((r) => ({
          designation: String(r.designation || "سماد"),
          qty: Number(r.qty || 0),
        }));
        const totalQty = items.reduce((s, x) => s + x.qty, 0);
        return res.json({
          valid: true,
          source: "database",
          bon_no: String(rows[0].bon_no || bonRaw),
          sortie_date: String(rows[0].sortie_date || ""),
          camp: String(rows[0].camp || "2025/2026"),
          total_qty: Number(totalQty.toFixed(2)),
          item_count: items.length,
          items,
        });
      }
    }
  } catch (_) {}

  // 2) If service role is configured and RPC was not yet installed, query strictly non-PII columns
  if (SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const qResp = await fetch(
        `${SUPABASE_URL}/rest/v1/bon_sorties?select=bon_no,sortie_date,camp,designation,qty&bon_no=ilike.${encodeURIComponent(bonRaw)}&order=id.asc`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      if (qResp.ok) {
        const rows = await qResp.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const items = rows.map((r) => ({
            designation: String(r.designation || "سماد"),
            qty: Number(r.qty || 0),
          }));
          const totalQty = items.reduce((s, x) => s + x.qty, 0);
          return res.json({
            valid: true,
            source: "database",
            bon_no: String(rows[0].bon_no || bonRaw),
            sortie_date: String(rows[0].sortie_date || ""),
            camp: String(rows[0].camp || "2025/2026"),
            total_qty: Number(totalQty.toFixed(2)),
            item_count: items.length,
            items,
          });
        }
      }
    } catch (_) {}
  }

  // 3) Fallback to authenticated server-synced public Bon index (strictly non-PII)
  const cached = publicBonIndex.get(key);
  if (cached) {
    return res.json({ valid: true, source: "synced", ...cached });
  }

  return res.json({ valid: false, bon_no: bonRaw });
});

// Authenticated staff sync for non-PII Bon verification index
app.post("/api/public/bon-register", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const auth = await verifySupabaseUser(req);
  if (!auth) return res.status(401).json({ error: "غير مصرح" });
  const rows = Array.isArray(req.body?.bons) ? req.body.bons : [];
  const grouped = new Map();
  for (const r of rows.slice(0, 1500)) {
    const bonNo = String(r?.bon_no || "").trim().slice(0, 64);
    if (!bonNo) continue;
    const k = bonNo.toLowerCase();
    const cur = grouped.get(k) || {
      bon_no: bonNo,
      sortie_date: String(r?.sortie_date || "").slice(0, 20),
      camp: String(r?.camp || "2025/2026").slice(0, 20),
      items: [],
      total_qty: 0,
      item_count: 0,
    };
    const qty = Number(r?.qty || 0);
    cur.items.push({
      designation: String(r?.designation || "سماد").slice(0, 80),
      qty: Number.isFinite(qty) ? qty : 0,
    });
    cur.total_qty = Number((cur.total_qty + (Number.isFinite(qty) ? qty : 0)).toFixed(2));
    cur.item_count = cur.items.length;
    grouped.set(k, cur);
  }
  grouped.forEach((v, k) => publicBonIndex.set(k, v));
  return res.json({ ok: true, registered: grouped.size });
});

// Authenticated endpoint to generate read-only Director mobile link
app.post("/api/director-link", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const auth = await verifySupabaseUser(req);
  if (!auth) return res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
  if (req.body?.snapshot) {
    const cleanSnap = sanitizeDirectorSnapshot(req.body.snapshot);
    if (cleanSnap) latestDirectorSnapshot = cleanSnap;
  }
  const days = Math.min(90, Math.max(1, Number(req.body?.days || 30)));
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const token = signDirectorToken({
    scope: "director_readonly",
    issuedBy: auth.profile?.full_name || auth.user.email || "admin",
    exp,
  });
  return res.json({
    token,
    path: `/director.html?dt=${encodeURIComponent(token)}`,
    expiresAt: new Date(exp).toISOString(),
  });
});

// Authenticated endpoint to refresh latest read-only Director KPI snapshot
app.post("/api/director-snapshot", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const auth = await verifySupabaseUser(req);
  if (!auth) return res.status(401).json({ error: "غير مصرح" });
  const cleanSnap = sanitizeDirectorSnapshot(req.body?.snapshot || req.body);
  if (!cleanSnap) return res.status(400).json({ error: "بيانات غير صالحة" });
  latestDirectorSnapshot = cleanSnap;
  return res.json({ ok: true });
});

// Read-only Director summary data (validates signed HMAC token)
app.get("/api/director-summary", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const token = String(req.query.dt || "");
  const verified = verifyDirectorToken(token);
  if (!verified) {
    return res.status(401).json({ error: "رابط العرض غير صالح أو منتهي الصلاحية" });
  }
  const liveDb = await fetchLiveDirectorStatsFromSupabase();
  if (liveDb) {
    latestDirectorSnapshot = liveDb;
    return res.json({ ok: true, mode: "live_db", readOnly: true, expiresAt: verified.exp, data: liveDb });
  }
  if (latestDirectorSnapshot) {
    return res.json({ ok: true, mode: "live_snapshot", readOnly: true, expiresAt: verified.exp, data: latestDirectorSnapshot });
  }
  return res.json({
    ok: true,
    mode: "empty",
    readOnly: true,
    expiresAt: verified.exp,
    data: sanitizeDirectorSnapshot({ cards: [], crops: [], stock: [] }),
  });
});

// Optional server-side SMS / WhatsApp Gateway dispatch (falls back cleanly to WhatsApp/SMS links)
app.post("/api/notify", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const auth = await verifySupabaseUser(req);
  if (!auth) return res.status(401).json({ error: "غير مصرح" });

  if (!NOTIFY_WEBHOOK_URL) {
    return res.json({ ok: true, mode: "client_link" });
  }
  if (!isSafeExternalHttpsUrl(NOTIFY_WEBHOOK_URL)) {
    return res.status(500).json({ error: "عنوان بوابة الإشعارات غير صالح أمنياً" });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const headers = { "Content-Type": "application/json" };
    if (NOTIFY_WEBHOOK_TOKEN) headers.Authorization = `Bearer ${NOTIFY_WEBHOOK_TOKEN}`;
    const resp = await fetch(NOTIFY_WEBHOOK_URL, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        farmer_name: String(req.body?.farmer_name || "").slice(0, 100),
        phone: String(req.body?.phone || "").slice(0, 30),
        channel: req.body?.channel === "sms" ? "sms" : "whatsapp",
        event_type: String(req.body?.event_type || "").slice(0, 40),
        message: String(req.body?.message || "").slice(0, 800),
        sent_by: auth.profile?.full_name || auth.user.email || "",
      }),
    });
    clearTimeout(timer);
    if (!resp.ok) {
      return res.json({ ok: true, mode: "client_link", gatewayError: `HTTP ${resp.status}` });
    }
    return res.json({ ok: true, mode: "webhook_sent" });
  } catch {
    return res.json({ ok: true, mode: "client_link" });
  }
});

// ===== Public Lobby Kiosk Display Endpoints (Strict Non-PII) =====
function sanitizeKioskPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const safeStr = (v, max = 80) => String(v ?? "").trim().slice(0, max);
  const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  };
  const tickets = Array.isArray(raw.tickets)
    ? raw.tickets.slice(0, 60).map((t) => ({
        queue_no: safeNum(t?.queue_no),
        status: ["waiting", "loading", "done", "absent"].includes(t?.status) ? t.status : "waiting",
        display_name: safeStr(t?.display_name || t?.farmer_name || "", 60),
        product_name: safeStr(t?.product_name || "", 60),
        warehouse_name: safeStr(t?.warehouse_name || "", 60),
        qty: safeNum(t?.qty),
      }))
    : [];
  const stock = Array.isArray(raw.stock)
    ? raw.stock.slice(0, 50).map((s) => ({
        name: safeStr(s?.name || "", 60),
        warehouse: safeStr(s?.warehouse || "", 60),
        balance: safeNum(s?.balance),
      }))
    : [];
  return {
    orgName: safeStr(raw.orgName || "تعاونية الحبوب والبقول الجافة أدرار (CCLS ADRAR)", 140),
    unitLabel: safeStr(raw.unitLabel || "قنطار", 20),
    queueDate: safeStr(raw.queueDate || new Date().toISOString().slice(0, 10), 20),
    threshold: safeNum(raw.threshold ?? 5),
    updatedAt: new Date().toISOString(),
    tickets,
    stock,
  };
}

app.post("/api/public/kiosk-sync", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const auth = await verifySupabaseUser(req);
  if (!auth) return res.status(401).json({ error: "غير مصرح" });
  const clean = sanitizeKioskPayload(req.body);
  if (!clean) return res.status(400).json({ error: "بيانات غير صالحة" });
  latestKioskSnapshot = clean;
  return res.json({ ok: true });
});

app.get("/api/public/kiosk", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (latestKioskSnapshot) {
    return res.json({ ok: true, source: "live_sync", data: latestKioskSnapshot });
  }
  if (SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const headers = {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      };
      const todayStr = new Date().toISOString().slice(0, 10);
      const [qRes, sRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/pickup_appointments?select=queue_no,status,farmer_name,product_name,warehouse_name,qty,queue_date&queue_date=eq.${todayStr}&order=queue_no.asc&limit=60`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/stock_analysis?select=name,warehouse,balance&order=name.asc&limit=50`, { headers }),
      ]);
      const tickets = qRes.ok ? await qRes.json() : [];
      const stock = sRes.ok ? await sRes.json() : [];
      const snap = sanitizeKioskPayload({
        queueDate: todayStr,
        tickets: (tickets || []).map((t) => ({
          queue_no: t.queue_no,
          status: t.status,
          display_name: t.farmer_name,
          product_name: t.product_name,
          warehouse_name: t.warehouse_name,
          qty: t.qty,
        })),
        stock: stock || [],
      });
      if (snap) {
        latestKioskSnapshot = snap;
        return res.json({ ok: true, source: "live_db", data: snap });
      }
    } catch (_) {}
  }
  return res.json({
    ok: true,
    source: "empty",
    data: sanitizeKioskPayload({ tickets: [], stock: [] }),
  });
});

// ===== User Session Audit & Remote Termination API =====
app.post("/api/sessions/heartbeat", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const auth = await verifySupabaseUser(req);
  if (!auth) return res.status(401).json({ error: "غير مصرح" });
  const key = String(req.body?.session_key || "").trim().slice(0, 80);
  if (!key) return res.status(400).json({ error: "session_key مطلوب" });

  const nowIso = new Date().toISOString();
  const existing = sessionAuditStore.get(key);
  if (existing && existing.status === "revoked") {
    return res.json({ ok: true, status: "revoked", revoked: true, revoked_by: existing.revoked_by || "المسؤول" });
  }
  const reqStatus = req.body?.status === "ended" ? "ended" : "active";
  const record = {
    session_key: key,
    user_id: auth.user.id,
    user_email: auth.user.email || "",
    full_name: auth.profile?.full_name || auth.user.email?.split("@")[0] || "مستخدم",
    role_code: auth.profile?.role || "",
    device_label: String(req.body?.device_label || existing?.device_label || "متصفح ويب").slice(0, 80),
    user_agent: String(req.headers["user-agent"] || "").slice(0, 180),
    status: reqStatus,
    login_at: existing?.login_at || nowIso,
    last_seen_at: nowIso,
    logout_at: reqStatus === "ended" ? nowIso : existing?.logout_at || null,
    revoked_by: existing?.revoked_by || null,
  };
  sessionAuditStore.set(key, record);
  return res.json({ ok: true, status: record.status, revoked: false });
});

app.get("/api/sessions", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const auth = await verifySupabaseUser(req);
  if (!auth) return res.status(401).json({ error: "غير مصرح" });
  const adminOk = await isAdminAuth(auth);
  if (!adminOk) return res.status(403).json({ error: "ممنوع: للمسؤول فقط" });
  const rows = [...sessionAuditStore.values()].sort((a, b) =>
    String(b.last_seen_at || "").localeCompare(String(a.last_seen_at || ""))
  );
  return res.json({ ok: true, sessions: rows });
});

app.post("/api/sessions/revoke", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const auth = await verifySupabaseUser(req);
  if (!auth) return res.status(401).json({ error: "غير مصرح" });
  const adminOk = await isAdminAuth(auth);
  if (!adminOk) return res.status(403).json({ error: "ممنوع: للمسؤول فقط" });
  const key = String(req.body?.session_key || "").trim().slice(0, 80);
  if (!key) return res.status(400).json({ error: "session_key مطلوب" });

  const nowIso = new Date().toISOString();
  const existing = sessionAuditStore.get(key) || {
    session_key: key,
    user_id: String(req.body?.user_id || ""),
    user_email: String(req.body?.user_email || ""),
    full_name: String(req.body?.full_name || "مستخدم"),
    role_code: String(req.body?.role_code || ""),
    device_label: String(req.body?.device_label || "جهاز آخر"),
    login_at: nowIso,
  };
  const updated = {
    ...existing,
    status: "revoked",
    logout_at: nowIso,
    revoked_by: auth.profile?.full_name || auth.user.email || "المسؤول",
  };
  sessionAuditStore.set(key, updated);
  return res.json({ ok: true, session: updated });
});

function resolveSafePath(reqPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(reqPath);
  } catch {
    return null;
  }

  if (decoded.includes("\0") || decoded.includes("\\")) {
    return null;
  }

  if (ALLOWED_ROOT_FILES.has(decoded)) {
    const target = path.resolve(ROOT_DIR, ALLOWED_ROOT_FILES.get(decoded));
    if (target.startsWith(ROOT_DIR + path.sep)) return target;
    return null;
  }

  if (decoded.startsWith("/dist/")) {
    const rel = decoded.slice("/dist/".length);
    if (!ALLOWED_DIST_FILES.has(rel)) return null;
    const target = path.resolve(DIST_DIR, rel);
    if (target.startsWith(DIST_DIR + path.sep)) return target;
    return null;
  }

  if (decoded.startsWith("/assets/")) {
    const rel = decoded.slice("/assets/".length);
    if (!rel || rel.includes("..")) return null;
    const target = path.resolve(PUBLIC_ASSETS_DIR, rel);
    if (target.startsWith(PUBLIC_ASSETS_DIR + path.sep)) return target;
    return null;
  }

  return null;
}

app.use((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).type("text/plain").send("Method Not Allowed");
  }

  const filePath = resolveSafePath(req.path);
  if (!filePath) {
    return res.status(404).type("text/plain").send("Not found");
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return res.status(404).type("text/plain").send("Not found");
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Vary", "Accept-Encoding");

    if (ext === ".html") {
      res.setHeader("Cache-Control", "no-cache");
    } else if (ext === ".jfif" || ext === ".png" || ext === ".jpg" || ext === ".webp") {
      res.setHeader("Cache-Control", "public, max-age=86400");
    } else {
      res.setHeader("Cache-Control", "public, max-age=300");
    }

    if (req.method === "HEAD") {
      return res.status(200).end();
    }

    const acceptEnc = String(req.headers["accept-encoding"] || "");
    if (COMPRESSIBLE_EXTS.has(ext) && /\bgzip\b/i.test(acceptEnc)) {
      res.setHeader("Content-Encoding", "gzip");
      const stream = fs.createReadStream(filePath);
      const gzip = zlib.createGzip({ level: 6 });
      stream.on("error", () => {
        if (!res.headersSent) res.status(500).end();
      });
      return stream.pipe(gzip).pipe(res);
    }

    return res.sendFile(filePath);
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
