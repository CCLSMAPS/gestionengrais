import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const BLOCKED_FILES = new Set([
  "/server.js",
  "/package.json",
  "/package-lock.json",
  "/metadata.json",
  "/supabase-setup.sql",
  "/supabase-dossiers.sql",
  "/supabase-bons.sql",
  "/README.md",
  "/build.mjs",
  "/tsconfig.json",
]);

app.use((req, res, next) => {
  if (
    BLOCKED_FILES.has(req.path) ||
    req.path.startsWith("/.") ||
    req.path.startsWith("/src/")
  ) {
    return res.status(404).send("Not found");
  }
  next();
});

app.use(express.static(__dirname, { dotfiles: "ignore" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
