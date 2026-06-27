import express from 'express';
import { geminiProxyHandler } from './routes/gemini-proxy.js';
import { scanVirusHandler } from './routes/scan-virus.js';

const app = express();
const PORT = process.env.PORT || 3001;

const EXTRA_ORIGINS = (process.env.CORS_ORIGINS || 'https://cde.cic.com.vn').split(',').map((s) => s.trim());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (/^http:\/\/localhost:\d+$/.test(origin) || EXTRA_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'cde-api' }));

app.post('/gemini-proxy', geminiProxyHandler);
app.post('/scan-virus', scanVirusHandler);

app.listen(PORT, () => {
  console.log(`[api] CDE CIC Self-Host API running on port ${PORT}`);
});
