import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { runClothesVTO, modifyGarmentImage } from './youcam';

// ============================================================
// 1. ENV & DATA LOADING
// ============================================================
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

// ============================================================
// 2. EXPRESS SETUP
// ============================================================
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '50mb' })); // Increased for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

// ============================================================
// 3. ROUTES
// ============================================================
app.get('/api/health', (_req, res) => res.json({ status: 'ok', garments: garments.length }));
app.get('/api/products', (_req, res) => res.json(garments));
app.get('/api/garments', (_req, res) => res.json({ garments }));

app.post('/api/evaluate', (req, res) => {
  const profile = req.body.user_profile || req.body.profile;
  const garmentId = req.body.garment_id || req.body.garmentId;
  const garment = garments.find((g) => g.id === garmentId);
  if (!profile || !garment) return res.status(400).json({ error: 'Missing profile or garment' });

  // Inline fallback rules engine
  const ok: string[] = [], warn: string[] = [], ask: string[] = [];
  if ((profile.dexterity === 'limited' || profile.dexterity === 'one_handed') && /magnetic|hook|zipper/.test(garment.closure_type || '')) ok.push(`${garment.closure_type} closure supports easier dressing.`);
  if (profile.posture === 'seated' && garment.back_rise === 'high') ok.push('High back rise supports seated coverage.');
  if (profile.posture === 'seated' && garment.back_rise !== 'high') warn.push('Back rise may sit low while seated.');
  ask.push('What is the seated back length in centimetres?');
  
  const confidence = warn.length === 0 && ok.length >= 2 ? 'high' : warn.length > ok.length ? 'low' : 'moderate';
  res.json({ garment, insight: { compatibility: ok, risks: warn, questions_for_seller: ask, confidence, summary: `${garment.name}: ${ok.join(' ')} ${warn.join(' ')}` } });
});

// --- NEW: VISUAL MODIFICATION ROUTE ---
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

// --- UPDATED: VTO ROUTE (Handles both base64 and URLs) ---
app.post('/api/try-on', async (req, res) => {
  try {
    const { person_base64, garment_base64, garment_url } = req.body;
    if (!person_base64) return res.status(400).json({ error: 'Missing person image' });
    
    const personBuffer = Buffer.from(person_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    let garmentBuffer: Buffer;

    if (garment_base64) {
      garmentBuffer = Buffer.from(garment_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    } else if (garment_url) {
      const imgRes = await fetch(garment_url);
      garmentBuffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      return res.status(400).json({ error: 'Missing garment image' });
    }

    const resultUrl = await runClothesVTO(personBuffer, garmentBuffer);
    res.json({ status: 'success', url: resultUrl });
  } catch (e: any) {
    console.error('[try-on] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// SPA Fallback
app.get('*', (_req, res) => {
  const index = path.join(process.cwd(), 'public', 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).send('Not found');
});

app.listen(PORT, () => console.log(`[server] Running at http://localhost:${PORT} with ${garments.length} garments`));