import React, { useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  aggregateCropInvoicesAndWithdrawals,
  computeStockValuationAndMonthly,
  computePerformanceKpis,
  computeYoYProductComparison,
  type CropConsumptionItem,
  type StockValuationPoint,
  type YoYProductRow,
} from "./analytics-aggregator";

export type { CropConsumptionItem, StockValuationPoint, YoYProductRow };

export interface CropConsumptionPayload {
  items: CropConsumptionItem[];
  fertilizerKeys: string[];
}

export interface MonthlyReceiptItem {
  month: string;
  label: string;
  receivedQty: number;
  withdrawnQty: number;
  receiptCount: number;
  topProduct: string;
  [productSeries: string]: string | number;
}

export interface MonthlyReceiptsPayload {
  items: MonthlyReceiptItem[];
  productKeys: string[];
}

export interface StockBalanceItem {
  wid?: string | number;
  warehouse?: string;
  name: string;
  received: number;
  withdrawn: number;
  balance: number;
  daily?: number;
  reorder_point?: number;
  cover_days?: number;
}

export interface RemainingStockPayload {
  items: StockBalanceItem[];
  threshold: number;
}

interface Palette {
  primary: string;
  primaryHover: string;
  accent: string;
  bad: string;
  border: string;
  text: string;
  muted: string;
  card: string;
  surface2: string;
}

const CHART_SERIES_COLORS = [
  "#175236",
  "#b97d19",
  "#2f6f8f",
  "#4f772d",
  "#8f3d56",
  "#6d4c3d",
];

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    primary: get("--pr", "#175236"),
    primaryHover: get("--pr-hover", "#113f29"),
    accent: get("--ac", "#b97d19"),
    bad: get("--bad", "#b91c1c"),
    border: get("--bd", "#dfe4dd"),
    text: get("--tx", "#14221a"),
    muted: get("--mu", "#57675d"),
    card: get("--card", "#ffffff"),
    surface2: get("--surface-2", "#eef2ed"),
  };
}

function formatNum(v: number): string {
  return Number(v || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function useThemeAndViewport() {
  const [palette, setPalette] = useState<Palette>(() => readPalette());
  const [vw, setVw] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onTheme = () => requestAnimationFrame(() => setPalette(readPalette()));
    const onResize = () => setVw(window.innerWidth);
    mq.addEventListener("change", onTheme);
    window.addEventListener("ccls:theme-change", onTheme);
    window.addEventListener("resize", onResize);
    return () => {
      mq.removeEventListener("change", onTheme);
      window.removeEventListener("ccls:theme-change", onTheme);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return { palette, vw, isPhone: vw < 640 };
}

interface CropTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: CropConsumptionItem }>;
  palette: Palette;
  totalInvoiced: number;
  totalWithdrawn: number;
  fertilizerKeys: string[];
}

function CropTooltip({
  active,
  payload,
  palette,
  totalInvoiced,
  totalWithdrawn,
  fertilizerKeys,
}: CropTooltipProps) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  const fulfillPct =
    item.invoicedQty > 0 ? (item.withdrawnQty / item.invoicedQty) * 100 : 0;
  const shareBase = totalWithdrawn > 0 ? totalWithdrawn : totalInvoiced;
  const shareVal = totalWithdrawn > 0 ? item.withdrawnQty : item.invoicedQty;
  const sharePct = shareBase > 0 ? (shareVal / shareBase) * 100 : 0;
  const fertilizerBreakdown = fertilizerKeys
    .map((k) => ({ key: k, val: Number(item[k] || 0) }))
    .filter((x) => x.val > 0)
    .sort((a, b) => b.val - a.val)
    .slice(0, 5);

  return (
    <div
      dir="rtl"
      style={{
        backgroundColor: palette.card,
        color: palette.text,
        border: `1px solid ${palette.border}`,
        borderRadius: "8px",
        padding: "10px 13px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
        fontSize: "0.86rem",
        lineHeight: 1.65,
        minWidth: "225px",
      }}
    >
      <div style={{ fontWeight: 700, color: palette.primary, marginBottom: "4px" }}>
        {item.culture}
      </div>
      <div>
        المسحوب فعلياً:{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatNum(item.withdrawnQty)} قنطار
        </strong>
      </div>
      <div>
        المفوتر الإجمالي:{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatNum(item.invoicedQty)} قنطار
        </strong>
      </div>
      <div style={{ color: palette.muted, fontSize: "0.81rem" }}>
        المتبقي: {formatNum(item.remainingQty)} قنطار · نسبة التسليم:{" "}
        {formatNum(fulfillPct)}%
      </div>
      <div style={{ color: palette.muted, fontSize: "0.81rem" }}>
        الحصة: {formatNum(sharePct)}% · الفواتير: {item.invoiceCount} · السحوبات:{" "}
        {item.withdrawalCount ?? 0}
      </div>
      {Number(item.invoicedValueDzd || 0) > 0 && (
        <div style={{ color: palette.text, fontSize: "0.81rem" }}>
          القيمة المفوترة: <strong>{formatNum(Number(item.invoicedValueDzd))} دج</strong>
        </div>
      )}
      {fertilizerBreakdown.length > 0 && (
        <div
          style={{
            marginTop: "6px",
            paddingTop: "6px",
            borderTop: `1px solid ${palette.border}`,
            fontSize: "0.8rem",
            color: palette.muted,
          }}
        >
          <div style={{ fontWeight: 600, color: palette.text, marginBottom: "2px" }}>
            توزيع الأسمدة المستهلكة:
          </div>
          {fertilizerBreakdown.map((f) => (
            <div key={f.key}>
              {f.key}: <strong>{formatNum(f.val)} قنطار</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CropConsumptionChart({
  data,
  fertilizerKeys,
}: {
  data: CropConsumptionItem[];
  fertilizerKeys: string[];
}) {
  const { palette, isPhone } = useThemeAndViewport();
  const [viewMode, setViewMode] = useState<
    "fertilizers" | "compare" | "demand" | "share"
  >(fertilizerKeys.length ? "fertilizers" : "compare");
  const [pieMetric, setPieMetric] = useState<
    "withdrawnQty" | "invoicedQty" | "remainingQty"
  >("withdrawnQty");
  const [selectedCulture, setSelectedCulture] = useState<string | null>(null);

  useEffect(() => {
    if (!fertilizerKeys.length && (viewMode === "fertilizers" || viewMode === "demand")) {
      setViewMode("compare");
    }
  }, [fertilizerKeys.length, viewMode]);

  useEffect(() => {
    if (selectedCulture && !data.some((d) => d.culture === selectedCulture)) {
      setSelectedCulture(null);
    }
  }, [data, selectedCulture]);

  const sorted = useMemo(
    () =>
      [...data].sort(
        (a, b) =>
          b.withdrawnQty - a.withdrawnQty || b.invoicedQty - a.invoicedQty
      ),
    [data]
  );

  const fertilizerDemand = useMemo(() => {
    return fertilizerKeys
      .map((fk) => {
        let total = 0;
        let topCulture = "—";
        let topVal = -1;
        sorted.forEach((row) => {
          const val = Number(row[fk] || 0);
          total += val;
          if (val > topVal) {
            topVal = val;
            topCulture = row.culture;
          }
        });
        return {
          fertilizer: fk,
          qty: Number(total.toFixed(2)),
          topCulture,
        };
      })
      .filter((x) => x.qty > 0)
      .sort((a, b) => b.qty - a.qty);
  }, [sorted, fertilizerKeys]);

  const totalInvoiced = useMemo(
    () => sorted.reduce((s, d) => s + Number(d.invoicedQty || 0), 0),
    [sorted]
  );
  const totalWithdrawn = useMemo(
    () => sorted.reduce((s, d) => s + Number(d.withdrawnQty || 0), 0),
    [sorted]
  );
  const totalRemaining = useMemo(
    () => sorted.reduce((s, d) => s + Number(d.remainingQty || 0), 0),
    [sorted]
  );

  if (!sorted.length) {
    return (
      <p className="empty-state">
        لا توجد بيانات استهلاك أسمدة حسب المحصول في الفلاتر المحددة حالياً.
      </p>
    );
  }

  const hasWithdrawnData = totalWithdrawn > 0;
  const hasRemainingData = totalRemaining > 0;
  const activePieKey: "withdrawnQty" | "invoicedQty" | "remainingQty" =
    pieMetric === "remainingQty" && hasRemainingData
      ? "remainingQty"
      : pieMetric === "withdrawnQty" && hasWithdrawnData
      ? "withdrawnQty"
      : "invoicedQty";
  const pieData = sorted.filter((d) => Number(d[activePieKey]) > 0);
  const tiltLabels = isPhone || sorted.length > 5;
  const selectedRow = selectedCulture
    ? sorted.find((d) => d.culture === selectedCulture) || null
    : null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="f"
            aria-pressed={viewMode === "fertilizers"}
            disabled={!fertilizerKeys.length}
            onClick={() => setViewMode("fertilizers")}
          >
            توزيع الأسمدة حسب المحصول
          </button>
          <button
            type="button"
            className="f"
            aria-pressed={viewMode === "compare"}
            onClick={() => setViewMode("compare")}
          >
            المسحوب والمفوتر والمتبقي
          </button>
          <button
            type="button"
            className="f"
            aria-pressed={viewMode === "share"}
            onClick={() => setViewMode("share")}
          >
            التوزيع الدائري (Pie Chart)
          </button>
          <button
            type="button"
            className="f"
            aria-pressed={viewMode === "demand"}
            disabled={!fertilizerDemand.length}
            onClick={() => setViewMode("demand")}
          >
            الطلب حسب نوع السماد
          </button>
        </div>
        <span style={{ color: palette.muted, fontSize: "0.83rem" }}>
          المحاصيل: {sorted.length} · المفوتر: {formatNum(totalInvoiced)} قنطار ·
          المسحوب: {formatNum(totalWithdrawn)} قنطار · المتبقي: {formatNum(totalRemaining)} قنطار
        </span>
      </div>

      {viewMode === "share" ? (
        <div>
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "0.82rem", color: palette.muted }}>
              مقياس الرسم الدائري:
            </span>
            <button
              type="button"
              className="f"
              aria-pressed={activePieKey === "withdrawnQty"}
              disabled={!hasWithdrawnData}
              onClick={() => setPieMetric("withdrawnQty")}
            >
              الكميات المسحوبة (Withdrawals)
            </button>
            <button
              type="button"
              className="f"
              aria-pressed={activePieKey === "invoicedQty"}
              onClick={() => setPieMetric("invoicedQty")}
            >
              الكميات المفوترة (Invoices)
            </button>
            <button
              type="button"
              className="f"
              aria-pressed={activePieKey === "remainingQty"}
              disabled={!hasRemainingData}
              onClick={() => setPieMetric("remainingQty")}
            >
              الكميات المتبقية (Remaining)
            </button>
          </div>
          {pieData.length ? (
            <div
              dir="ltr"
              style={{
                width: "100%",
                height: isPhone ? 320 : 370,
                fontFamily: '"IBM Plex Sans Arabic", sans-serif',
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey={activePieKey}
                    nameKey="culture"
                    cx="50%"
                    cy="45%"
                    innerRadius={isPhone ? 44 : 62}
                    outerRadius={isPhone ? 84 : 116}
                    paddingAngle={2}
                    style={{ cursor: "pointer" }}
                    onClick={(_data: unknown, index: number) => {
                      const clicked = pieData[index]?.culture;
                      if (clicked) {
                        setSelectedCulture((prev) => (prev === clicked ? null : clicked));
                      }
                    }}
                    label={
                      isPhone
                        ? false
                        : ({ name, percent }) =>
                            `${name ?? ""} (${Math.round((percent ?? 0) * 100)}%)`
                    }
                  >
                    {pieData.map((entry, idx) => (
                      <Cell
                        key={`${entry.culture}-${idx}`}
                        fill={CHART_SERIES_COLORS[idx % CHART_SERIES_COLORS.length]}
                        stroke={
                          selectedCulture === entry.culture
                            ? palette.text
                            : palette.card
                        }
                        strokeWidth={selectedCulture === entry.culture ? 3 : 2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <CropTooltip
                        palette={palette}
                        totalInvoiced={totalInvoiced}
                        totalWithdrawn={totalWithdrawn}
                        fertilizerKeys={fertilizerKeys}
                      />
                    }
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: isPhone ? "12px" : "13px" }}
                    formatter={(value: string) => {
                      const row = pieData.find((d) => d.culture === value);
                      return row
                        ? `${value}: ${formatNum(Number(row[activePieKey]))} قنطار`
                        : value;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="empty-state">لا توجد كميات أكبر من الصفر لعرض التوزيع الدائري.</p>
          )}
        </div>
      ) : viewMode === "demand" ? (
        <div
          dir="ltr"
          style={{
            width: "100%",
            height: isPhone ? 310 : 370,
            fontFamily: '"IBM Plex Sans Arabic", sans-serif',
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={fertilizerDemand}
              margin={{
                top: 22,
                right: isPhone ? 8 : 18,
                left: isPhone ? 4 : 14,
                bottom: isPhone || fertilizerDemand.length > 4 ? 38 : 18,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={palette.border}
                vertical={false}
              />
              <XAxis
                dataKey="fertilizer"
                tick={{ fill: palette.text, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                interval={0}
                angle={isPhone || fertilizerDemand.length > 4 ? -22 : 0}
                textAnchor={isPhone || fertilizerDemand.length > 4 ? "end" : "middle"}
                height={isPhone || fertilizerDemand.length > 4 ? 66 : 42}
              />
              <YAxis
                tick={{ fill: palette.muted, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                tickFormatter={(v) => formatNum(Number(v))}
                width={isPhone ? 52 : 70}
              />
              <Tooltip
                cursor={{ fill: palette.border, opacity: 0.25 }}
                formatter={(value: unknown) => [`${formatNum(Number(value ?? 0))} قنطار`, "الطلب المستهلك"]}
                labelFormatter={(label: unknown) => `السماد: ${String(label ?? "")}`}
                contentStyle={{
                  backgroundColor: palette.card,
                  color: palette.text,
                  border: `1px solid ${palette.border}`,
                  borderRadius: "8px",
                  direction: "rtl",
                }}
              />
              <Bar
                dataKey="qty"
                name="إجمالي الطلب حسب السماد (قنطار)"
                radius={[6, 6, 0, 0]}
                maxBarSize={isPhone ? 42 : 64}
              >
                {fertilizerDemand.map((entry, idx) => (
                  <Cell
                    key={`${entry.fertilizer}-${idx}`}
                    fill={CHART_SERIES_COLORS[idx % CHART_SERIES_COLORS.length]}
                  />
                ))}
                <LabelList
                  dataKey="qty"
                  position="top"
                  fill={palette.text}
                  fontSize={isPhone ? 10 : 11}
                  formatter={(v: unknown) => formatNum(Number(v ?? 0))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          dir="ltr"
          style={{
            width: "100%",
            height: isPhone ? 310 : 370,
            fontFamily: '"IBM Plex Sans Arabic", sans-serif',
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sorted}
              margin={{
                top: 22,
                right: isPhone ? 8 : 18,
                left: isPhone ? 4 : 14,
                bottom: tiltLabels ? 36 : 16,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={palette.border}
                vertical={false}
              />
              <XAxis
                dataKey="culture"
                tick={{ fill: palette.text, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                interval={0}
                angle={tiltLabels ? -22 : 0}
                textAnchor={tiltLabels ? "end" : "middle"}
                height={tiltLabels ? 64 : 42}
              />
              <YAxis
                tick={{ fill: palette.muted, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                tickFormatter={(v) => formatNum(Number(v))}
                width={isPhone ? 52 : 70}
              />
              <Tooltip
                cursor={{ fill: palette.border, opacity: 0.25 }}
                content={
                  <CropTooltip
                    palette={palette}
                    totalInvoiced={totalInvoiced}
                    totalWithdrawn={totalWithdrawn}
                    fertilizerKeys={fertilizerKeys}
                  />
                }
              />
              <Legend
                verticalAlign="top"
                height={34}
                wrapperStyle={{ fontSize: "12px" }}
              />
              {viewMode === "fertilizers" ? (
                fertilizerKeys.map((fk, idx) => (
                  <Bar
                    key={fk}
                    dataKey={fk}
                    name={fk}
                    stackId="cropFertilizer"
                    fill={CHART_SERIES_COLORS[idx % CHART_SERIES_COLORS.length]}
                    maxBarSize={isPhone ? 32 : 52}
                    style={{ cursor: "pointer" }}
                    onClick={(_data: unknown, index: number) => {
                      const clicked = sorted[index]?.culture;
                      if (clicked) {
                        setSelectedCulture((prev) => (prev === clicked ? null : clicked));
                      }
                    }}
                  />
                ))
              ) : (
                <>
                  <Bar
                    dataKey="invoicedQty"
                    name="المفوتر (قنطار)"
                    fill={palette.accent}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={isPhone ? 24 : 38}
                    style={{ cursor: "pointer" }}
                    onClick={(_data: unknown, index: number) => {
                      const clicked = sorted[index]?.culture;
                      if (clicked) {
                        setSelectedCulture((prev) => (prev === clicked ? null : clicked));
                      }
                    }}
                  />
                  <Bar
                    dataKey="withdrawnQty"
                    name="المسحوب فعلياً (قنطار)"
                    fill={palette.primary}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={isPhone ? 18 : 30}
                    style={{ cursor: "pointer" }}
                    onClick={(_data: unknown, index: number) => {
                      const clicked = sorted[index]?.culture;
                      if (clicked) {
                        setSelectedCulture((prev) => (prev === clicked ? null : clicked));
                      }
                    }}
                  />
                  <Bar
                    dataKey="remainingQty"
                    name="الكميات المتبقية (قنطار)"
                    fill="#2f6f8f"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={isPhone ? 18 : 30}
                    style={{ cursor: "pointer" }}
                    onClick={(_data: unknown, index: number) => {
                      const clicked = sorted[index]?.culture;
                      if (clicked) {
                        setSelectedCulture((prev) => (prev === clicked ? null : clicked));
                      }
                    }}
                  />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {selectedRow && (
        <div
          dir="rtl"
          style={{
            marginTop: "12px",
            padding: "10px 14px",
            borderRadius: "8px",
            border: `1px solid ${palette.border}`,
            backgroundColor: palette.surface2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            fontSize: "0.86rem",
          }}
        >
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
            <strong style={{ color: palette.primary }}>
              تفاصيل المحصول: {selectedRow.culture}
            </strong>
            <span>الفواتير: <strong>{selectedRow.invoiceCount}</strong></span>
            <span>السحوبات: <strong>{selectedRow.withdrawalCount ?? 0}</strong></span>
            <span>المفوتر: <strong>{formatNum(selectedRow.invoicedQty)} قنطار</strong></span>
            <span>المسحوب: <strong>{formatNum(selectedRow.withdrawnQty)} قنطار</strong></span>
            <span>المتبقي: <strong>{formatNum(selectedRow.remainingQty)} قنطار</strong></span>
            <span>السماد الأبرز: <strong>{selectedRow.topProduct}</strong></span>
          </div>
          <button
            type="button"
            className="f"
            onClick={() => setSelectedCulture(null)}
          >
            إلغاء التحديد
          </button>
        </div>
      )}
    </div>
  );
}

interface MonthlyTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: MonthlyReceiptItem }>;
  palette: Palette;
  productKeys: string[];
}

function MonthlyTooltip({
  active,
  payload,
  palette,
  productKeys,
}: MonthlyTooltipProps) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  const net = Number(item.receivedQty || 0) - Number(item.withdrawnQty || 0);
  const topBreakdown = productKeys
    .map((k) => ({ key: k, val: Number(item[k] || 0) }))
    .filter((x) => x.val > 0)
    .sort((a, b) => b.val - a.val)
    .slice(0, 4);

  return (
    <div
      dir="rtl"
      style={{
        backgroundColor: palette.card,
        color: palette.text,
        border: `1px solid ${palette.border}`,
        borderRadius: "8px",
        padding: "10px 13px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
        fontSize: "0.86rem",
        lineHeight: 1.65,
        minWidth: "220px",
      }}
    >
      <div style={{ fontWeight: 700, color: palette.primary, marginBottom: "4px" }}>
        {item.label} ({item.month})
      </div>
      <div>
        إجمالي الواردات:{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatNum(item.receivedQty)} قنطار
        </strong>
      </div>
      <div>
        إجمالي التسليمات:{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatNum(item.withdrawnQty)} قنطار
        </strong>
      </div>
      <div style={{ color: net < 0 ? palette.bad : palette.muted, fontSize: "0.81rem" }}>
        صافي الشهر: {net >= 0 ? "+" : ""}
        {formatNum(net)} قنطار · عمليات الوارد: {item.receiptCount}
      </div>
      {topBreakdown.length > 0 && (
        <div
          style={{
            marginTop: "6px",
            paddingTop: "6px",
            borderTop: `1px solid ${palette.border}`,
            fontSize: "0.8rem",
            color: palette.muted,
          }}
        >
          {topBreakdown.map((b) => (
            <div key={b.key}>
              {b.key}: {formatNum(b.val)} قنطار
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MonthlyReceiptsChart({
  data,
}: {
  data: MonthlyReceiptsPayload;
}) {
  const { palette, isPhone } = useThemeAndViewport();
  const [chartType, setChartType] = useState<"flow" | "products" | "trend">(
    "flow"
  );
  const items = data.items || [];
  const productKeys = data.productKeys || [];

  const totalReceived = useMemo(
    () => items.reduce((s, d) => s + Number(d.receivedQty || 0), 0),
    [items]
  );
  const totalWithdrawn = useMemo(
    () => items.reduce((s, d) => s + Number(d.withdrawnQty || 0), 0),
    [items]
  );

  if (!items.length) {
    return (
      <p className="empty-state">
        لا توجد عمليات وارد أو تسليم مسجلة لعرض التوزيع الشهري حالياً.
      </p>
    );
  }

  const tiltLabels = isPhone || items.length > 6;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="f"
            aria-pressed={chartType === "flow"}
            onClick={() => setChartType("flow")}
          >
            الوارد مقابل التسليم
          </button>
          <button
            type="button"
            className="f"
            aria-pressed={chartType === "products"}
            disabled={!productKeys.length}
            onClick={() => setChartType("products")}
          >
            توزيع الأسمدة شهرياً
          </button>
          <button
            type="button"
            className="f"
            aria-pressed={chartType === "trend"}
            onClick={() => setChartType("trend")}
          >
            اتجاه الواردات الشهري
          </button>
        </div>
        <span style={{ color: palette.muted, fontSize: "0.83rem" }}>
          الأشهر: {items.length} · إجمالي الوارد: {formatNum(totalReceived)} قنطار ·
          التسليمات: {formatNum(totalWithdrawn)} قنطار
        </span>
      </div>

      <div
        dir="ltr"
        style={{
          width: "100%",
          height: isPhone ? 310 : 370,
          fontFamily: '"IBM Plex Sans Arabic", sans-serif',
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "products" ? (
            <BarChart
              data={items}
              margin={{
                top: 20,
                right: isPhone ? 8 : 18,
                left: isPhone ? 4 : 14,
                bottom: tiltLabels ? 36 : 16,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={palette.border}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: palette.text, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                interval={0}
                angle={tiltLabels ? -24 : 0}
                textAnchor={tiltLabels ? "end" : "middle"}
                height={tiltLabels ? 64 : 42}
              />
              <YAxis
                tick={{ fill: palette.muted, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                tickFormatter={(v) => formatNum(Number(v))}
                width={isPhone ? 52 : 70}
              />
              <Tooltip
                cursor={{ fill: palette.border, opacity: 0.25 }}
                content={
                  <MonthlyTooltip palette={palette} productKeys={productKeys} />
                }
              />
              <Legend
                verticalAlign="top"
                height={34}
                wrapperStyle={{ fontSize: "12px" }}
              />
              {productKeys.map((pk, idx) => (
                <Bar
                  key={pk}
                  dataKey={pk}
                  name={pk}
                  stackId="stockIn"
                  fill={CHART_SERIES_COLORS[idx % CHART_SERIES_COLORS.length]}
                  maxBarSize={isPhone ? 32 : 52}
                />
              ))}
            </BarChart>
          ) : chartType === "trend" ? (
            <AreaChart
              data={items}
              margin={{
                top: 20,
                right: isPhone ? 8 : 18,
                left: isPhone ? 4 : 14,
                bottom: tiltLabels ? 36 : 16,
              }}
            >
              <defs>
                <linearGradient id="cclsReceiptFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={palette.primary} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={palette.primary} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={palette.border}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: palette.text, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                interval={0}
                angle={tiltLabels ? -24 : 0}
                textAnchor={tiltLabels ? "end" : "middle"}
                height={tiltLabels ? 64 : 42}
              />
              <YAxis
                tick={{ fill: palette.muted, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                tickFormatter={(v) => formatNum(Number(v))}
                width={isPhone ? 52 : 70}
              />
              <Tooltip
                content={
                  <MonthlyTooltip palette={palette} productKeys={productKeys} />
                }
              />
              <Legend
                verticalAlign="top"
                height={34}
                wrapperStyle={{ fontSize: "12px" }}
              />
              <Area
                type="monotone"
                dataKey="receivedQty"
                name="الواردات الشهرية (قنطار)"
                stroke={palette.primary}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#cclsReceiptFill)"
              />
              <Line
                type="monotone"
                dataKey="withdrawnQty"
                name="التسليمات الشهرية (قنطار)"
                stroke={palette.accent}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </AreaChart>
          ) : (
            <ComposedChart
              data={items}
              margin={{
                top: 20,
                right: isPhone ? 8 : 18,
                left: isPhone ? 4 : 14,
                bottom: tiltLabels ? 36 : 16,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={palette.border}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: palette.text, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                interval={0}
                angle={tiltLabels ? -24 : 0}
                textAnchor={tiltLabels ? "end" : "middle"}
                height={tiltLabels ? 64 : 42}
              />
              <YAxis
                tick={{ fill: palette.muted, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                tickFormatter={(v) => formatNum(Number(v))}
                width={isPhone ? 52 : 70}
              />
              <Tooltip
                cursor={{ fill: palette.border, opacity: 0.25 }}
                content={
                  <MonthlyTooltip palette={palette} productKeys={productKeys} />
                }
              />
              <Legend
                verticalAlign="top"
                height={34}
                wrapperStyle={{ fontSize: "12px" }}
              />
              <Bar
                dataKey="receivedQty"
                name="الواردات الشهرية (قنطار)"
                fill={palette.primary}
                radius={[5, 5, 0, 0]}
                maxBarSize={isPhone ? 24 : 38}
              />
              <Bar
                dataKey="withdrawnQty"
                name="التسليمات الشهرية (قنطار)"
                fill={palette.accent}
                radius={[5, 5, 0, 0]}
                maxBarSize={isPhone ? 24 : 38}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface RemainingTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: {
      label: string;
      received: number;
      withdrawn: number;
      balance: number;
      reorderPoint: number;
      warehouseCount?: number;
      productCount?: number;
    };
  }>;
  palette: Palette;
  threshold: number;
}

function RemainingTooltip({
  active,
  payload,
  palette,
  threshold,
}: RemainingTooltipProps) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  const isCritical =
    item.balance <= 0 ||
    item.balance < threshold ||
    (item.reorderPoint > 0 && item.balance <= item.reorderPoint);

  return (
    <div
      dir="rtl"
      style={{
        backgroundColor: palette.card,
        color: palette.text,
        border: `1px solid ${palette.border}`,
        borderRadius: "8px",
        padding: "10px 13px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
        fontSize: "0.86rem",
        lineHeight: 1.65,
        minWidth: "215px",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: isCritical ? palette.bad : palette.primary,
          marginBottom: "4px",
        }}
      >
        {item.label}
      </div>
      <div>
        الكمية المتبقية بالمخزن:{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatNum(item.balance)} قنطار
        </strong>
      </div>
      <div>
        إجمالي الوارد:{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatNum(item.received)} قنطار
        </strong>
      </div>
      <div>
        إجمالي المسحوب:{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatNum(item.withdrawn)} قنطار
        </strong>
      </div>
      {item.reorderPoint > 0 && (
        <div style={{ color: palette.muted, fontSize: "0.8rem" }}>
          نقطة إعادة الطلب: {formatNum(item.reorderPoint)} قنطار
        </div>
      )}
    </div>
  );
}

interface RemainingChartPoint {
  label: string;
  received: number;
  withdrawn: number;
  balance: number;
  reorderPoint: number;
  warehouseCount?: number;
  productCount?: number;
}

function RemainingStockChart({ data }: { data: RemainingStockPayload }) {
  const { palette, isPhone } = useThemeAndViewport();
  const [mode, setMode] = useState<"products" | "warehouses" | "pie">("products");
  const items = data.items || [];
  const threshold = Number(data.threshold ?? 5);

  const byProduct = useMemo<RemainingChartPoint[]>(() => {
    const map = new Map<string, RemainingChartPoint>();
    items.forEach((r) => {
      const key = String(r.name || "غير محدد").trim() || "غير محدد";
      const cur = map.get(key) || {
        label: key,
        received: 0,
        withdrawn: 0,
        balance: 0,
        reorderPoint: 0,
        warehouseCount: 0,
      };
      cur.received += Number(r.received || 0);
      cur.withdrawn += Number(r.withdrawn || 0);
      cur.balance += Number(r.balance || 0);
      cur.reorderPoint += Number(r.reorder_point || 0);
      cur.warehouseCount = (cur.warehouseCount || 0) + 1;
      map.set(key, cur);
    });
    return [...map.values()]
      .map((x) => ({
        ...x,
        received: Number(x.received.toFixed(2)),
        withdrawn: Number(x.withdrawn.toFixed(2)),
        balance: Number(x.balance.toFixed(2)),
        reorderPoint: Number(x.reorderPoint.toFixed(2)),
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [items]);

  const byWarehouse = useMemo<RemainingChartPoint[]>(() => {
    const map = new Map<string, RemainingChartPoint>();
    items.forEach((r) => {
      const key = String(r.warehouse || "غير محدد").trim() || "غير محدد";
      const cur = map.get(key) || {
        label: key,
        received: 0,
        withdrawn: 0,
        balance: 0,
        reorderPoint: 0,
        productCount: 0,
      };
      cur.received += Number(r.received || 0);
      cur.withdrawn += Number(r.withdrawn || 0);
      cur.balance += Number(r.balance || 0);
      cur.reorderPoint += Number(r.reorder_point || 0);
      cur.productCount = (cur.productCount || 0) + 1;
      map.set(key, cur);
    });
    return [...map.values()]
      .map((x) => ({
        ...x,
        received: Number(x.received.toFixed(2)),
        withdrawn: Number(x.withdrawn.toFixed(2)),
        balance: Number(x.balance.toFixed(2)),
        reorderPoint: Number(x.reorderPoint.toFixed(2)),
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [items]);

  const totalBalance = useMemo(
    () => items.reduce((s, r) => s + Number(r.balance || 0), 0),
    [items]
  );

  if (!items.length) {
    return (
      <p className="empty-state">
        لا توجد أرصدة مخزنية مسجلة لعرض الكميات المتبقية حالياً.
      </p>
    );
  }

  const activeSeries: RemainingChartPoint[] =
    mode === "warehouses" ? byWarehouse : byProduct;
  const pieSeries = byProduct.filter((x) => x.balance > 0);
  const tiltLabels = isPhone || activeSeries.length > 5;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="f"
            aria-pressed={mode === "products"}
            onClick={() => setMode("products")}
          >
            المتبقي حسب السماد
          </button>
          <button
            type="button"
            className="f"
            aria-pressed={mode === "warehouses"}
            onClick={() => setMode("warehouses")}
          >
            المتبقي حسب المخزن
          </button>
          <button
            type="button"
            className="f"
            aria-pressed={mode === "pie"}
            disabled={!pieSeries.length}
            onClick={() => setMode("pie")}
          >
            نسبة الرصيد المتبقي (Pie Chart)
          </button>
        </div>
        <span style={{ color: palette.muted, fontSize: "0.83rem" }}>
          إجمالي المتاح بالمخازن: <strong>{formatNum(totalBalance)} قنطار</strong> ·{" "}
          {byProduct.length} صنف
        </span>
      </div>

      {mode === "pie" ? (
        <div
          dir="ltr"
          style={{
            width: "100%",
            height: isPhone ? 310 : 360,
            fontFamily: '"IBM Plex Sans Arabic", sans-serif',
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieSeries}
                dataKey="balance"
                nameKey="label"
                cx="50%"
                cy="45%"
                innerRadius={isPhone ? 44 : 62}
                outerRadius={isPhone ? 84 : 114}
                paddingAngle={2}
                label={
                  isPhone
                    ? false
                    : ({ name, percent }) =>
                        `${name ?? ""} (${Math.round((percent ?? 0) * 100)}%)`
                }
              >
                {pieSeries.map((entry, idx) => (
                  <Cell
                    key={`${entry.label}-${idx}`}
                    fill={CHART_SERIES_COLORS[idx % CHART_SERIES_COLORS.length]}
                    stroke={palette.card}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                content={
                  <RemainingTooltip palette={palette} threshold={threshold} />
                }
              />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: isPhone ? "12px" : "13px" }}
                formatter={(value: string) => {
                  const row = pieSeries.find((x) => x.label === value);
                  return row
                    ? `${value}: ${formatNum(row.balance)} قنطار`
                    : value;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          dir="ltr"
          style={{
            width: "100%",
            height: isPhone ? 310 : 360,
            fontFamily: '"IBM Plex Sans Arabic", sans-serif',
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={activeSeries}
              margin={{
                top: 22,
                right: isPhone ? 8 : 18,
                left: isPhone ? 4 : 14,
                bottom: tiltLabels ? 36 : 16,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={palette.border}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: palette.text, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                interval={0}
                angle={tiltLabels ? -22 : 0}
                textAnchor={tiltLabels ? "end" : "middle"}
                height={tiltLabels ? 64 : 42}
              />
              <YAxis
                tick={{ fill: palette.muted, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                tickFormatter={(v) => formatNum(Number(v))}
                width={isPhone ? 52 : 70}
              />
              <Tooltip
                cursor={{ fill: palette.border, opacity: 0.25 }}
                content={
                  <RemainingTooltip palette={palette} threshold={threshold} />
                }
              />
              <Legend
                verticalAlign="top"
                height={34}
                wrapperStyle={{ fontSize: "12px" }}
              />
              <Bar
                dataKey="received"
                name="الوارد (قنطار)"
                fill={palette.accent}
                radius={[4, 4, 0, 0]}
                maxBarSize={isPhone ? 16 : 26}
              />
              <Bar
                dataKey="withdrawn"
                name="المسحوب (قنطار)"
                fill="#2f6f8f"
                radius={[4, 4, 0, 0]}
                maxBarSize={isPhone ? 16 : 26}
              />
              <Bar
                dataKey="balance"
                name="الرصيد المتبقي (قنطار)"
                fill={palette.primary}
                radius={[4, 4, 0, 0]}
                maxBarSize={isPhone ? 16 : 26}
              >
                {activeSeries.map((entry, idx) => (
                  <Cell
                    key={`${entry.label}-${idx}`}
                    fill={
                      entry.balance <= 0
                        ? palette.bad
                        : entry.balance < threshold
                        ? palette.accent
                        : palette.primary
                    }
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface StockValuationChartPayload {
  monthlySeries: StockValuationPoint[];
  totalStockValueDzd: number;
  totalQtyBalance: number;
}

function StockValuationTooltip({
  active,
  payload,
  palette,
}: {
  active?: boolean;
  payload?: Array<{ payload?: StockValuationPoint }>;
  palette: Palette;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const pt = payload[0].payload;
  return (
    <div
      dir="rtl"
      style={{
        backgroundColor: palette.card,
        color: palette.text,
        border: `1px solid ${palette.border}`,
        borderRadius: "8px",
        padding: "10px 13px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
        fontSize: "0.85rem",
        lineHeight: 1.65,
        minWidth: "225px",
      }}
    >
      <div style={{ fontWeight: 700, color: palette.primary, marginBottom: "4px" }}>
        {pt.label} ({pt.month})
      </div>
      <div>
        قيمة المخزون التراكمية:{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatNum(pt.valueDzd)} دج
        </strong>
      </div>
      <div style={{ color: palette.muted, fontSize: "0.81rem" }}>
        الكمية التراكمية: {formatNum(pt.qtyBalance)} قنطار
      </div>
      <div style={{ color: palette.primary, fontSize: "0.81rem" }}>
        قيمة الوارد بالشهر: +{formatNum(pt.receivedValueDzd)} دج
      </div>
      <div style={{ color: palette.accent, fontSize: "0.81rem" }}>
        قيمة المسحوب بالشهر: -{formatNum(pt.withdrawnValueDzd)} دج
      </div>
    </div>
  );
}

function StockValuationChart({ data }: { data: StockValuationChartPayload }) {
  const { palette, isPhone } = useThemeAndViewport();
  const [metric, setMetric] = useState<"value" | "flows">("value");
  const series = data.monthlySeries || [];

  if (!series.length) {
    return (
      <div style={{ padding: "28px 16px", textAlign: "center", color: palette.muted }}>
        لا توجد بيانات شهرية مسعّرة لعرض تطور قيمة المخزون (أضف سعر الوحدة في الفواتير أو الوارد).
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="f"
            aria-pressed={metric === "value"}
            onClick={() => setMetric("value")}
          >
            القيمة التراكمية عبر الأشهر (دج)
          </button>
          <button
            type="button"
            className="f"
            aria-pressed={metric === "flows"}
            onClick={() => setMetric("flows")}
          >
            قيمة الوارد مقابل المسحوب شهرياً
          </button>
        </div>
        <span style={{ color: palette.muted, fontSize: "0.84rem" }}>
          القيمة الحالية بالمخازن:{" "}
          <strong style={{ color: palette.primary, fontVariantNumeric: "tabular-nums" }}>
            {formatNum(data.totalStockValueDzd)} دج
          </strong>
        </span>
      </div>

      <div
        dir="ltr"
        style={{
          width: "100%",
          height: isPhone ? 290 : 340,
          fontFamily: '"IBM Plex Sans Arabic", sans-serif',
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {metric === "value" ? (
            <AreaChart
              data={series}
              margin={{ top: 18, right: isPhone ? 8 : 20, left: isPhone ? 6 : 16, bottom: 18 }}
            >
              <defs>
                <linearGradient id="valAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={palette.primary} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={palette.primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: palette.text, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
              />
              <YAxis
                tick={{ fill: palette.muted, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                tickFormatter={(v) => formatNum(Number(v))}
                width={isPhone ? 58 : 78}
              />
              <Tooltip content={<StockValuationTooltip palette={palette} />} />
              <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: "12px" }} />
              <Area
                type="monotone"
                dataKey="valueDzd"
                name="قيمة المخزون التراكمية (دج)"
                stroke={palette.primary}
                strokeWidth={2.4}
                fillOpacity={1}
                fill="url(#valAreaGrad)"
              />
            </AreaChart>
          ) : (
            <BarChart
              data={series}
              margin={{ top: 18, right: isPhone ? 8 : 20, left: isPhone ? 6 : 16, bottom: 18 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: palette.text, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
              />
              <YAxis
                tick={{ fill: palette.muted, fontSize: isPhone ? 10 : 12 }}
                tickLine={false}
                axisLine={{ stroke: palette.border }}
                tickFormatter={(v) => formatNum(Number(v))}
                width={isPhone ? 58 : 78}
              />
              <Tooltip content={<StockValuationTooltip palette={palette} />} />
              <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: "12px" }} />
              <Bar
                dataKey="receivedValueDzd"
                name="قيمة الوارد (دج)"
                fill={palette.primary}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="withdrawnValueDzd"
                name="قيمة المسحوب (دج)"
                fill={palette.accent}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface YoYChartPayload {
  rows: YoYProductRow[];
  yearA: string;
  yearB: string;
}

function YoYTooltip({
  active,
  payload,
  palette,
  yearA,
  yearB,
  flow,
}: {
  active?: boolean;
  payload?: Array<{ payload?: YoYProductRow }>;
  palette: Palette;
  yearA: string;
  yearB: string;
  flow: "received" | "withdrawn";
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const r = payload[0].payload;
  const valA = flow === "received" ? r.receivedA : r.withdrawnA;
  const valB = flow === "received" ? r.receivedB : r.withdrawnB;
  const diff = flow === "received" ? r.receivedDiff : r.withdrawnDiff;
  const pct = flow === "received" ? r.receivedPct : r.withdrawnPct;
  const flowLabel = flow === "received" ? "الوارد" : "المسحوب";
  return (
    <div
      dir="rtl"
      style={{
        backgroundColor: palette.card,
        color: palette.text,
        border: `1px solid ${palette.border}`,
        borderRadius: "8px",
        padding: "10px 13px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
        fontSize: "0.85rem",
        lineHeight: 1.65,
        minWidth: "220px",
      }}
    >
      <div style={{ fontWeight: 700, color: palette.primary, marginBottom: "4px" }}>
        {r.product} ({flowLabel})
      </div>
      <div>
        سنة {yearA}: <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatNum(valA)} قنطار</strong>
      </div>
      <div>
        سنة {yearB}: <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatNum(valB)} قنطار</strong>
      </div>
      <div style={{ color: diff >= 0 ? palette.primary : palette.bad, fontWeight: 700 }}>
        الفارق: {diff >= 0 ? "+" : ""}
        {formatNum(diff)} قنطار ({pct !== null ? `${pct >= 0 ? "+" : ""}${pct}%` : "—"})
      </div>
    </div>
  );
}

function YoYComparisonChart({ data }: { data: YoYChartPayload }) {
  const { palette, isPhone } = useThemeAndViewport();
  const [flow, setFlow] = useState<"received" | "withdrawn">("withdrawn");
  const rows = data.rows || [];
  const yA = data.yearA || "—";
  const yB = data.yearB || "—";

  if (!rows.length) {
    return (
      <div style={{ padding: "28px 16px", textAlign: "center", color: palette.muted }}>
        لا توجد حركات كافية للمقارنة بين سنتي {yA} و {yB}.
      </div>
    );
  }

  const keyA = flow === "received" ? "receivedA" : "withdrawnA";
  const keyB = flow === "received" ? "receivedB" : "withdrawnB";
  const tilt = isPhone || rows.length > 5;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="f"
            aria-pressed={flow === "withdrawn"}
            onClick={() => setFlow("withdrawn")}
          >
            مقارنة المسحوب (التسليمات)
          </button>
          <button
            type="button"
            className="f"
            aria-pressed={flow === "received"}
            onClick={() => setFlow("received")}
          >
            مقارنة الوارد للمخزن
          </button>
        </div>
        <span style={{ color: palette.muted, fontSize: "0.84rem" }}>
          مقارنة {rows.length} صنف بين <strong>{yA}</strong> و <strong>{yB}</strong>
        </span>
      </div>

      <div
        dir="ltr"
        style={{
          width: "100%",
          height: isPhone ? 310 : 350,
          fontFamily: '"IBM Plex Sans Arabic", sans-serif',
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows.slice(0, 12)}
            margin={{
              top: 18,
              right: isPhone ? 8 : 20,
              left: isPhone ? 4 : 14,
              bottom: tilt ? 38 : 18,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
            <XAxis
              dataKey="product"
              tick={{ fill: palette.text, fontSize: isPhone ? 10 : 12 }}
              tickLine={false}
              axisLine={{ stroke: palette.border }}
              interval={0}
              angle={tilt ? -22 : 0}
              textAnchor={tilt ? "end" : "middle"}
              height={tilt ? 64 : 40}
            />
            <YAxis
              tick={{ fill: palette.muted, fontSize: isPhone ? 10 : 12 }}
              tickLine={false}
              axisLine={{ stroke: palette.border }}
              tickFormatter={(v) => formatNum(Number(v))}
              width={isPhone ? 52 : 70}
            />
            <Tooltip
              cursor={{ fill: palette.border, opacity: 0.25 }}
              content={<YoYTooltip palette={palette} yearA={yA} yearB={yB} flow={flow} />}
            />
            <Legend verticalAlign="top" height={34} wrapperStyle={{ fontSize: "12px" }} />
            <Bar
              dataKey={keyA}
              name={`${flow === "received" ? "وارد" : "مسحوب"} ${yA}`}
              fill="#64748b"
              radius={[4, 4, 0, 0]}
              maxBarSize={isPhone ? 18 : 28}
            />
            <Bar
              dataKey={keyB}
              name={`${flow === "received" ? "وارد" : "مسحوب"} ${yB}`}
              fill={palette.primary}
              radius={[4, 4, 0, 0]}
              maxBarSize={isPhone ? 18 : 28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    buildCropAnalytics?: typeof aggregateCropInvoicesAndWithdrawals;
    computeStockValuationAndMonthly?: typeof computeStockValuationAndMonthly;
    computePerformanceKpis?: typeof computePerformanceKpis;
    computeYoYProductComparison?: typeof computeYoYProductComparison;
    renderCropConsumptionChart?: (
      payload: CropConsumptionPayload | CropConsumptionItem[]
    ) => void;
    renderMonthlyReceiptsChart?: (payload: MonthlyReceiptsPayload) => void;
    renderRemainingStockChart?: (payload: RemainingStockPayload) => void;
    renderStockValuationChart?: (payload: StockValuationChartPayload) => void;
    renderYoYComparisonChart?: (payload: YoYChartPayload) => void;
  }
}

window.buildCropAnalytics = aggregateCropInvoicesAndWithdrawals;
window.computeStockValuationAndMonthly = computeStockValuationAndMonthly;
window.computePerformanceKpis = computePerformanceKpis;
window.computeYoYProductComparison = computeYoYProductComparison;

let cropRoot: Root | null = null;
let monthlyRoot: Root | null = null;
let remainingRoot: Root | null = null;
let valuationRoot: Root | null = null;
let yoyRoot: Root | null = null;

window.renderCropConsumptionChart = (
  payload: CropConsumptionPayload | CropConsumptionItem[]
) => {
  const container = document.getElementById("crop-consumption-chart-root");
  if (!container) return;
  if (!cropRoot) {
    cropRoot = createRoot(container);
  }
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
    ? payload.items
    : [];
  const fertilizerKeys = Array.isArray(payload)
    ? []
    : Array.isArray(payload?.fertilizerKeys)
    ? payload.fertilizerKeys
    : [];
  cropRoot.render(
    <CropConsumptionChart data={items} fertilizerKeys={fertilizerKeys} />
  );
};

window.renderMonthlyReceiptsChart = (payload: MonthlyReceiptsPayload) => {
  const container = document.getElementById("monthly-receipts-chart-root");
  if (!container) return;
  if (!monthlyRoot) {
    monthlyRoot = createRoot(container);
  }
  monthlyRoot.render(
    <MonthlyReceiptsChart
      data={payload && Array.isArray(payload.items) ? payload : { items: [], productKeys: [] }}
    />
  );
};

window.renderRemainingStockChart = (payload: RemainingStockPayload) => {
  const container = document.getElementById("remaining-stock-chart-root");
  if (!container) return;
  if (!remainingRoot) {
    remainingRoot = createRoot(container);
  }
  remainingRoot.render(
    <RemainingStockChart
      data={payload && Array.isArray(payload.items) ? payload : { items: [], threshold: 5 }}
    />
  );
};

window.renderStockValuationChart = (payload: StockValuationChartPayload) => {
  const container = document.getElementById("stock-valuation-chart-root");
  if (!container) return;
  if (!valuationRoot) {
    valuationRoot = createRoot(container);
  }
  valuationRoot.render(
    <StockValuationChart
      data={
        payload && Array.isArray(payload.monthlySeries)
          ? payload
          : { monthlySeries: [], totalStockValueDzd: 0, totalQtyBalance: 0 }
      }
    />
  );
};

window.renderYoYComparisonChart = (payload: YoYChartPayload) => {
  const container = document.getElementById("yoy-comparison-chart-root");
  if (!container) return;
  if (!yoyRoot) {
    yoyRoot = createRoot(container);
  }
  yoyRoot.render(
    <YoYComparisonChart
      data={
        payload && Array.isArray(payload.rows)
          ? payload
          : { rows: [], yearA: "", yearB: "" }
      }
    />
  );
};
