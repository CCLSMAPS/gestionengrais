import { build } from "esbuild";
import fs from "fs";

fs.mkdirSync("dist", { recursive: true });

await build({
  entryPoints: [
    "src/warehouse-chart.tsx",
    "src/culture-chart.tsx",
    "src/analytics-dashboard.tsx",
    "src/dossiers-pdf.ts",
  ],
  bundle: true,
  minify: true,
  format: "iife",
  outdir: "dist",
  target: ["es2020"],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

console.log("Built dist bundles");
