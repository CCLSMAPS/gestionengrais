export interface InvoiceLike {
  id?: string | number;
  invoice_no?: string | number;
  invoice_year?: string | number;
  invoice_date?: string;
  warehouse_id?: string | number;
  product_name?: string;
  qty?: number | string;
  taken?: number | string;
  remaining?: number | string;
  unit_price?: number | string;
  culture?: string;
  dossier_no?: string;
  farmer_card_no?: string;
  farmer_name?: string;
  client_name?: string;
  region?: string;
}

export interface WithdrawalLike {
  id?: string | number;
  w_date?: string;
  qty?: number | string;
  invoice_id?: string | number;
  invoices?: {
    id?: string | number;
    invoice_no?: string | number;
    invoice_year?: string | number;
    invoice_date?: string;
    warehouse_id?: string | number;
    product_id?: string | number;
    product_name?: string;
    unit_price?: number | string;
    culture?: string;
    dossier_no?: string;
    farmer_card_no?: string;
    farmer_name?: string;
    client_name?: string;
    region?: string;
    products?: { name?: string } | null;
  } | null;
}

export interface DossierLike {
  dossier_no?: string;
  farmer_card_no?: string;
  farmer_name?: string;
  culture?: string;
}

export interface InvoiceMetaEntry {
  culture?: string;
  farmer_card_no?: string;
}

export interface AnalyticsFilters {
  year?: string;
  warehouseId?: string;
  productName?: string;
  culture?: string;
  region?: string;
}

export interface CropConsumptionItem {
  culture: string;
  invoicedQty: number;
  withdrawnQty: number;
  remainingQty: number;
  invoiceCount: number;
  withdrawalCount: number;
  topProduct: string;
  invoicedValueDzd?: number;
  withdrawnValueDzd?: number;
  [fertilizerSeries: string]: string | number | undefined;
}

export interface CropAnalyticsResult {
  items: CropConsumptionItem[];
  fertilizerKeys: string[];
  filteredInvoices: InvoiceLike[];
  filteredWithdrawals: WithdrawalLike[];
  availableCultures: string[];
  totalInvoicedQty: number;
  totalWithdrawnQty: number;
  totalInvoicedValueDzd: number;
  totalWithdrawnValueDzd: number;
}

export function normalizeTextKey(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export interface DossierCultureLookups {
  byNo: Map<string, string>;
  byCard: Map<string, string>;
  byName: Map<string, string>;
}

export function buildDossierCultureLookups(
  dossiers: DossierLike[]
): DossierCultureLookups {
  const byNo = new Map<string, string>();
  const byCard = new Map<string, string>();
  const byName = new Map<string, string>();

  (dossiers || []).forEach((d) => {
    const culture = normalizeTextKey(d?.culture);
    if (!culture) return;
    if (d.dossier_no) byNo.set(normalizeTextKey(d.dossier_no), culture);
    if (d.farmer_card_no) {
      byCard.set(normalizeTextKey(d.farmer_card_no), culture);
    }
    if (d.farmer_name) {
      byName.set(normalizeTextKey(d.farmer_name), culture);
    }
  });

  return { byNo, byCard, byName };
}

export function resolveCultureForRecord(
  record: InvoiceLike | null | undefined,
  lookups: DossierCultureLookups,
  metaMap: Record<string, InvoiceMetaEntry> = {}
): string {
  if (!record) return "غير محدد";
  const metaKey = `${String(record.invoice_no ?? "").trim()}|${
    record.invoice_year ?? ""
  }`;
  const meta = metaMap[metaKey] || {};

  const direct = normalizeTextKey(record.culture || meta.culture);
  if (direct) return direct;

  if (record.dossier_no) {
    const dKey = normalizeTextKey(record.dossier_no);
    const hit = lookups.byNo.get(dKey);
    if (hit) return hit;
  }

  const card = normalizeTextKey(record.farmer_card_no || meta.farmer_card_no);
  if (card) {
    const hit = lookups.byCard.get(card);
    if (hit) return hit;
  }

  const fullName = normalizeTextKey(
    `${record.client_name || ""} ${record.farmer_name || ""}`
  );
  if (fullName && lookups.byName.has(fullName)) {
    return lookups.byName.get(fullName) as string;
  }

  const fName = normalizeTextKey(record.farmer_name);
  if (fName && lookups.byName.has(fName)) {
    return lookups.byName.get(fName) as string;
  }

  const cName = normalizeTextKey(record.client_name);
  if (cName && lookups.byName.has(cName)) {
    return lookups.byName.get(cName) as string;
  }

  return "غير محدد";
}

function toFiniteNumber(v: unknown, nonNegative = false): number {
  const num = Number(v ?? 0);
  if (!Number.isFinite(num)) return 0;
  if (nonNegative && num < 0) return 0;
  return num;
}

export function aggregateCropInvoicesAndWithdrawals(params: {
  invoices: InvoiceLike[];
  withdrawals: WithdrawalLike[];
  dossiers?: DossierLike[];
  metaMap?: Record<string, InvoiceMetaEntry>;
  filters?: AnalyticsFilters;
}): CropAnalyticsResult {
  const invoices = params.invoices || [];
  const withdrawals = params.withdrawals || [];
  const metaMap = params.metaMap || {};
  const filters = params.filters || {};
  const lookups = buildDossierCultureLookups(params.dossiers || []);

  const fYear = String(filters.year || "").trim();
  const fWh = String(filters.warehouseId || "").trim();
  const fProd = String(filters.productName || "").trim();
  const fCulture = String(filters.culture || "").trim();
  const fRegion = String(filters.region || "").trim();

  const invById = new Map<string, InvoiceLike>();
  invoices.forEach((inv) => {
    if (inv?.id != null) invById.set(String(inv.id), inv);
  });

  // Track which invoices have actual rows in the withdrawals table
  const loggedWithdrawnByInvId = new Map<string, number>();
  withdrawals.forEach((w) => {
    const key = w?.invoice_id != null ? String(w.invoice_id) : "";
    if (!key) return;
    const q = toFiniteNumber(w.qty, true);
    loggedWithdrawnByInvId.set(key, (loggedWithdrawnByInvId.get(key) || 0) + q);
  });

  const getWithdrawalContext = (w: WithdrawalLike): InvoiceLike | undefined => {
    const fromMap =
      w?.invoice_id != null ? invById.get(String(w.invoice_id)) : undefined;
    if (fromMap) return fromMap;
    if (w?.invoices) {
      return {
        ...w.invoices,
        product_name:
          w.invoices.product_name || w.invoices.products?.name || "",
      };
    }
    return undefined;
  };

  const cultureSet = new Set<string>();
  invoices.forEach((inv) => {
    cultureSet.add(resolveCultureForRecord(inv, lookups, metaMap));
  });
  withdrawals.forEach((w) => {
    const ctx = getWithdrawalContext(w);
    if (ctx) cultureSet.add(resolveCultureForRecord(ctx, lookups, metaMap));
  });
  const availableCultures = [...cultureSet]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ar"));

  const filteredInvoices = invoices.filter((inv) => {
    const yr = String(
      inv.invoice_year || (inv.invoice_date || "").slice(0, 4)
    ).trim();
    if (fYear && yr !== fYear) return false;
    if (fWh && String(inv.warehouse_id ?? "") !== fWh) return false;
    if (fProd && String(inv.product_name || "").trim() !== fProd) return false;
    if (fCulture && resolveCultureForRecord(inv, lookups, metaMap) !== fCulture) {
      return false;
    }
    if (fRegion && String(inv.region || "").trim() !== fRegion) return false;
    return true;
  });

  const filteredWithdrawals = withdrawals.filter((w) => {
    const yr = String((w.w_date || "").slice(0, 4)).trim();
    if (fYear && yr !== fYear) return false;
    const ctx = getWithdrawalContext(w);
    const whId = ctx?.warehouse_id ?? w.invoices?.warehouse_id;
    const pName = ctx?.product_name || w.invoices?.products?.name || "";
    const reg = ctx?.region || "";
    const cul = resolveCultureForRecord(ctx, lookups, metaMap);

    if (fWh && String(whId ?? "") !== fWh) return false;
    if (fProd && String(pName).trim() !== fProd) return false;
    if (fCulture && cul !== fCulture) return false;
    if (fRegion && String(reg).trim() !== fRegion) return false;
    return true;
  });

  interface CropBucket {
    culture: string;
    invoicedQty: number;
    withdrawnQty: number;
    remainingQty: number;
    invoicedValueDzd: number;
    withdrawnValueDzd: number;
    invoiceCount: number;
    withdrawalCount: number;
    productTotals: Map<string, number>;
  }

  const cropMap = new Map<string, CropBucket>();
  const ensureBucket = (culture: string): CropBucket => {
    let cur = cropMap.get(culture);
    if (!cur) {
      cur = {
        culture,
        invoicedQty: 0,
        withdrawnQty: 0,
        remainingQty: 0,
        invoicedValueDzd: 0,
        withdrawnValueDzd: 0,
        invoiceCount: 0,
        withdrawalCount: 0,
        productTotals: new Map<string, number>(),
      };
      cropMap.set(culture, cur);
    }
    return cur;
  };

  // 1) Aggregate invoice totals & remaining balance per culture
  filteredInvoices.forEach((inv) => {
    const culture = resolveCultureForRecord(inv, lookups, metaMap);
    const cur = ensureBucket(culture);
    const qInv = toFiniteNumber(inv.qty, true);
    const qTaken = toFiniteNumber(inv.taken, true);
    const qRem =
      inv.remaining != null
        ? toFiniteNumber(inv.remaining, true)
        : Math.max(0, qInv - qTaken);
    const unitPrice = toFiniteNumber(inv.unit_price, true);

    cur.invoicedQty += qInv;
    cur.remainingQty += qRem;
    cur.invoicedValueDzd += qInv * unitPrice;
    cur.invoiceCount += 1;

    // Fallback: if an invoice reports taken > 0 without any withdrawal log rows
    // and no specific year filter is restricting withdrawal dates, preserve it.
    const invIdKey = inv.id != null ? String(inv.id) : "";
    const hasWithdrawalLogs =
      invIdKey !== "" && (loggedWithdrawnByInvId.get(invIdKey) || 0) > 0;
    if (!hasWithdrawalLogs && qTaken > 0 && !fYear) {
      cur.withdrawnQty += qTaken;
      cur.withdrawnValueDzd += qTaken * unitPrice;
      const prodName = String(inv.product_name || "غير محدد").trim() || "غير محدد";
      cur.productTotals.set(
        prodName,
        (cur.productTotals.get(prodName) || 0) + qTaken
      );
    }
  });

  // 2) Aggregate actual withdrawal transactions linked to each invoice -> culture
  filteredWithdrawals.forEach((w) => {
    const ctx = getWithdrawalContext(w);
    const culture = resolveCultureForRecord(ctx, lookups, metaMap);
    const cur = ensureBucket(culture);
    const q = toFiniteNumber(w.qty, true);
    const unitPrice = toFiniteNumber(ctx?.unit_price, true);
    const prodName =
      String(
        ctx?.product_name || w.invoices?.products?.name || "غير محدد"
      ).trim() || "غير محدد";

    cur.withdrawnQty += q;
    cur.withdrawnValueDzd += q * unitPrice;
    cur.withdrawalCount += 1;
    if (q > 0) {
      cur.productTotals.set(prodName, (cur.productTotals.get(prodName) || 0) + q);
    }
  });

  // 3) If a culture has invoiced quantities but zero recorded withdrawals yet,
  // still compute fertilizer demand mix from its invoiced products so stacked bars remain informative.
  filteredInvoices.forEach((inv) => {
    const culture = resolveCultureForRecord(inv, lookups, metaMap);
    const cur = cropMap.get(culture);
    if (!cur || cur.withdrawnQty > 0) return;
    const qInv = toFiniteNumber(inv.qty, true);
    if (qInv <= 0) return;
    const prodName = String(inv.product_name || "غير محدد").trim() || "غير محدد";
    cur.productTotals.set(prodName, (cur.productTotals.get(prodName) || 0) + qInv);
  });

  const globalProdTotals = new Map<string, number>();
  cropMap.forEach((bucket) => {
    bucket.productTotals.forEach((val, prod) => {
      globalProdTotals.set(prod, (globalProdTotals.get(prod) || 0) + val);
    });
  });

  const topFertilizers = [...globalProdTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
  const hasOther = globalProdTotals.size > 5;
  const fertilizerKeys = hasOther ? [...topFertilizers, "أسمدة أخرى"] : topFertilizers;

  const items: CropConsumptionItem[] = [...cropMap.values()]
    .map((c) => {
      let topProduct = "—";
      let topVal = -1;
      const series: Record<string, number> = {};
      fertilizerKeys.forEach((fk) => {
        series[fk] = 0;
      });
      c.productTotals.forEach((v, k) => {
        if (v > topVal) {
          topVal = v;
          topProduct = k;
        }
        const bucketKey = topFertilizers.includes(k)
          ? k
          : hasOther
          ? "أسمدة أخرى"
          : k;
        if (bucketKey) {
          series[bucketKey] = Number(((series[bucketKey] || 0) + v).toFixed(2));
        }
      });

      return {
        culture: c.culture,
        invoicedQty: Number(c.invoicedQty.toFixed(2)),
        withdrawnQty: Number(c.withdrawnQty.toFixed(2)),
        remainingQty: Number(c.remainingQty.toFixed(2)),
        invoicedValueDzd: Number(c.invoicedValueDzd.toFixed(2)),
        withdrawnValueDzd: Number(c.withdrawnValueDzd.toFixed(2)),
        invoiceCount: c.invoiceCount,
        withdrawalCount: c.withdrawalCount,
        topProduct,
        ...series,
      };
    })
    .sort(
      (a, b) =>
        b.withdrawnQty - a.withdrawnQty || b.invoicedQty - a.invoicedQty
    );

  const totalInvoicedQty = Number(
    items.reduce((s, r) => s + r.invoicedQty, 0).toFixed(2)
  );
  const totalWithdrawnQty = Number(
    items.reduce((s, r) => s + r.withdrawnQty, 0).toFixed(2)
  );
  const totalInvoicedValueDzd = Number(
    items.reduce((s, r) => s + (r.invoicedValueDzd || 0), 0).toFixed(2)
  );
  const totalWithdrawnValueDzd = Number(
    items.reduce((s, r) => s + (r.withdrawnValueDzd || 0), 0).toFixed(2)
  );

  return {
    items,
    fertilizerKeys,
    filteredInvoices,
    filteredWithdrawals,
    availableCultures,
    totalInvoicedQty,
    totalWithdrawnQty,
    totalInvoicedValueDzd,
    totalWithdrawnValueDzd,
  };
}

export interface StockRowLike {
  wid?: string | number;
  warehouse?: string;
  name?: string;
  received?: number | string;
  withdrawn?: number | string;
  balance?: number | string;
}

export interface StockInLike {
  entry_date?: string;
  qty?: number | string;
  unit_price?: number | string;
  warehouse_id?: string | number;
  products?: { name?: string } | null;
  product_name?: string;
}

export interface AdjustmentLike {
  adj_date?: string;
  adjustment_type?: string;
  adj_type?: string;
  product_name?: string;
  warehouse_id?: string | number;
  qty?: number | string;
  unit_price?: number | string;
  amount_dzd?: number | string;
}

export interface StockValuationPoint {
  month: string;
  label: string;
  qtyBalance: number;
  valueDzd: number;
  receivedValueDzd: number;
  withdrawnValueDzd: number;
}

export interface StockValuationResult {
  totalStockValueDzd: number;
  totalQtyBalance: number;
  pricedProductsCount: number;
  stockWithValues: Array<StockRowLike & { unitPriceDzd: number; valueDzd: number }>;
  monthlySeries: StockValuationPoint[];
}

export function computeStockValuationAndMonthly(params: {
  stockRows: StockRowLike[];
  stockIn: StockInLike[];
  withdrawals: WithdrawalLike[];
  invoices: InvoiceLike[];
  adjustments?: AdjustmentLike[];
  products?: Array<{ name?: string; unit_price?: number | string }>;
  formatMonth?: (ym: string) => string;
}): StockValuationResult {
  const {
    stockRows = [],
    stockIn = [],
    withdrawals = [],
    invoices = [],
    adjustments = [],
    products = [],
    formatMonth = (ym) => ym,
  } = params;

  const priceAcc = new Map<string, { sum: number; weight: number }>();
  const addPriceSample = (name: unknown, unitPrice: unknown, weight: unknown = 1) => {
    const key = normalizeTextKey(name);
    const up = toFiniteNumber(unitPrice, true);
    const w = toFiniteNumber(weight, true) || 1;
    if (!key || up <= 0) return;
    const cur = priceAcc.get(key) || { sum: 0, weight: 0 };
    cur.sum += up * w;
    cur.weight += w;
    priceAcc.set(key, cur);
  };

  invoices.forEach((inv) => addPriceSample(inv.product_name, inv.unit_price, inv.qty || 1));
  stockIn.forEach((s) =>
    addPriceSample(s.products?.name || s.product_name, s.unit_price, s.qty || 1)
  );
  adjustments.forEach((a) => addPriceSample(a.product_name, a.unit_price, a.qty || 1));
  products.forEach((p) => addPriceSample(p.name, p.unit_price, 1));

  const priceMap = new Map<string, number>();
  priceAcc.forEach((acc, key) => {
    if (acc.weight > 0) priceMap.set(key, Number((acc.sum / acc.weight).toFixed(2)));
  });

  const getPrice = (name: unknown): number => priceMap.get(normalizeTextKey(name)) || 0;

  const stockWithValues = stockRows.map((r) => {
    const bal = toFiniteNumber(r.balance, false);
    const up = getPrice(r.name);
    const val = Math.max(0, bal) * up;
    return {
      ...r,
      unitPriceDzd: Number(up.toFixed(2)),
      valueDzd: Number(val.toFixed(2)),
    };
  });

  const totalQtyBalance = Number(
    stockWithValues.reduce((s, r) => s + Math.max(0, toFiniteNumber(r.balance, false)), 0).toFixed(2)
  );
  const totalStockValueDzd = Number(
    stockWithValues.reduce((s, r) => s + r.valueDzd, 0).toFixed(2)
  );

  const monthMap = new Map<
    string,
    { dq: number; dv: number; recVal: number; withVal: number }
  >();
  const ensureM = (ym: string) => {
    let m = monthMap.get(ym);
    if (!m) {
      m = { dq: 0, dv: 0, recVal: 0, withVal: 0 };
      monthMap.set(ym, m);
    }
    return m;
  };

  stockIn.forEach((r) => {
    const ym = String(r.entry_date || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    const q = toFiniteNumber(r.qty, true);
    const pName = r.products?.name || r.product_name || "";
    const up = toFiniteNumber(r.unit_price, true) || getPrice(pName);
    const v = q * up;
    const m = ensureM(ym);
    m.dq += q;
    m.dv += v;
    m.recVal += v;
  });

  const invById = new Map<string, InvoiceLike>();
  invoices.forEach((inv) => {
    if (inv?.id != null) invById.set(String(inv.id), inv);
  });

  withdrawals.forEach((w) => {
    const ym = String(w.w_date || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    const q = toFiniteNumber(w.qty, true);
    const ctx = (w.invoice_id != null ? invById.get(String(w.invoice_id)) : undefined) || w.invoices;
    const pName = w.invoices?.products?.name || ctx?.product_name || "";
    const up = toFiniteNumber(ctx?.unit_price, true) || getPrice(pName);
    const v = q * up;
    const m = ensureM(ym);
    m.dq -= q;
    m.dv -= v;
    m.withVal += v;
  });

  adjustments.forEach((a) => {
    const ym = String(a.adj_date || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    const q = toFiniteNumber(a.qty, true);
    const tp = a.adjustment_type || a.adj_type;
    const sign = tp === "returned_farmer" ? 1 : -1;
    const amt = toFiniteNumber(a.amount_dzd, true);
    const up = toFiniteNumber(a.unit_price, true) || getPrice(a.product_name);
    const v = amt > 0 ? amt : q * up;
    const m = ensureM(ym);
    m.dq += sign * q;
    m.dv += sign * v;
  });

  let runningQty = 0;
  let runningVal = 0;
  const monthlySeries: StockValuationPoint[] = [...monthMap.keys()]
    .sort()
    .map((ym) => {
      const m = monthMap.get(ym)!;
      runningQty = Math.max(0, runningQty + m.dq);
      runningVal = Math.max(0, runningVal + m.dv);
      return {
        month: ym,
        label: formatMonth(ym),
        qtyBalance: Number(runningQty.toFixed(2)),
        valueDzd: Number(runningVal.toFixed(2)),
        receivedValueDzd: Number(m.recVal.toFixed(2)),
        withdrawnValueDzd: Number(m.withVal.toFixed(2)),
      };
    });

  return {
    totalStockValueDzd,
    totalQtyBalance,
    pricedProductsCount: priceMap.size,
    stockWithValues,
    monthlySeries,
  };
}

export interface PerformanceKpisResult {
  avgProcessingDays: number;
  minProcessingDays: number;
  maxProcessingDays: number;
  processedDossiersCount: number;
  farmersToday: number;
  avgFarmersPerDay: number;
  peakFarmersPerDay: number;
  peakDate: string;
  totalFarmersServed: number;
  activeDaysCount: number;
}

export function computePerformanceKpis(params: {
  dossiers: Array<DossierLike & { reception_date?: string }>;
  invoices: InvoiceLike[];
  withdrawals: WithdrawalLike[];
  todayDate?: string;
}): PerformanceKpisResult {
  const {
    dossiers = [],
    invoices = [],
    withdrawals = [],
    todayDate = new Date().toISOString().slice(0, 10),
  } = params;

  const recByNo = new Map<string, string>();
  const recByCard = new Map<string, string>();
  const recByName = new Map<string, string>();

  dossiers.forEach((d) => {
    const dt = String(d.reception_date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) return;
    if (d.dossier_no) {
      const k = normalizeTextKey(d.dossier_no);
      if (!recByNo.has(k) || dt < recByNo.get(k)!) recByNo.set(k, dt);
    }
    if (d.farmer_card_no) {
      const k = normalizeTextKey(d.farmer_card_no);
      if (!recByCard.has(k) || dt < recByCard.get(k)!) recByCard.set(k, dt);
    }
    if (d.farmer_name) {
      const k = normalizeTextKey(d.farmer_name);
      if (!recByName.has(k) || dt < recByName.get(k)!) recByName.set(k, dt);
    }
  });

  const invById = new Map<string, InvoiceLike>();
  invoices.forEach((inv) => {
    if (inv?.id != null) invById.set(String(inv.id), inv);
  });

  const firstWByInv = new Map<string, string>();
  const farmersByDay = new Map<string, Set<string>>();
  const allFarmers = new Set<string>();

  withdrawals.forEach((w) => {
    const wDate = String(w.w_date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wDate)) return;
    const invIdKey = w.invoice_id != null ? String(w.invoice_id) : "";
    if (invIdKey && (!firstWByInv.has(invIdKey) || wDate < firstWByInv.get(invIdKey)!)) {
      firstWByInv.set(invIdKey, wDate);
    }
    const ctx = (invIdKey ? invById.get(invIdKey) : undefined) || w.invoices;
    const fName = normalizeTextKey(`${ctx?.client_name || ""} ${ctx?.farmer_name || ""}`) ||
      normalizeTextKey(ctx?.farmer_card_no) ||
      invIdKey;
    if (fName) {
      if (!farmersByDay.has(wDate)) farmersByDay.set(wDate, new Set());
      farmersByDay.get(wDate)!.add(fName);
      allFarmers.add(fName);
    }
  });

  const durations: number[] = [];
  invoices.forEach((inv) => {
    if (inv?.id == null) return;
    const firstW = firstWByInv.get(String(inv.id));
    if (!firstW) return;
    const recDate =
      (inv.dossier_no && recByNo.get(normalizeTextKey(inv.dossier_no))) ||
      (inv.farmer_card_no && recByCard.get(normalizeTextKey(inv.farmer_card_no))) ||
      recByName.get(normalizeTextKey(`${inv.client_name || ""} ${inv.farmer_name || ""}`)) ||
      recByName.get(normalizeTextKey(inv.farmer_name));
    if (!recDate) return;
    const diff = (new Date(firstW).getTime() - new Date(recDate).getTime()) / 86400000;
    if (Number.isFinite(diff) && diff >= 0 && diff <= 365) {
      durations.push(diff);
    }
  });

  const avgProcessingDays = durations.length
    ? Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1))
    : 0;
  const minProcessingDays = durations.length ? Number(Math.min(...durations).toFixed(1)) : 0;
  const maxProcessingDays = durations.length ? Number(Math.max(...durations).toFixed(1)) : 0;

  let peakFarmersPerDay = 0;
  let peakDate = "—";
  let sumDaily = 0;
  farmersByDay.forEach((set, day) => {
    sumDaily += set.size;
    if (set.size > peakFarmersPerDay) {
      peakFarmersPerDay = set.size;
      peakDate = day;
    }
  });

  return {
    avgProcessingDays,
    minProcessingDays,
    maxProcessingDays,
    processedDossiersCount: durations.length,
    farmersToday: farmersByDay.get(todayDate)?.size || 0,
    avgFarmersPerDay: farmersByDay.size
      ? Number((sumDaily / farmersByDay.size).toFixed(1))
      : 0,
    peakFarmersPerDay,
    peakDate,
    totalFarmersServed: allFarmers.size,
    activeDaysCount: farmersByDay.size,
  };
}

export interface YoYProductRow {
  product: string;
  receivedA: number;
  receivedB: number;
  receivedDiff: number;
  receivedPct: number | null;
  withdrawnA: number;
  withdrawnB: number;
  withdrawnDiff: number;
  withdrawnPct: number | null;
}

export function computeYoYProductComparison(params: {
  stockIn: StockInLike[];
  withdrawals: WithdrawalLike[];
  invoices?: InvoiceLike[];
  yearA: string;
  yearB: string;
}): YoYProductRow[] {
  const { stockIn = [], withdrawals = [], invoices = [], yearA, yearB } = params;
  const yA = String(yearA || "").trim();
  const yB = String(yearB || "").trim();
  if (!yA || !yB) return [];

  const invById = new Map<string, InvoiceLike>();
  invoices.forEach((inv) => {
    if (inv?.id != null) invById.set(String(inv.id), inv);
  });

  const map = new Map<
    string,
    { label: string; recA: number; recB: number; wA: number; wB: number }
  >();
  const ensureP = (rawName: unknown) => {
    const clean = String(rawName || "غير محدد").trim() || "غير محدد";
    const key = normalizeTextKey(clean) || clean;
    let cur = map.get(key);
    if (!cur) {
      cur = { label: clean, recA: 0, recB: 0, wA: 0, wB: 0 };
      map.set(key, cur);
    }
    return cur;
  };

  stockIn.forEach((r) => {
    const yr = String(r.entry_date || "").slice(0, 4);
    if (yr !== yA && yr !== yB) return;
    const p = ensureP(r.products?.name || r.product_name);
    const q = toFiniteNumber(r.qty, true);
    if (yr === yA) p.recA += q;
    if (yr === yB) p.recB += q;
  });

  withdrawals.forEach((w) => {
    const yr = String(w.w_date || "").slice(0, 4);
    if (yr !== yA && yr !== yB) return;
    const ctx = (w.invoice_id != null ? invById.get(String(w.invoice_id)) : undefined) || w.invoices;
    const pName = ctx?.product_name || w.invoices?.products?.name || "غير محدد";
    const p = ensureP(pName);
    const q = toFiniteNumber(w.qty, true);
    if (yr === yA) p.wA += q;
    if (yr === yB) p.wB += q;
  });

  const calcPct = (base: number, curr: number): number | null => {
    if (base <= 0) return curr > 0 ? 100 : 0;
    return Number((((curr - base) / base) * 100).toFixed(1));
  };

  return [...map.values()]
    .map((p) => {
      const recA = Number(p.recA.toFixed(2));
      const recB = Number(p.recB.toFixed(2));
      const wA = Number(p.wA.toFixed(2));
      const wB = Number(p.wB.toFixed(2));
      return {
        product: p.label,
        receivedA: recA,
        receivedB: recB,
        receivedDiff: Number((recB - recA).toFixed(2)),
        receivedPct: calcPct(recA, recB),
        withdrawnA: wA,
        withdrawnB: wB,
        withdrawnDiff: Number((wB - wA).toFixed(2)),
        withdrawnPct: calcPct(wA, wB),
      };
    })
    .filter((r) => r.receivedA > 0 || r.receivedB > 0 || r.withdrawnA > 0 || r.withdrawnB > 0)
    .sort(
      (a, b) =>
        Math.max(b.receivedB + b.withdrawnB, b.receivedA + b.withdrawnA) -
        Math.max(a.receivedB + a.withdrawnB, a.receivedA + a.withdrawnA)
    );
}

