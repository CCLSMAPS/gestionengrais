import React, { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface CultureAreaItem {
  culture: string;
  area: number;
  count: number;
}

interface Palette {
  primary: string;
  accent: string;
  border: string;
  text: string;
  muted: string;
  card: string;
}

const SLICE_COLORS = [
  "#175236",
  "#b97d19",
  "#2a7b54",
  "#d97706",
  "#2f6f8f",
  "#6d4c3d",
  "#4f772d",
  "#8f3d56",
];

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    primary: get("--pr", "#175236"),
    accent: get("--ac", "#b97d19"),
    border: get("--bd", "#dfe4dd"),
    text: get("--tx", "#14221a"),
    muted: get("--mu", "#57675d"),
    card: get("--card", "#ffffff"),
  };
}

function formatNum(v: number): string {
  return Number(v || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

interface TooltipPayloadEntry {
  payload?: CultureAreaItem & { percent?: number };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  palette: Palette;
  totalValue: number;
  mode: "area" | "count";
}

function CultureTooltip({
  active,
  payload,
  palette,
  totalValue,
  mode,
}: CustomTooltipProps) {
  if (!active || !payload || !payload.length || !payload[0].payload) {
    return null;
  }
  const item = payload[0].payload;
  const val = mode === "area" ? item.area : item.count;
  const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;

  return (
    <div
      dir="rtl"
      style={{
        backgroundColor: palette.card,
        color: palette.text,
        border: `1px solid ${palette.border}`,
        borderRadius: "8px",
        padding: "10px 12px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
        fontSize: "0.88rem",
        lineHeight: 1.6,
        minWidth: "185px",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "4px", color: palette.primary }}>
        {item.culture}
      </div>
      <div>
        المساحة الإجمالية:{" "}
        <strong>{formatNum(item.area)} هكتار</strong>
      </div>
      <div style={{ color: palette.muted, fontSize: "0.82rem" }}>
        النسبة: {formatNum(pct)}% | عدد الملفات: {item.count}
      </div>
    </div>
  );
}

function CulturePieChart({ data }: { data: CultureAreaItem[] }) {
  const [palette, setPalette] = useState<Palette>(() => readPalette());
  const [vw, setVw] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  const totalArea = data.reduce((sum, d) => sum + Number(d.area || 0), 0);
  const [mode, setMode] = useState<"area" | "count">(
    totalArea > 0 ? "area" : "count"
  );

  useEffect(() => {
    setMode(totalArea > 0 ? "area" : "count");
  }, [totalArea]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => requestAnimationFrame(() => setPalette(readPalette()));
    const onResize = () => setVw(window.innerWidth);
    mq.addEventListener("change", onChange);
    window.addEventListener("ccls:theme-change", onChange);
    window.addEventListener("resize", onResize);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("ccls:theme-change", onChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  if (!data.length) {
    return (
      <p style={{ color: palette.muted, margin: 0 }}>
        لا توجد بيانات زراعات متاحة للعرض حالياً.
      </p>
    );
  }

  const activeData =
    mode === "area"
      ? data.filter((d) => d.area > 0)
      : data.filter((d) => d.count > 0);
  const totalValue = activeData.reduce(
    (sum, d) => sum + (mode === "area" ? d.area : d.count),
    0
  );
  const isPhone = vw < 640;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="f"
            aria-pressed={mode === "area"}
            disabled={totalArea <= 0}
            onClick={() => setMode("area")}
          >
            حسب المساحة (هكتار)
          </button>
          <button
            type="button"
            className="f"
            aria-pressed={mode === "count"}
            onClick={() => setMode("count")}
          >
            حسب عدد الملفات
          </button>
        </div>
        {totalArea <= 0 && (
          <span style={{ color: palette.muted, fontSize: "0.84rem" }}>
            لم تُسجَّل مساحات بعد؛ أدخل المساحة في الجدول أو النموذج لعرض توزيع الهكتارات.
          </span>
        )}
      </div>

      {activeData.length ? (
        <div dir="ltr" style={{ width: "100%", height: isPhone ? 310 : 360, fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={activeData}
                dataKey={mode === "area" ? "area" : "count"}
                nameKey="culture"
                cx="50%"
                cy="46%"
                innerRadius={isPhone ? 40 : 56}
                outerRadius={isPhone ? 82 : 112}
                paddingAngle={2}
                label={
                  isPhone
                    ? false
                    : ({ name, percent }) =>
                        `${name ?? ""} (${Math.round((percent ?? 0) * 100)}%)`
                }
              >
                {activeData.map((entry, idx) => (
                  <Cell
                    key={`${entry.culture}-${idx}`}
                    fill={SLICE_COLORS[idx % SLICE_COLORS.length]}
                    stroke={palette.card}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                content={
                  <CultureTooltip
                    palette={palette}
                    totalValue={totalValue}
                    mode={mode}
                  />
                }
              />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: isPhone ? "12px" : "13px" }}
                formatter={(value: string) => {
                  const item = activeData.find((d) => d.culture === value);
                  if (!item) return value;
                  return mode === "area"
                    ? `${value}: ${formatNum(item.area)} هكتار`
                    : `${value}: ${item.count} ملف`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p style={{ color: palette.muted, margin: 0 }}>
          لا توجد مساحات أكبر من الصفر لعرضها.
        </p>
      )}
    </div>
  );
}

declare global {
  interface Window {
    renderCulturePieChart?: (items: CultureAreaItem[]) => void;
  }
}

let root: Root | null = null;

window.renderCulturePieChart = (items: CultureAreaItem[]) => {
  const container = document.getElementById("culture-chart-root");
  if (!container) return;
  if (!root) {
    root = createRoot(container);
  }
  root.render(<CulturePieChart data={Array.isArray(items) ? items : []} />);
};
