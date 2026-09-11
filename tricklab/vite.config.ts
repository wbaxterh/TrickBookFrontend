import { defineConfig } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// The lab imports the pose engine straight from the app source
// (../src/components/companion/*), so allow Vite to read the parent repo.
export default defineConfig({
  esbuild: { tsconfigRaw: '{"compilerOptions":{"target":"ES2022","useDefineForClassFields":true}}' },
  plugins: [{
    name: 'local-motion-export',
    configureServer(server) {
      server.middlewares.use('/__lab/motion', (req, res) => {
        if (req.method !== 'POST' || req.headers['x-tricklab'] !== 'motion-v1' || req.headers.origin !== `http://${req.headers.host}`) {
          res.statusCode = 403; res.end('Local Trick Lab export only'); return;
        }
        let body = ''; let tooLarge = false;
        req.on('data', chunk => { body += chunk; if (body.length > 15_000_000) { tooLarge = true; req.destroy(); } });
        req.on('end', async () => {
          try {
            if (tooLarge) throw new Error('Export too large');
            const data = JSON.parse(body);
            if (data.version !== 1 || !/^[a-z0-9-]{1,80}$/.test(data.trick) || !Array.isArray(data.samples) || !data.samples.length || data.samples.length > 2000) throw new Error('Invalid motion export');
            const folder = resolve(__dirname, 'exports');
            await mkdir(folder, { recursive: true });
            const file = `${data.trick}.motion.json`;
            await writeFile(resolve(folder, file), JSON.stringify(data));
            res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ file: `exports/${file}` }));
          } catch (e) { res.statusCode = 400; res.end(String(e)); }
        });
      });
    },
  }],
  server: {
    fs: { allow: ['..'] },
    host: '127.0.0.1',
  },
});
