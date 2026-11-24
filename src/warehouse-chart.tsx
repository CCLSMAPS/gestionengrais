import React, { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

export interface WarehouseStockItem {
  warehouse: string;
  balance: number;
  received: number;
  withdrawn: number;
  products: number;
}

interface Palette {
  primary: string;
  accent: string;
  bad: string;
  border: string;
  text: string;
  muted: string;
  card: string;
}

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    primary: get("--pr", "#1f5a3d"),
    accent: get("--ac", "#c28a2b"),
    bad: get("--bad", "#b3261e"),
    border: get("--bd", "#d9dfd4"),
    text: get("--tx", "#1d2b22"),
    muted: get("--mu", "#66736a"),
    card: get("--card", "#ffffff"),
  };
}

function formatQty(v: number): string {
  return Number(v || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

interface TooltipPayloadItem {
  payload?: WarehouseStockItem;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  palette: Palette;
}

function WarehouseTooltip({ active, payload, palette }: CustomTooltipProps) {
  if (!active || !payload || !payload.length || !payload[0].payload) {
    return null;
  }
  const item = payload[0].payload;
  const isNegative = item.balance < 0;

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
        minWidth: "190px",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "4px", color: palette.primary }}>
        {item.warehouse}
      </div>
      <div>
        المتوفر:{" "}
        <strong style={{ color: isNegative ? palette.bad : palette.text }}>
          {formatQty(item.balance)} قنطار
        </strong>
      </div>
      <div style={{ color: palette.muted, fontSize: "0.82rem" }}>
        الوارد: {formatQty(item.received)} | المستلم: {formatQty(item.withdrawn)}
      </div>
      <div style={{ color: palette.muted, fontSize: "0.82rem" }}>
        عدد المواد: {item.products}
      </div>
    </div>
  );
}

function WarehouseStockChart({ data }: { data: WarehouseStockItem[] }) {
  const [palette, setPalette] = useState<Palette>(() => readPalette());
  const [vw, setVw] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setPalette(readPalette());
    const onResize = () => setVw(window.innerWidth);
    mq.addEventListener("change", onChange);
    window.addEventListener("resize", onResize);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  if (!data.length) {
    return (
      <p style={{ color: palette.muted, margin: 0 }}>
        لا توجد بيانات مخزون متاحة للعرض حالياً.
      </p>
    );
  }

  const isPhone = vw < 640;
  const chartHeight = isPhone ? 290 : 350;
  const tiltLabels = isPhone && data.length > 2;

  return (
    <div dir="ltr" style={{ width: "100%", height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 22,
            right: isPhone ? 8 : 18,
            left: isPhone ? 2 : 12,
            bottom: tiltLabels ? 28 : 18,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
          <XAxis
            dataKey="warehouse"
            tick={{ fill: palette.text, fontSize: isPhone ? 10 : 12 }}
            tickLine={false}
            axisLine={{ stroke: palette.border }}
            interval={0}
            angle={tiltLabels ? -22 : 0}
            textAnchor={tiltLabels ? "end" : "middle"}
            height={tiltLabels ? 60 : 44}
          />
          <YAxis
            tick={{ fill: palette.muted, fontSize: isPhone ? 10 : 12 }}
            tickLine={false}
            axisLine={{ stroke: palette.border }}
            tickFormatter={(v) => formatQty(Number(v))}
            width={isPhone ? 50 : 72}
          />
          <Tooltip
            cursor={{ fill: palette.border, opacity: 0.25 }}
            content={<WarehouseTooltip palette={palette} />}
          />
          <Bar
            dataKey="balance"
            name="الكمية المتوفرة (قنطار)"
            radius={[6, 6, 0, 0]}
            maxBarSize={isPhone ? 44 : 68}
          >
            {data.map((entry, idx) => (
              <Cell
                key={`${entry.warehouse}-${idx}`}
                fill={entry.balance < 0 ? palette.bad : palette.primary}
              />
            ))}
            <LabelList
              dataKey="balance"
              position="top"
              fill={palette.text}
              fontSize={isPhone ? 10 : 12}
              formatter={(v: unknown) => formatQty(Number(v ?? 0))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

declare global {
  interface Window {
    renderWarehouseChart?: (items: WarehouseStockItem[]) => void;
  }
}

let root: Root | null = null;

window.renderWarehouseChart = (items: WarehouseStockItem[]) => {
  const container = document.getElementById("warehouse-chart-root");
  if (!container) return;
  if (!root) {
    root = createRoot(container);
  }
  root.render(<WarehouseStockChart data={Array.isArray(items) ? items : []} />);
};
