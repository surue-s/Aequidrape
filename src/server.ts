import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { runClothesVTO, modifyGarmentImage } from './youcam';

// 1. ENV & DATA LOADING
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) process.env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
}

const garmentsPath = path.join(process.cwd(), 'data', 'garments.json');
let garments: any[] = [];
try { garments = JSON.parse(fs.readFileSync(garmentsPath, 'utf8')); }
catch (e) { console.warn('[server] Could not load garments.json'); }

// 2. EXPRESS SETUP
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

// 3. ROUTES
app.get('/api/health', (_req, res) => res.json({ status: 'ok', garments: garments.length }));
app.get('/api/products', (_req, res) => res.json(garments));
app.get('/api/garments', (_req, res) => res.json({ garments }));

app.post('/api/evaluate', (req, res) => {
  const profile = req.body.user_profile || req.body.profile;
  const garmentId = req.body.garment_id || req.body.garmentId;
  const garment = garments.find((g) => g.id === garmentId);
  if (!profile || !garment) return res.status(400).json({ error: 'Missing profile or garment' });

  const ok: string[] = [], warn: string[] = [], ask: string[] = [];
  if ((profile.dexterity === 'limited' || profile.dexterity === 'one_handed') && /magnetic|hook|zipper/.test(garment.closure_type || '')) ok.push(`${garment.closure_type} closure supports easier dressing.`);
  if (profile.posture === 'seated' && garment.back_rise === 'high') ok.push('High back rise supports seated coverage.');
  if (profile.posture === 'seated' && garment.back_rise !== 'high') warn.push('Back rise may sit low while seated.');
  ask.push('What is the seated back length in centimetres?');
  res.json({ garment, insight: { compatibility: ok, risks: warn, questions_for_seller: ask, summary: `${garment.name}: ${ok.join(' ')} ${warn.join(' ')}` } });
});

app.post('/api/modify-image', async (req, res) => {
  try {
    const { image_base64, prompt } = req.body;
    if (!image_base64 || !prompt) return res.status(400).json({ error: 'Missing image or prompt' });
    const buffer = Buffer.from(image_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const resultUrl = await modifyGarmentImage(buffer, prompt);
    res.json({ status: 'success', url: resultUrl });
  } catch (e: any) {
    console.error('[modify-image] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/try-on', async (req, res) => {
  try {
    const { person_base64, garment_base64, garment_url } = req.body;
    if (!person_base64) return res.status(400).json({ error: 'Missing person image' });
    const personBuffer = Buffer.from(person_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    let garmentBuffer: Buffer | null = null;
    if (garment_base64) {
      garmentBuffer = Buffer.from(garment_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    }

    const out: any = await runClothesVTO(personBuffer, garmentBuffer, garment_url);

    // Log the raw shape once so you can confirm the real key name coming
    // back from youcam.ts, then trim/remove this once confirmed.
    console.log('[try-on] raw result from runClothesVTO:', out);

    // runClothesVTO's return shape isn't guaranteed to be { url }. Normalize
    // it here so the client always gets a top-level `url`, the same way
    // /api/modify-image already does for modifyGarmentImage's result.
    const url =
      out?.url ??
      out?.resultUrl ??
      out?.result_url ??
      out?.imageUrl ??
      out?.image_url ??
      out?.output_url ??
      out?.data?.url ??
      null;

    if (!url) {
      console.error('[try-on] no recognizable url field in result:', out);
      return res.status(502).json({ error: 'Try-on succeeded but returned no image URL', raw: out });
    }

    res.json({ status: out?.status ?? 'success', url });
  } catch (e: any) {
    console.error('[try-on] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (_req, res) => {
  const index = path.join(process.cwd(), 'public', 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).send('Not found');
});

app.listen(PORT, () => console.log(`[server] Running at http://localhost:${PORT} with ${garments.length} garments`));