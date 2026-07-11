import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DATA_PATH = fileURLToPath(new URL('./public/family-data.json', import.meta.url));

/**
 * Dev-only endpoint that lets the running app write edits straight back to
 * public/family-data.json — so editing locally needs no export/download step.
 * `apply: 'serve'` keeps it out of production builds; the deployed static site
 * has no such route and the app falls back to Export there.
 */
function writeDataPlugin(): Plugin {
  return {
    name: 'rv-write-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-data', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', async () => {
          try {
            JSON.parse(body); // never write anything but valid JSON to the data file
            await writeFile(DATA_PATH, body);
            res.statusCode = 200;
            res.end('ok');
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
  base: './',
  plugins: [react(), writeDataPlugin()],
  server: {
    // Don't reload the page when the app writes the data file back to disk.
    watch: { ignored: ['**/node_modules/**', '**/.git/**', '**/family-data.json'] },
  },
});
