import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";

// The site must open by double-click (file://) as well as on GitHub Pages.
// Browsers refuse <script type="module"> from file://, so we build one classic IIFE script
// (app.js) and load it with a plain <script defer>. Fonts are embedded in style.css.
const offlineHtml = (): Plugin => ({
  name: "offline-html",
  apply: "build",
  closeBundle() {
    const f = path.resolve("docs/index.html");
    let html = fs.readFileSync(f, "utf8");
    html = html.replace(/<script type="module" crossorigin src="\.\/app\.js"><\/script>/, '<script defer src="./app.js"></script>');
    html = html.replace(/ crossorigin/g, "");
    fs.writeFileSync(f, html);
  },
});

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), offlineHtml()],
  build: {
    outDir: "docs", // GitHub Pages can serve this folder directly
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: { format: "iife", inlineDynamicImports: true, entryFileNames: "app.js", assetFileNames: "style[extname]" },
    },
  },
});
