import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import jsQR from "jsqr";

export interface DossierPdfItem {
  dossier_no?: string;
  farmer_card_no?: string;
  reception_date?: string;
  zone?: string;
  farmer_name?: string;
  culture?: string;
  phone?: string;
  superficie?: number | string | null;
  secteur?: string;
  camp?: string;
}

function escHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] || c;
  });
}

function fmtArea(v: number | string | null | undefined): string {
  if (v === "" || v === null || v === undefined) return "—";
  const num = Number(v);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

interface RuntimeAppSettings {
  orgName?: string;
  activeCampaign?: string;
  reportFooter?: string;
  printShowLogo?: boolean;
  printOrientation?: "landscape" | "portrait";
  unitLabel?: string;
}

function readRuntimeSettings(): Required<RuntimeAppSettings> {
  const s = (typeof window !== "undefined" && (window as unknown as { getAppSettings?: () => RuntimeAppSettings }).getAppSettings?.()) || {};
  return {
    orgName: s.orgName || "الديوان الجزائري المهني للحبوب - تعاونية الحبوب والبقول الجافة أدرار (CCLS ADRAR)",
    activeCampaign: s.activeCampaign || "2026/2027",
    reportFooter: s.reportFooter || "نظام تسيير مخزون الأسمدة - CCLS ADRAR",
    printShowLogo: s.printShowLogo !== false,
    printOrientation: s.printOrientation === "portrait" ? "portrait" : "landscape",
    unitLabel: s.unitLabel || "قنطار",
  };
}

export function buildDossiersReportHtml(
  items: DossierPdfItem[],
  pageIndex?: number,
  totalPages?: number
): string {
  const cfg = readRuntimeSettings();
  const todayStr = new Date().toLocaleDateString("fr-FR");
  const totalArea = items.reduce((sum, d) => {
    const n = Number(d.superficie || 0);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
  const pageLabel =
    pageIndex !== undefined && totalPages !== undefined
      ? `صفحة ${pageIndex + 1} من ${totalPages}`
      : `إجمالي الملفات: ${items.length}`;

  const rowsHtml = items
    .map(
      (d) => `
      <tr style="break-inside:avoid;">
        <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;font-weight:700;color:#1f5a3d;">${escHtml(d.dossier_no)}</td>
        <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;white-space:nowrap;">${escHtml(d.farmer_card_no || "—")}</td>
        <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;white-space:nowrap;">${escHtml(d.reception_date || "—")}</td>
        <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:right;">${escHtml(d.zone || "—")}</td>
        <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:right;font-weight:600;">${escHtml(d.farmer_name || "—")}</td>
        <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(d.culture || "—")}</td>
        <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;direction:ltr;white-space:nowrap;">${escHtml(d.phone || "—")}</td>
        <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(fmtArea(d.superficie))}</td>
        <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(d.secteur || "/")}</td>
      </tr>`
    )
    .join("");

  const logoImg = cfg.printShowLogo
    ? `<img src="f761c70c-5eb3-4726-ab98-708bc5fb8c35.jfif" alt="CCLS" style="height:54px;width:auto;object-fit:contain;" />`
    : `<span style="width:54px;display:inline-block;"></span>`;

  return `
    <div dir="rtl" style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#ffffff;color:#1d2b22;padding:18px 22px;box-sizing:border-box;">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1f5a3d;padding-bottom:10px;margin-bottom:12px;">
        ${logoImg}
        <div style="text-align:center;">
          <div style="font-size:13px;font-weight:700;color:#1f5a3d;">${escHtml(cfg.orgName)}</div>
          <div style="font-size:17px;font-weight:700;margin-top:3px;color:#111111;">قائمة ملفات الفلاحين المسجلة - موسم ${escHtml(cfg.activeCampaign)}</div>
          <div style="font-size:11px;color:#55635a;margin-top:2px;">تاريخ الطباعة: ${escHtml(todayStr)} | ${escHtml(pageLabel)} | المساحة بهذه القائمة: ${escHtml(fmtArea(totalArea))} هكتار</div>
        </div>
        ${logoImg}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;color:#1d2b22;background:#ffffff;">
        <thead>
          <tr style="background:#e8f2ec;color:#1f5a3d;">
            <th style="border:1px solid #b8c9be;padding:7px 8px;text-align:center;">رقم الملف</th>
            <th style="border:1px solid #b8c9be;padding:7px 8px;text-align:center;">بطاقة الفلاح</th>
            <th style="border:1px solid #b8c9be;padding:7px 8px;text-align:center;">التاريخ</th>
            <th style="border:1px solid #b8c9be;padding:7px 8px;text-align:right;">المنطقة</th>
            <th style="border:1px solid #b8c9be;padding:7px 8px;text-align:right;">اسم الفلاح / المنتج</th>
            <th style="border:1px solid #b8c9be;padding:7px 8px;text-align:center;">الزراعة</th>
            <th style="border:1px solid #b8c9be;padding:7px 8px;text-align:center;">رقم الهاتف</th>
            <th style="border:1px solid #b8c9be;padding:7px 8px;text-align:center;">المساحة (هكتار)</th>
            <th style="border:1px solid #b8c9be;padding:7px 8px;text-align:center;">القطاع</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:11px;color:#55635a;">
        <span>${escHtml(cfg.reportFooter)}</span>
        <span>إمضاء المسؤول: ..............................</span>
      </div>
    </div>
  `;
}

function savePdfBlob(pdf: jsPDF, filename: string): void {
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
}

function prepareClonedDoc(clonedDoc: Document, hostId: string): void {
  ["app", "cfg", "login", "toast", "dossiersPrintReport", "etatPrintReport", "analyticsPrintReport"].forEach((id) => {
    const el = clonedDoc.getElementById(id);
    if (el) el.remove();
  });
  const header = clonedDoc.querySelector("header");
  if (header) header.remove();

  clonedDoc.documentElement.style.cssText = "background:#ffffff;margin:0;padding:0;overflow:visible;";
  clonedDoc.body.style.cssText = "background:#ffffff;color:#111111;margin:0;padding:0;overflow:visible;";

  const clonedHost = clonedDoc.getElementById(hostId);
  if (clonedHost) {
    clonedHost.style.position = "relative";
    clonedHost.style.left = "0";
    clonedHost.style.top = "0";
    clonedHost.style.zIndex = "1";
    clonedHost.style.margin = "0";
  }
}

async function waitImages(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      if (!img.complete) {
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
        });
      }
      if (typeof img.decode === "function") {
        await img.decode().catch(() => {});
      }
    })
  );
}

async function exportDossiersPdf(items: DossierPdfItem[]): Promise<void> {
  if (!items || !items.length) {
    throw new Error("لا توجد ملفات مسجلة للتصدير");
  }

  const ROWS_PER_PAGE = 17;
  const chunks: DossierPdfItem[][] = [];
  for (let i = 0; i < items.length; i += ROWS_PER_PAGE) {
    chunks.push(items.slice(i, i + ROWS_PER_PAGE));
  }

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const host = document.createElement("div");
  host.id = "pdfRenderHost";
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1120px;background:#ffffff;color:#1d2b22;z-index:-1;";
  document.body.appendChild(host);

  try {
    for (let idx = 0; idx < chunks.length; idx++) {
      host.innerHTML = buildDossiersReportHtml(chunks[idx], idx, chunks.length);
      await waitImages(host);

      const canvas = await html2canvas(host, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1120,
        onclone: (clonedDoc) => prepareClonedDoc(clonedDoc, "pdfRenderHost"),
      });

      if (!canvas.width || !canvas.height) {
        throw new Error("تعذّر رسم صفحة PDF");
      }

      const imgData = canvas.toDataURL("image/png");
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
      const renderW = canvas.width * ratio;
      const renderH = canvas.height * ratio;

      if (idx > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, 0, renderW, renderH);
    }

    const stamp = new Date().toISOString().slice(0, 10);
    savePdfBlob(pdf, `dossiers-2026-2027-${stamp}.pdf`);
  } finally {
    host.remove();
  }
}

function printDossiersList(items: DossierPdfItem[]): void {
  const el = document.getElementById("dossiersPrintReport");
  if (!el) {
    window.print();
    return;
  }
  el.innerHTML = buildDossiersReportHtml(items);
  document.body.classList.add("printing-list");
  let printed = false;
  const cleanup = () => {
    document.body.classList.remove("printing-list");
    el.hidden = true;
    window.removeEventListener("afterprint", cleanup);
    window.removeEventListener("beforeprint", onBeforePrint);
  };
  const onBeforePrint = () => {
    printed = true;
  };
  window.addEventListener("beforeprint", onBeforePrint, { once: true });
  window.addEventListener("afterprint", cleanup, { once: true });
  try {
    window.print();
  } catch (_) {
    // fallback handled below
  }
  setTimeout(() => {
    if (!printed) {
      cleanup();
      exportDossiersPdf(items).catch((err) => console.error(err));
    }
  }, 550);
}

export type BonPrintFormat = "a4" | "half" | "2up";

export interface SlipPdfOptions {
  format?: BonPrintFormat;
}

export function buildBonQrPayload(bonNo: string): string {
  const clean = String(bonNo || "").trim();
  if (!clean) return "";
  if (typeof window !== "undefined" && window.location && /^https?:$/i.test(window.location.protocol)) {
    return `${window.location.origin}/verify.html?bon=${encodeURIComponent(clean)}`;
  }
  return `BON:${clean}`;
}

export function extractBonNoFromScan(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  if (text.length > 512) return "";

  // 1. Check URL (?verify=... or ?bon=...)
  if (/^https?:\/\//i.test(text) || text.includes("verify=") || text.includes("bon=")) {
    try {
      const parsed = new URL(text.startsWith("http") ? text : `https://local.invalid/${text.replace(/^\/+/, "")}`);
      const candidate = parsed.searchParams.get("verify") || parsed.searchParams.get("bon") || parsed.searchParams.get("bon_no");
      if (candidate) return candidate.trim();
    } catch {
      const m = text.match(/[?&](?:verify|bon|bon_no)=([^&#]+)/i);
      if (m?.[1]) {
        try {
          return decodeURIComponent(m[1]).trim();
        } catch {
          return m[1].trim();
        }
      }
    }
  }

  // 2. Check JSON payload {"bon_no":"..."} or {"bon":"..."}
  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const val = obj.bon_no ?? obj.bon ?? obj.verify ?? obj.id;
      if (val !== undefined && val !== null) return String(val).trim();
    } catch {
      // ignore invalid JSON
    }
  }

  // 3. Check BON:1691 or CCLS-BON:1691
  const prefixMatch = text.match(/^(?:CCLS[-_])?BON\s*[:#-]\s*([^\s|;]+)/i);
  if (prefixMatch?.[1]) {
    return prefixMatch[1].trim();
  }

  return text;
}

export async function generateBonQrDataUrl(bonNo: string): Promise<string> {
  const payload = buildBonQrPayload(bonNo);
  if (!payload) return "";
  return QRCode.toDataURL(payload, {
    width: 240,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#14221a",
      light: "#ffffff",
    },
  });
}

export function decodeQrFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): string | null {
  if (!data || !width || !height) return null;
  const hit = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  return hit?.data ? hit.data : null;
}

export async function decodeQrFromFile(file: File): Promise<string | null> {
  if (!file) return null;
  const objUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("تعذّر قراءة ملف الصورة"));
      img.src = objUrl;
    });
    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    return decodeQrFromImageData(imgData.data, w, h);
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

async function exportSlipPdf(
  sourceEl: HTMLElement | null,
  fileSuffix?: string,
  filePrefix = "accuse-dossier",
  options?: SlipPdfOptions
): Promise<void> {
  if (!sourceEl || !sourceEl.innerHTML.trim()) {
    throw new Error("لا يوجد وصل جاهز للطباعة أو التحميل");
  }

  const isLandscape = filePrefix === "etat-sortie" || Boolean(sourceEl.querySelector(".etat-doc"));
  const fmt: BonPrintFormat | undefined =
    options?.format ||
    (sourceEl.querySelector(".bon-2up-wrap")
      ? "2up"
      : sourceEl.querySelector(".bon-fmt-half")
        ? "half"
        : sourceEl.querySelector(".bon-fmt-a4")
          ? "a4"
          : undefined);
  const isHalfA5 = !isLandscape && fmt === "half";
  const hostWidth = isLandscape ? 1120 : 794;

  const host = document.createElement("div");
  host.id = "pdfSlipHost";
  host.style.cssText =
    `position:fixed;left:-10000px;top:0;width:${hostWidth}px;background:#ffffff;color:#111111;padding:${isHalfA5 ? "10px 14px" : "16px"};box-sizing:border-box;z-index:-1;direction:ltr;text-align:left;`;
  host.innerHTML =
    isLandscape || filePrefix === "bon-sortie"
      ? sourceEl.innerHTML
      : `<div class="slip-wrap">${sourceEl.innerHTML}</div>`;
  document.body.appendChild(host);

  try {
    await waitImages(host);

    const canvas = await html2canvas(host, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: hostWidth,
      onclone: (clonedDoc) => prepareClonedDoc(clonedDoc, "pdfSlipHost"),
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("تعذّر رسم الوثيقة بصيغة PDF");
    }

    const pdf = isHalfA5
      ? new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" })
      : new jsPDF({
          orientation: isLandscape ? "landscape" : "portrait",
          unit: "mm",
          format: "a4",
        });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = isHalfA5 ? 4 : 5;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const ratio = Math.min(usableW / canvas.width, usableH / canvas.height);
    const renderW = canvas.width * ratio;
    const renderH = canvas.height * ratio;
    const offsetX = (pageW - renderW) / 2;

    pdf.addImage(canvas.toDataURL("image/png"), "PNG", offsetX, margin, renderW, renderH);
    const cleanSuffix = String(fileSuffix || "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "");
    const fmtTag = fmt && filePrefix === "bon-sortie" ? `-${fmt}` : "";
    savePdfBlob(pdf, `${filePrefix}${cleanSuffix ? "-" + cleanSuffix : ""}${fmtTag}.pdf`);
  } finally {
    host.remove();
  }
}

export interface AnalyticsReportPayload {
  filters?: {
    year?: string;
    warehouse?: string;
    product?: string;
    culture?: string;
    region?: string;
  };
  cards: Array<{ label: string; value: string }>;
  cropRows: Array<{
    culture: string;
    invoiceCount: number;
    withdrawalCount?: number;
    invoicedQty: number;
    withdrawnQty: number;
    remainingQty: number;
    invoicedValueDzd?: number;
    withdrawnValueDzd?: number;
    topProduct: string;
  }>;
  monthlyRows: Array<{
    month: string;
    label: string;
    receiptCount: number;
    receivedQty: number;
    withdrawnQty: number;
    topProduct: string;
  }>;
  remainingRows?: Array<{
    name: string;
    warehouse?: string;
    received: number;
    withdrawn: number;
    balance: number;
  }>;
}

export function buildAnalyticsReportHtml(payload: AnalyticsReportPayload): string {
  const nowStr = new Date().toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const f = payload.filters || {};
  const filterParts = [
    `السنة: ${f.year || "الكل"}`,
    `المخزن: ${f.warehouse || "الكل"}`,
    `السماد: ${f.product || "الكل"}`,
    `المحصول: ${f.culture || "الكل"}`,
    `المنطقة: ${f.region || "الكل"}`,
  ];

  const cardsHtml = (payload.cards || [])
    .map(
      (c) => `
      <div style="border:1px solid #c5d3ca;background:#f8faf8;border-radius:6px;padding:10px 12px;">
        <div style="font-size:11px;color:#55635a;margin-bottom:4px;">${escHtml(c.label)}</div>
        <div style="font-size:16px;font-weight:700;color:#175236;">${escHtml(c.value)}</div>
      </div>`
    )
    .join("");

  const maxCropQty = Math.max(
    1,
    ...(payload.cropRows || []).map((r) => Math.max(Number(r.withdrawnQty || 0), Number(r.invoicedQty || 0)))
  );

  const cropTableRows = (payload.cropRows || []).length
    ? payload.cropRows
        .map((r) => {
          const pct = r.invoicedQty > 0 ? (r.withdrawnQty / r.invoicedQty) * 100 : 0;
          const barVal = Math.max(Number(r.withdrawnQty || 0), Number(r.invoicedQty || 0));
          const barWidth = Math.max(4, Math.min(100, Math.round((barVal / maxCropQty) * 100)));
          return `
          <tr style="break-inside:avoid;">
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:right;font-weight:700;color:#175236;">
              <div>${escHtml(r.culture)}</div>
              <div style="margin-top:3px;height:5px;width:100%;background:#e6ece8;border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${barWidth}%;background:#175236;"></div>
              </div>
            </td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(r.invoiceCount)}</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(r.withdrawalCount ?? 0)}</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(fmtArea(r.invoicedQty))}</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;font-weight:700;">${escHtml(fmtArea(r.withdrawnQty))}</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(fmtArea(r.remainingQty))}</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(fmtArea(pct))}%</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${r.invoicedValueDzd && r.invoicedValueDzd > 0 ? escHtml(fmtArea(r.invoicedValueDzd)) : "—"}</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(r.topProduct || "—")}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="9" style="border:1px solid #cfd8dc;padding:12px;text-align:center;color:#55635a;">لا توجد بيانات محاصيل مطابقة للفلاتر المحددة.</td></tr>`;

  const monthlyTableRows = (payload.monthlyRows || []).length
    ? payload.monthlyRows
        .map((m) => {
          const net = Number(m.receivedQty || 0) - Number(m.withdrawnQty || 0);
          return `
          <tr style="break-inside:avoid;">
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:right;font-weight:700;">${escHtml(m.label)} (${escHtml(m.month)})</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(m.receiptCount)}</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(fmtArea(m.receivedQty))}</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(fmtArea(m.withdrawnQty))}</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;color:${net < 0 ? "#b91c1c" : "#175236"};font-weight:700;">${net >= 0 ? "+" : ""}${escHtml(fmtArea(net))}</td>
            <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(m.topProduct || "—")}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" style="border:1px solid #cfd8dc;padding:12px;text-align:center;color:#55635a;">لا توجد عمليات شهرية مطابقة للفلاتر المحددة.</td></tr>`;

  const cfg = readRuntimeSettings();
  const logoImg = cfg.printShowLogo
    ? `<img src="f761c70c-5eb3-4726-ab98-708bc5fb8c35.jfif" alt="CCLS" style="height:52px;width:auto;object-fit:contain;" />`
    : `<span style="width:52px;display:inline-block;"></span>`;

  return `
    <div dir="rtl" style="font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;background:#ffffff;color:#14221a;padding:18px 22px;box-sizing:border-box;">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #175236;padding-bottom:10px;margin-bottom:12px;gap:12px;">
        ${logoImg}
        <div style="text-align:center;flex:1;">
          <div style="font-size:13px;font-weight:700;color:#175236;">${escHtml(cfg.orgName)}</div>
          <div style="font-size:17px;font-weight:700;margin-top:3px;color:#111111;">التقرير التحليلي لاستهلاك الأسمدة حسب المحصول والواردات الشهرية</div>
          <div style="font-size:11px;color:#55635a;margin-top:3px;">تاريخ الطباعة: ${escHtml(nowStr)} | ${escHtml(filterParts.join(" · "))}</div>
        </div>
        ${logoImg}
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px;">
        ${cardsHtml}
      </div>

      <div style="font-size:13px;font-weight:700;color:#175236;margin:10px 0 6px;">1. توزيع الفواتير والكميات المسحوبة حسب نوع المحصول (Culture)</div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;color:#14221a;background:#ffffff;margin-bottom:14px;">
        <thead>
          <tr style="background:#e8f2ec;color:#175236;">
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:right;">المحصول</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">الفواتير</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">السحوبات</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">المفوتر (${escHtml(cfg.unitLabel)})</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">المسحوب (${escHtml(cfg.unitLabel)})</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">المتبقي (${escHtml(cfg.unitLabel)})</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">نسبة التسليم</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">القيمة المفوترة (دج)</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">السماد الأكثر طلباً</th>
          </tr>
        </thead>
        <tbody>
          ${cropTableRows}
        </tbody>
      </table>

      <div style="font-size:13px;font-weight:700;color:#175236;margin:10px 0 6px;">2. التقرير الشهري للواردات والتسليمات</div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;color:#14221a;background:#ffffff;margin-bottom:14px;">
        <thead>
          <tr style="background:#e8f2ec;color:#175236;">
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:right;">الشهر</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">عمليات الوارد</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">إجمالي الوارد (${escHtml(cfg.unitLabel)})</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">إجمالي التسليمات (${escHtml(cfg.unitLabel)})</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">صافي الرصيد الشهري</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">السماد الأبرز وارداً</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyTableRows}
        </tbody>
      </table>

      ${(payload.remainingRows || []).length ? `
      <div style="font-size:13px;font-weight:700;color:#175236;margin:10px 0 6px;">3. الأرصدة والكميات المتبقية بالمخازن</div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;color:#14221a;background:#ffffff;">
        <thead>
          <tr style="background:#e8f2ec;color:#175236;">
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:right;">السماد</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">المخزن</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">الوارد (${escHtml(cfg.unitLabel)})</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">المسحوب (${escHtml(cfg.unitLabel)})</th>
            <th style="border:1px solid #b8c9be;padding:6px 8px;text-align:center;">الرصيد المتبقي (${escHtml(cfg.unitLabel)})</th>
          </tr>
        </thead>
        <tbody>
          ${(payload.remainingRows || []).map((r) => `
            <tr style="break-inside:avoid;">
              <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:right;font-weight:700;">${escHtml(r.name)}</td>
              <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(r.warehouse || "—")}</td>
              <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(fmtArea(r.received))}</td>
              <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;">${escHtml(fmtArea(r.withdrawn))}</td>
              <td style="border:1px solid #cfd8dc;padding:6px 8px;text-align:center;font-weight:700;color:${Number(r.balance || 0) <= 0 ? "#b91c1c" : "#175236"};">${escHtml(fmtArea(r.balance))}</td>
            </tr>`).join("")}
        </tbody>
      </table>` : ""}

      <div style="display:flex;justify-content:space-between;margin-top:16px;font-size:11px;color:#55635a;">
        <span>${escHtml(cfg.reportFooter)}</span>
        <span>توقيع الإدارة / المصلحة المختصة: ..............................</span>
      </div>
    </div>
  `;
}

async function exportAnalyticsPdf(payload: AnalyticsReportPayload): Promise<void> {
  const host = document.createElement("div");
  host.id = "pdfAnalyticsHost";
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1120px;background:#ffffff;color:#14221a;z-index:-1;";
  host.innerHTML = buildAnalyticsReportHtml(payload);
  document.body.appendChild(host);

  try {
    await waitImages(host);

    const canvas = await html2canvas(host, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1120,
      onclone: (clonedDoc) => prepareClonedDoc(clonedDoc, "pdfAnalyticsHost"),
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("تعذّر إنشاء صورة التقرير");
    }

    const cfg = readRuntimeSettings();
    const pdf = new jsPDF({ orientation: cfg.printOrientation, unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 4;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const pxPerMm = canvas.width / usableW;
    const pageSliceHeightPx = Math.floor(usableH * pxPerMm);
    let offsetY = 0;
    let pageIdx = 0;

    while (offsetY < canvas.height) {
      const sliceH = Math.min(pageSliceHeightPx, canvas.height - offsetY);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      }
      const imgData = sliceCanvas.toDataURL("image/png");
      const renderH = sliceH / pxPerMm;
      if (pageIdx > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, margin, usableW, renderH);
      offsetY += sliceH;
      pageIdx += 1;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    savePdfBlob(pdf, `ccls-analytics-report-${stamp}.pdf`);
  } finally {
    host.remove();
  }
}

function printAnalyticsReport(
  payload: AnalyticsReportPayload,
  onNotice?: (msg: string, isErr?: boolean) => void
): void {
  const el = document.getElementById("analyticsPrintReport");
  if (!el) {
    window.print();
    return;
  }
  el.innerHTML = buildAnalyticsReportHtml(payload);
  el.hidden = false;
  document.body.classList.add("printing-list");

  let printed = false;
  const cleanup = () => {
    document.body.classList.remove("printing-list");
    el.hidden = true;
    window.removeEventListener("afterprint", cleanup);
    window.removeEventListener("beforeprint", onBeforePrint);
  };
  const onBeforePrint = () => {
    printed = true;
  };
  window.addEventListener("beforeprint", onBeforePrint, { once: true });
  window.addEventListener("afterprint", cleanup, { once: true });

  try {
    window.print();
  } catch (_) {
    // Fallback handled below when window.print is blocked inside sandboxed iframe
  }

  setTimeout(() => {
    if (!printed) {
      cleanup();
      exportAnalyticsPdf(payload)
        .then(() => {
          onNotice?.("تم تنزيل التقرير بصيغة PDF تلقائياً (الطباعة المباشرة غير متاحة في نافذة المعاينة)");
        })
        .catch((err) => {
          console.error(err);
          onNotice?.(err?.message || "تعذّر طباعة أو تصدير التقرير", true);
        });
    }
  }, 550);
}

declare global {
  interface Window {
    exportDossiersPdf?: (items: DossierPdfItem[]) => Promise<void>;
    printDossiersList?: (items: DossierPdfItem[]) => void;
    exportSlipPdf?: (
      sourceEl: HTMLElement | null,
      fileSuffix?: string,
      filePrefix?: string,
      options?: SlipPdfOptions
    ) => Promise<void>;
    exportAnalyticsPdf?: (payload: AnalyticsReportPayload) => Promise<void>;
    printAnalyticsReport?: (payload: AnalyticsReportPayload, onNotice?: (msg: string, isErr?: boolean) => void) => void;
    buildBonQrPayload?: (bonNo: string) => string;
    extractBonNoFromScan?: (raw: unknown) => string;
    generateBonQrDataUrl?: (bonNo: string) => Promise<string>;
    decodeQrFromImageData?: (data: Uint8ClampedArray, width: number, height: number) => string | null;
    decodeQrFromFile?: (file: File) => Promise<string | null>;
  }
}

window.exportDossiersPdf = exportDossiersPdf;
window.printDossiersList = printDossiersList;
window.exportSlipPdf = exportSlipPdf;
window.exportAnalyticsPdf = exportAnalyticsPdf;
window.printAnalyticsReport = printAnalyticsReport;
window.buildBonQrPayload = buildBonQrPayload;
window.extractBonNoFromScan = extractBonNoFromScan;
window.generateBonQrDataUrl = generateBonQrDataUrl;
window.decodeQrFromImageData = decodeQrFromImageData;
window.decodeQrFromFile = decodeQrFromFile;
