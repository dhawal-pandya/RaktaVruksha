import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PUBLIC_DIR = fileURLToPath(new URL("./public/", import.meta.url));
// The 3D layout dials, driven from the Layout Lab.
const WRITABLE_FILES = new Set(["layout.json"]);
// Datasets are directories of per-family shards (see src/core/shards.ts), so the
// writable set is a shape rather than a list: exactly one directory level under
// data/, and a plain .json leaf. Still a whitelist — a name with a path
// separator, a dot segment, or an unknown directory is refused, so a stray
// request can never touch anything else on disk.
const DATA_DIRS = new Set(["family", "ramayan", "mahabharat", "hiranyagarbha"]);
const isWritable = (file: string): boolean => {
  if (WRITABLE_FILES.has(file)) return true;
  const parts = file.split("/");
  if (parts.length !== 3 || parts[0] !== "data") return false;
  const [, dir, leaf] = parts;
  if (!DATA_DIRS.has(dir)) return false;
  return /^[A-Za-z0-9_-]+\.json$/.test(leaf);
};

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
        if (!isWritable(file)) {
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
    // Don't reload the page when the app writes a file back to disk. Without
    // this, every debounced write from a slider drag would bounce the page
    // mid-drag. Hand-editing either file still needs a manual refresh.
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/public/data/**",
        "**/public/layout.json",
      ],
    },
  },
});
