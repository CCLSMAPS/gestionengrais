import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export interface DossierPdfItem {
  dossier_no?: string;
  reception_date?: string;
  zone?: string;
  farmer_name?: string;
  culture?: string;
  phone?: string;
  superficie?: number | string | null;
  secteur?: string;
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

export function buildDossiersReportHtml(
  items: DossierPdfItem[],
  pageIndex?: number,
  totalPages?: number
): string {
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

  return `
    <div dir="rtl" style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#ffffff;color:#1d2b22;padding:18px 22px;box-sizing:border-box;">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1f5a3d;padding-bottom:10px;margin-bottom:12px;">
        <img src="f761c70c-5eb3-4726-ab98-708bc5fb8c35.jfif" alt="CCLS" style="height:54px;width:auto;object-fit:contain;" />
        <div style="text-align:center;">
          <div style="font-size:13px;font-weight:700;color:#1f5a3d;">الديوان الجزائري المهني للحبوب - تعاونية الحبوب والبقول الجافة أدرار (CCLS ADRAR)</div>
          <div style="font-size:17px;font-weight:700;margin-top:3px;color:#111111;">قائمة ملفات الفلاحين المسجلة - موسم 2026/2027</div>
          <div style="font-size:11px;color:#55635a;margin-top:2px;">تاريخ الطباعة: ${escHtml(todayStr)} | ${escHtml(pageLabel)} | المساحة بهذه القائمة: ${escHtml(fmtArea(totalArea))} هكتار</div>
        </div>
        <img src="f761c70c-5eb3-4726-ab98-708bc5fb8c35.jfif" alt="CCLS" style="height:54px;width:auto;object-fit:contain;" />
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;color:#1d2b22;background:#ffffff;">
        <thead>
          <tr style="background:#e8f2ec;color:#1f5a3d;">
            <th style="border:1px solid #b8c9be;padding:7px 8px;text-align:center;">رقم الملف</th>
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
        <span>تسيير مخزون الأسمدة - CCLS ADRAR</span>
        <span>إمضاء المسؤول: ..............................</span>
      </div>
    </div>
  `;
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
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1120px;background:#ffffff;z-index:-1;";
  document.body.appendChild(host);

  try {
    for (let idx = 0; idx < chunks.length; idx++) {
      host.innerHTML = buildDossiersReportHtml(chunks[idx], idx, chunks.length);
      const imgs = Array.from(host.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((res) => {
                img.onload = () => res();
                img.onerror = () => res();
              })
        )
      );

      const canvas = await html2canvas(host, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
      const renderW = canvas.width * ratio;
      const renderH = canvas.height * ratio;

      if (idx > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, 0, renderW, renderH);
    }

    const stamp = new Date().toISOString().slice(0, 10);
    pdf.save(`dossiers-2026-2027-${stamp}.pdf`);
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
  el.hidden = false;
  document.body.classList.add("printing-list");
  const cleanup = () => {
    document.body.classList.remove("printing-list");
    el.hidden = true;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

declare global {
  interface Window {
    exportDossiersPdf?: (items: DossierPdfItem[]) => Promise<void>;
    printDossiersList?: (items: DossierPdfItem[]) => void;
  }
}

window.exportDossiersPdf = exportDossiersPdf;
window.printDossiersList = printDossiersList;
