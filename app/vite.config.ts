import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PUBLIC_DIR = fileURLToPath(new URL("./public/", import.meta.url));
// Only these files may be written back, so a stray request can never touch
// anything else on disk. Editing works on every dataset, each to its own file.
const WRITABLE = new Set([
  "family-data.json",
  "family-data.mahabharat.json",
  "family-data.ramayan.json",
  "family-data.hiranyagarbha.json",
]);

/**
 * Dev-only endpoint that lets the running app write edits straight back to the
 * dataset file it's viewing (?file=<name>), so editing locally needs no
 * export/download step. `apply: 'serve'` keeps it out of production builds; the
 * deployed static site has no such route and the app falls back to Export there.
 */
function writeDataPlugin(): Plugin {
  return {
    name: "rv-write-data",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__save-data", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const file =
          new URL(req.url ?? "", "http://localhost").searchParams.get("file") ??
          "family-data.json";
        if (!WRITABLE.has(file)) {
          res.statusCode = 403;
          res.end("file not allowed");
          return;
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            JSON.parse(body); // never write anything but valid JSON to the data file
            await writeFile(PUBLIC_DIR + file, body);
            res.statusCode = 200;
            res.end("ok");
          } catch (e) {
            res.statusCode = 400;
            res.end(String(e));
          }
        });
      });
    },
  };
}

// Relative base so the build works when served from a GitHub Pages project
// subpath (https://user.github.io/RaktaVruksha/) as well as from the root.
export default defineConfig({
  base: "./",
  plugins: [react(), writeDataPlugin()],
  server: {
    // Don't reload the page when the app writes the data file back to disk.
    watch: {
      ignored: ["**/node_modules/**", "**/.git/**", "**/public/family-data*.json"],
    },
  },
});
