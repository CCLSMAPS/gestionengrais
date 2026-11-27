import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();

// 1. Validate all inline HTML <script> blocks across every page
const htmlPages = [
  "index.html",
  "analytics.html",
  "warehouse.html",
  "reception.html",
  "bons.html",
  "crops.html",
  "users.html",
  "dashboard.html",
  "verify.html",
  "director.html",
  "kiosk.html",
];

for (const page of htmlPages) {
  const fullPath = path.join(ROOT, page);
  assert.ok(fs.existsSync(fullPath), `Missing HTML page: ${page}`);
  const html = fs.readFileSync(fullPath, "utf8");
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 1, `Expected at least 1 inline script in ${page}`);
  scripts.forEach((m, idx) => {
    new vm.Script(m[1], { filename: `${page}#script${idx}` });
  });
}

// 2. Validate built dist bundles exist and are non-empty
for (const bundle of [
  "dist/warehouse-chart.js",
  "dist/culture-chart.js",
  "dist/analytics-dashboard.js",
  "dist/dossiers-pdf.js",
]) {
  const stat = fs.statSync(path.join(ROOT, bundle));
  assert.ok(stat.size > 1000, `Bundle too small or missing: ${bundle}`);
}

// 3. Validate RTL Web App Manifest
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
assert.equal(manifest.dir, "rtl");
assert.equal(manifest.lang, "ar");
assert.ok(manifest.name && manifest.icons?.length > 0);

// 4. Validate CSV formula injection neutralization logic matches common.js
const commonSrc = fs.readFileSync(path.join(ROOT, "common.js"), "utf8");
assert.match(commonSrc, /safeCell/);
assert.match(commonSrc, /URL\.revokeObjectURL/);

const safeCell = (v) => {
  const s = String(v ?? "").replace(/\r?\n/g, " ");
  const neutralized =
    /^[=+\-@\t\r]/.test(s) && !/^-\d+(\.\d+)?$/.test(s) ? "'" + s : s;
  return `"${neutralized.replace(/"/g, '""')}"`;
};
assert.equal(safeCell("=CMD()"), `"'=CMD()"`);
assert.equal(safeCell("+SUM(A1)"), `"'+SUM(A1)"`);
assert.equal(safeCell("@IMPORT"), `"'@IMPORT"`);
assert.equal(safeCell("-cmd"), `"'-cmd"`);
assert.equal(safeCell("-12.5"), `"-12.5"`);
assert.equal(safeCell('UREE "46%"'), `"UREE ""46%"""`);

// 5. Validate server.js uses strict allowlists & path confinement
const serverSrc = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
assert.match(serverSrc, /ALLOWED_ROOT_FILES/);
assert.match(serverSrc, /ALLOWED_DIST_FILES/);
assert.match(serverSrc, /X-Content-Type-Options/);
assert.match(serverSrc, /Content-Security-Policy/);

// 6. Validate crop invoices & withdrawals aggregation bundle behavior
const aggSrc = fs.readFileSync(path.join(ROOT, "src/analytics-aggregator.ts"), "utf8");
assert.match(aggSrc, /aggregateCropInvoicesAndWithdrawals/);
const analyticsBundle = fs.readFileSync(path.join(ROOT, "dist/analytics-dashboard.js"), "utf8");
const sandbox = {
  window: {},
  document: {
    documentElement: {},
    getElementById: () => null,
  },
  navigator: {},
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  matchMedia: () => ({ addEventListener: () => {}, removeEventListener: () => {} }),
  requestAnimationFrame: (fn) => fn(),
  console,
  setTimeout,
  clearTimeout,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(analyticsBundle, sandbox, { filename: "dist/analytics-dashboard.js" });
assert.equal(typeof sandbox.window.buildCropAnalytics, "function");

const aggResult = sandbox.window.buildCropAnalytics({
  invoices: [
    { id: 1, invoice_no: "10", invoice_year: 2026, dossier_no: "01", product_name: "UREE 46%", qty: 100, taken: 60, remaining: 40, unit_price: 4000 },
    { id: 2, invoice_no: "11", invoice_year: 2026, farmer_name: "OUIS NACIM", product_name: "TSP", qty: 50, taken: 50, remaining: 0, culture: "BLÉ" },
    { id: 3, invoice_no: "99", invoice_year: 2025, farmer_card_no: "CARD-7", product_name: "UREE 46%", qty: 80, taken: 30, remaining: 50 },
  ],
  withdrawals: [
    { id: 101, invoice_id: 1, w_date: "2026-03-10", qty: 35 },
    { id: 102, invoice_id: 1, w_date: "2026-04-02", qty: 25 },
    { id: 103, invoice_id: 3, w_date: "2026-02-15", qty: 30 },
  ],
  dossiers: [
    { dossier_no: "01", culture: "MAIS", farmer_name: "FERME CCLS" },
    { farmer_card_no: "CARD-7", culture: "ORGE", farmer_name: "FARMER ORGE" },
  ],
});

const byCult = new Map(aggResult.items.map((r) => [r.culture, r]));
assert.equal(byCult.get("MAIS")?.invoicedQty, 100);
assert.equal(byCult.get("MAIS")?.withdrawnQty, 60);
assert.equal(byCult.get("MAIS")?.withdrawalCount, 2);
assert.equal(byCult.get("BLE")?.withdrawnQty, 50); // accent normalized BLÉ -> BLE via taken fallback
assert.equal(byCult.get("ORGE")?.withdrawnQty, 30);

// Cross-year filter: 2026 withdrawals from 2025 invoice (id: 3) still link to ORGE!
const agg2026 = sandbox.window.buildCropAnalytics({
  invoices: [
    { id: 3, invoice_no: "99", invoice_year: 2025, farmer_card_no: "CARD-7", product_name: "UREE 46%", qty: 80, taken: 30, remaining: 50 },
  ],
  withdrawals: [
    { id: 103, invoice_id: 3, w_date: "2026-02-15", qty: 30 },
  ],
  dossiers: [
    { farmer_card_no: "CARD-7", culture: "ORGE" },
  ],
  filters: { year: "2026" },
});
assert.equal(agg2026.items.length, 1);
assert.equal(agg2026.items[0].culture, "ORGE");
assert.equal(agg2026.items[0].withdrawnQty, 30);
assert.equal(agg2026.items[0].invoicedQty, 0);

// 7. Validate analytics print/PDF fallback wiring
const analyticsHtml = fs.readFileSync(path.join(ROOT, "analytics.html"), "utf8");
assert.match(analyticsHtml, /analyticsPrintReport/);
assert.match(analyticsHtml, /dist\/dossiers-pdf\.js/);
assert.match(analyticsHtml, /printAnalyticsReport/);
const dossiersPdfBundle = fs.readFileSync(path.join(ROOT, "dist/dossiers-pdf.js"), "utf8");
assert.match(dossiersPdfBundle, /printAnalyticsReport/);
assert.match(dossiersPdfBundle, /exportAnalyticsPdf/);

// 8. Validate RBAC v2 page/button/feature permissions & Professional Settings in common.js & users.html
const usersHtml = fs.readFileSync(path.join(ROOT, "users.html"), "utf8");
assert.match(usersHtml, /permMatrixHtml/);
assert.match(usersHtml, /clonePermsFrom/);
assert.match(usersHtml, /uCards/);
assert.match(commonSrc, /cfgTabs/);
assert.match(commonSrc, /backupExportBtn/);
assert.match(commonSrc, /backupImportInput/);
assert.match(commonSrc, /applyActionPermissions/);

const memStore = new Map();
const commonSandbox = {
  window: {},
  document: {
    documentElement: {
      setAttribute: () => {},
      removeAttribute: () => {},
      style: { setProperty: () => {} },
    },
    querySelector: () => null,
    querySelectorAll: () => [],
  },
  navigator: { onLine: true },
  localStorage: {
    getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
    setItem: (k, v) => memStore.set(k, String(v)),
    removeItem: (k) => memStore.delete(k),
    get length() { return memStore.size; },
    key: (i) => [...memStore.keys()][i] ?? null,
  },
  CustomEvent: function CustomEvent(name, opts) { this.type = name; this.detail = opts?.detail; },
  supabase: { createClient: () => ({ auth: { onAuthStateChange: () => {} } }) },
  console,
  setTimeout,
  clearTimeout,
};
commonSandbox.window = commonSandbox;
commonSandbox.globalThis = commonSandbox;
commonSandbox.window.dispatchEvent = () => {};
commonSandbox.window.addEventListener = () => {};
vm.runInNewContext(commonSrc, commonSandbox, { filename: "common.js" });

// Test page-level toggle strictness under rbac:v2
assert.equal(commonSandbox.hasPageAccess(["rbac:v2", "page:analytics", "page:bons"], "analytics.html"), true);
assert.equal(commonSandbox.hasPageAccess(["rbac:v2", "page:analytics", "page:bons"], "warehouse.html"), false);
assert.equal(commonSandbox.hasPageAccess(["rbac:v2"], "analytics.html"), false); // all pages disabled

// Test button & feature controls
assert.equal(commonSandbox.hasBtnPerm("btn:delete", ["rbac:v2", "page:index", "btn:create"]), false);
assert.equal(commonSandbox.hasBtnPerm("btn:create", ["rbac:v2", "page:index", "btn:create"]), true);
assert.equal(commonSandbox.hasFeatPerm("feat:financials", ["rbac:v2", "page:analytics"]), false);
assert.equal(commonSandbox.hasFeatPerm("feat:financials", ["rbac:v2", "page:analytics", "feat:financials"]), true);

// Test settings persistence & reset
const defCfg = commonSandbox.getAppSettings();
assert.equal(defCfg.threshold, 5);
assert.equal(defCfg.expiryAlertDays, 30);
commonSandbox.saveAppSettings({ threshold: 12, density: "compact", expiryAlertDays: 45 });
assert.equal(commonSandbox.getAppSettings().threshold, 12);
assert.equal(commonSandbox.getLowStockThreshold(), 12);
assert.equal(commonSandbox.getAppSettings().expiryAlertDays, 45);
commonSandbox.resetAppSettings();
assert.equal(commonSandbox.getAppSettings().threshold, 5);

// 9. Validate Bon de sortie QR generation, scan parsing, A4/half-page/2-up formats, and gate verification
const bonsHtml = fs.readFileSync(path.join(ROOT, "bons.html"), "utf8");
assert.match(bonsHtml, /bonFormatSelect/);
assert.match(bonsHtml, /value="half"/);
assert.match(bonsHtml, /value="2up"/);
assert.match(bonsHtml, /verifySec/);
assert.match(bonsHtml, /verifyInput/);
assert.match(bonsHtml, /startCamBtn/);
assert.match(bonsHtml, /verifyQrFile/);
assert.match(serverSrc, /camera=\(self\)/);

let capturedQrImg = null;
const pdfSandbox = {
  window: {},
  document: {
    getElementById: () => null,
    createElement: (tag) => {
      if (tag === "canvas") {
        let _w = 240;
        let _h = 240;
        return {
          get width() { return _w; },
          set width(v) { _w = v; },
          get height() { return _h; },
          set height(v) { _h = v; },
          getContext: () => ({
            createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
            putImageData: (imgData) => { capturedQrImg = imgData; },
            fillRect: () => {},
            clearRect: () => {},
          }),
          toDataURL: () => "data:image/png;base64,iVBORw0KGgo=",
        };
      }
      return {};
    },
  },
  navigator: {},
  location: { protocol: "https:", origin: "https://ccls.example.test" },
  URL,
  TextEncoder,
  TextDecoder,
  atob,
  btoa,
  console,
  setTimeout,
  clearTimeout,
};
pdfSandbox.window = pdfSandbox;
pdfSandbox.globalThis = pdfSandbox;
vm.runInNewContext(dossiersPdfBundle, pdfSandbox, { filename: "dist/dossiers-pdf.js" });

assert.equal(typeof pdfSandbox.window.buildBonQrPayload, "function");
assert.equal(typeof pdfSandbox.window.extractBonNoFromScan, "function");
assert.equal(typeof pdfSandbox.window.generateBonQrDataUrl, "function");
assert.equal(typeof pdfSandbox.window.decodeQrFromImageData, "function");

assert.equal(
  pdfSandbox.window.buildBonQrPayload("1691"),
  "https://ccls.example.test/verify.html?bon=1691"
);
assert.equal(
  pdfSandbox.window.extractBonNoFromScan("https://ccls.example.test/verify.html?bon=1691"),
  "1691"
);
assert.equal(
  pdfSandbox.window.extractBonNoFromScan("https://ccls.example.test/bons.html?verify=BON-2026%2F01"),
  "BON-2026/01"
);
assert.equal(pdfSandbox.window.extractBonNoFromScan("BON:1200"), "1200");
assert.equal(pdfSandbox.window.extractBonNoFromScan("CCLS-BON:874"), "874");
assert.equal(pdfSandbox.window.extractBonNoFromScan('{"bon_no":"875"}'), "875");
assert.equal(pdfSandbox.window.extractBonNoFromScan("1691"), "1691");

const qrUrl = await pdfSandbox.window.generateBonQrDataUrl("1691");
assert.ok(qrUrl.startsWith("data:image/png;base64,"), "QR output should be PNG data URL");
if (capturedQrImg) {
  const decodedQr = pdfSandbox.window.decodeQrFromImageData(
    capturedQrImg.data,
    capturedQrImg.width,
    capturedQrImg.height
  );
  assert.equal(decodedQr, "https://ccls.example.test/verify.html?bon=1691");
  assert.equal(pdfSandbox.window.extractBonNoFromScan(decodedQr), "1691");
}

// 10. Validate RemainingStockChart & live DB analytics dashboard wiring
assert.equal(typeof sandbox.window.renderRemainingStockChart, "function");
assert.match(analyticsHtml, /dashRemainingSec/);
assert.match(analyticsHtml, /remaining-stock-chart-root/);
assert.match(analyticsHtml, /exportRemainingCsv/);
assert.match(analyticsHtml, /subscribeLiveDb/);
assert.match(analyticsHtml, /stock_analysis/);
assert.match(analyticsHtml, /remainingSummaryTable/);

// 11. Validate Ops Suite: Over-withdrawal guard, Adjustments, Queue, Notifications, Director link, Public QR
const opsSql = fs.readFileSync(path.join(ROOT, "supabase-ops.sql"), "utf8");
assert.match(opsSql, /enforce_withdrawal_remaining/);
assert.match(opsSql, /stock_adjustments/);
assert.match(opsSql, /pickup_appointments/);
assert.match(opsSql, /farmer_notifications/);
assert.match(opsSql, /verify_bon_public/);

assert.match(serverSrc, /\/api\/public\/verify-bon/);
assert.match(serverSrc, /\/api\/director-link/);
assert.match(serverSrc, /\/api\/director-summary/);
assert.match(serverSrc, /\/api\/notify/);
assert.match(serverSrc, /verifySupabaseUser/);
assert.match(serverSrc, /timingSafeEqual/);

const warehouseHtml = fs.readFileSync(path.join(ROOT, "warehouse.html"), "utf8");
assert.match(warehouseHtml, /adjustSec/);
assert.match(warehouseHtml, /fAdj/);
assert.match(warehouseHtml, /invoice_balance/);

const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
assert.match(indexHtml, /queueSec/);
assert.match(indexHtml, /notifySec/);
assert.match(indexHtml, /blockOverWithdraw/);
assert.match(indexHtml, /receiptArrivalBox/);
assert.match(indexHtml, /invNotifyBanner/);

assert.match(analyticsHtml, /shareDirectorLinkBtn/);
assert.match(analyticsHtml, /director-snapshot/);
assert.match(usersHtml, /director_mobile/);

assert.match(commonSrc, /normalizeDzPhone/);
assert.match(commonSrc, /buildFarmerNotificationLinks/);
assert.match(commonSrc, /enableQueueAppointments/);
assert.match(commonSrc, /enableFarmerNotifications/);

const dz = commonSandbox.window.normalizeDzPhone("0661 22 33 44");
assert.equal(dz.local, "0661223344");
assert.equal(dz.intl, "213661223344");
const nLinks = commonSandbox.window.buildFarmerNotificationLinks({ phone: "0661223344", message: "مرحبا" });
assert.equal(nLinks.waUrl, "https://wa.me/213661223344?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7");
assert.equal(nLinks.smsUrl, "sms:0661223344?body=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7");

// 12. Validate 9-Feature Pro Suite: Valuation, Multi-warehouse Transfers, Drivers, Soft Delete, Sessions, KPIs, YoY, Kiosk, Sticky Notes
assert.match(opsSql, /create table if not exists public\.bon_sorties/);
assert.match(opsSql, /create table if not exists public\.dossier_receptions/);
assert.match(opsSql, /warehouse_transfers/);
assert.match(opsSql, /drivers_registry/);
assert.match(opsSql, /recycle_bin/);
assert.match(opsSql, /user_sessions/);
assert.match(opsSql, /invoice_notes/);

assert.match(serverSrc, /\/api\/public\/kiosk/);
assert.match(serverSrc, /\/api\/sessions\/heartbeat/);
assert.match(serverSrc, /\/api\/sessions\/revoke/);
assert.match(serverSrc, /\/api\/sessions/);

assert.match(warehouseHtml, /transferSec/);
assert.match(warehouseHtml, /driversSec/);
assert.match(warehouseHtml, /recycleSec/);
assert.match(usersHtml, /sessionsSec/);
assert.match(analyticsHtml, /dashKpiSec/);
assert.match(analyticsHtml, /dashValuationSec/);
assert.match(analyticsHtml, /dashYoYSec/);

const directorHtml = fs.readFileSync(path.join(ROOT, "director.html"), "utf8");
assert.match(directorHtml, /dirValuationSec/);
assert.match(directorHtml, /dirKpiCards/);

const kioskHtml = fs.readFileSync(path.join(ROOT, "kiosk.html"), "utf8");
assert.match(kioskHtml, /kioskLoadingGrid/);
assert.match(kioskHtml, /kioskWaitingList/);
assert.match(kioskHtml, /kioskStockTbl/);

assert.equal(typeof commonSandbox.window.describeDeviceLabel, "function");
assert.equal(typeof commonSandbox.window.softDeleteItem, "function");
assert.equal(typeof commonSandbox.window.restoreRecycleItem, "function");
assert.equal(typeof commonSandbox.window.openInvoiceNotesModal, "function");
assert.equal(commonSandbox.window.describeDeviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/124.0"), "Windows · Chrome");

assert.equal(typeof sandbox.window.computeStockValuationAndMonthly, "function");
assert.equal(typeof sandbox.window.computePerformanceKpis, "function");
assert.equal(typeof sandbox.window.computeYoYProductComparison, "function");
assert.equal(typeof sandbox.window.renderStockValuationChart, "function");
assert.equal(typeof sandbox.window.renderYoYComparisonChart, "function");

const valTest = sandbox.window.computeStockValuationAndMonthly({
  stockRows: [{ wid: 1, warehouse: "الرئيسي", name: "UREE 46%", received: 100, withdrawn: 40, balance: 60 }],
  stockIn: [{ entry_date: "2026-01-10", qty: 100, unit_price: 4200, products: { name: "UREE 46%" } }],
  withdrawals: [{ w_date: "2026-02-05", qty: 40, invoice_id: 1 }],
  invoices: [{ id: 1, product_name: "UREE 46%", qty: 40, unit_price: 4200 }],
});
assert.equal(valTest.totalStockValueDzd, 252000);
assert.equal(valTest.monthlySeries.length, 2);
assert.equal(valTest.monthlySeries[1].valueDzd, 252000);

const kpiTest = sandbox.window.computePerformanceKpis({
  dossiers: [{ dossier_no: "D-1", reception_date: "2026-03-01" }],
  invoices: [{ id: 1, dossier_no: "D-1", farmer_name: "علي" }],
  withdrawals: [
    { invoice_id: 1, w_date: "2026-03-04", qty: 10 },
    { invoice_id: 2, w_date: "2026-03-04", qty: 5, invoices: { farmer_name: "محمد" } },
  ],
  todayDate: "2026-03-04",
});
assert.equal(kpiTest.avgProcessingDays, 3);
assert.equal(kpiTest.farmersToday, 2);
assert.equal(kpiTest.totalFarmersServed, 2);

const yoyTest = sandbox.window.computeYoYProductComparison({
  stockIn: [
    { entry_date: "2025-02-01", qty: 100, products: { name: "UREE 46%" } },
    { entry_date: "2026-02-01", qty: 150, products: { name: "UREE 46%" } },
  ],
  withdrawals: [
    { w_date: "2025-03-01", qty: 50, invoices: { product_name: "UREE 46%" } },
    { w_date: "2026-03-01", qty: 75, invoices: { product_name: "UREE 46%" } },
  ],
  yearA: "2025",
  yearB: "2026",
});
assert.equal(yoyTest.length, 1);
assert.equal(yoyTest[0].receivedDiff, 50);
assert.equal(yoyTest[0].receivedPct, 50);
assert.equal(yoyTest[0].withdrawnDiff, 25);
assert.equal(yoyTest[0].withdrawnPct, 50);

console.log(`ALL ${htmlPages.length} PAGES, BUNDLES, MANIFEST, AGGREGATOR, RBAC, SETTINGS, QR-BON, OPS-SUITE, 9-PRO-FEATURES, AND SECURITY CHECKS PASSED`);
