import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'save-report-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/api/save-feasibility' && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', () => {
                try {
                  const data = JSON.parse(body);
                  // 1. Write the new inputs to financial_inputs.json
                  const inputsPath = path.resolve(__dirname, './Docs/nghien-cuu-kha-thi/financial_inputs.json');
                  fs.writeFileSync(inputsPath, JSON.stringify(data.inputs, null, 2), 'utf8');
                  
                  // 2. Run the recalculation script in node
                  exec('node scripts/recalculate_financials.mjs', (error, stdout, stderr) => {
                    if (error) {
                      console.error('Error in recalculate_financials:', error);
                      res.statusCode = 500;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ success: false, error: error.message }));
                    } else {
                      console.log('Recalculated financials:\n', stdout);
                      res.statusCode = 200;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ success: true, message: 'Recalculated and saved successfully.' }));
                    }
                  });
                } catch (err) {
                  console.error('Error parsing save request:', err);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: err.message }));
                }
              });
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
