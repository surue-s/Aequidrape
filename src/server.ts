import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { runClothesVTO, modifyGarmentImage } from './youcam';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Load garments safely
let garments: any[] = [];
try {
  const garmentsPath = path.join(process.cwd(), 'data', 'garments.json');
  if (fs.existsSync(garmentsPath)) {
    garments = JSON.parse(fs.readFileSync(garmentsPath, 'utf8'));
  }
} catch (e) {
  console.warn('[server] Could not load garments.json');
}

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
  
  // Updated to include 'no_hands' and check for adaptive closures
  if ((profile.dexterity === 'limited' || profile.dexterity === 'one_handed' || profile.dexterity === 'no_hands') && /magnetic|hook|zipper|velcro|pullover/i.test(garment.closure_type || '')) {
    ok.push(`${garment.closure_type} closure supports easier dressing.`);
  }
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
    console.log('[try-on] raw result from runClothesVTO:', out);

    const url =
      out?.url ?? out?.resultUrl ?? out?.result_url ?? out?.imageUrl ??
      out?.image_url ?? out?.output_url ?? out?.data?.url ?? null;

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

app.post('/api/generate-email', async (req, res) => {
  const profile = req.body.profile || {};
  const garment = req.body.garment || {};
  const history = req.body.history || [];
  const OR_KEY = (req.headers['x-openrouter-key'] as string) || process.env.OPENROUTER_API_KEY;
  const MODEL = (req.headers['x-model'] as string) || 'nvidia/nemotron-3-ultra-550b-a55b:free';

  if (!OR_KEY || OR_KEY === 'sk-or-v1-your-key-here') {
    return res.status(400).json({ error: 'Missing valid OPENROUTER_API_KEY. Please set it in the Settings page or .env file.' });
  }

  const modsList = history.map((h: any, i: number) => `${i + 1}. ${h.prompt}`).join('\n');
  
  // Extract and format body measurements for the AI prompt
  const measurements = profile.measurements || {};
  const measureStr = [
    measurements.height ? 'Height: ' + measurements.height + 'cm' : '',
    measurements.neck ? 'Neck: ' + measurements.neck + 'cm' : '',
    measurements.chest ? 'Chest/Bust: ' + measurements.chest + 'cm' : '',
    measurements.waist ? 'Waist: ' + measurements.waist + 'cm' : '',
    measurements.hip ? 'Hip: ' + measurements.hip + 'cm' : '',
    measurements.shoulder ? 'Shoulder width: ' + measurements.shoulder + 'cm' : '',
    measurements.arm ? 'Arm length: ' + measurements.arm + 'cm' : '',
    measurements.inseam ? 'Inseam/Leg: ' + measurements.inseam + 'cm' : ''
  ].filter(Boolean).join(', ') || 'Not provided';

  const systemPrompt = `You are an adaptive fashion advocate writing a professional inquiry email to a clothing brand on behalf of a disabled shopper.

Write a clear, concise email (under 200 words) that:
1. Briefly introduces the shopper's needs (posture, dexterity, mobility aids) without oversharing medical details
2. States the specific modification requested and explains simply why it is needed for their body
3. Asks if the brand can accommodate the modification or offer similar adaptive alternatives

STRICT FORMATTING RULES:
- Use plain text ONLY
- No markdown, no bold, no bullet points, no asterisks, no numbered lists
- Write in simple, short paragraphs
- Do not explain technical concepts like "wearing ease" or "fit points" — just describe the practical need in plain language
- Keep the tone warm, professional, and direct

Format: Output ONLY the email Subject line (starting with "Subject: ") followed by the Email Body. Do not include any introductory or concluding remarks outside the email itself.`;

  const userPrompt = `Shopper Profile:
- Posture: ${profile.posture || 'Not specified'}
- Dexterity: ${profile.dexterity || 'Not specified'}
- Sensory Needs: ${(profile.sensory || []).join(', ') || 'None'}
- Mobility Aids: ${(profile.mobility_aids || []).join(', ') || 'None'}
- Body Measurements: ${measureStr}

Garment Details:
- Name: ${garment.name || 'Garment'}
- Current Closure: ${garment.closure_type || 'Standard'}
- Fabric/Stretch: ${garment.fabric || 'Standard'}, ${garment.stretch || 'Standard'}

Requested Modifications:
${modsList || 'No specific modifications logged.'}

Draft the email now.`;

  try {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OR_KEY,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Aequidrape'
      },
      body: JSON.stringify({
        model: MODEL, // Using the dynamic MODEL variable from headers or fallback
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!orRes.ok) {
      const errText = await orRes.text();
      console.error('[email] OpenRouter API error:', orRes.status, errText);
      return res.status(500).json({ error: 'OpenRouter API failed: ' + orRes.status });
    }

    const data = await orRes.json();
    if (data.error) {
      console.error('[email] OpenRouter error object:', data.error);
      return res.status(500).json({ error: data.error.message || 'AI generation failed' });
    }

    const emailText = data?.choices?.[0]?.message?.content;
    if (!emailText) {
      return res.status(500).json({ error: 'AI returned empty response' });
    }

    res.json({ email: emailText.trim() });
  } catch (e: any) {
    console.error('[email] Network error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Clear VTO Cache endpoint for the Settings page
app.post('/api/clear-cache', (_req, res) => {
  const cacheDir = path.join(process.cwd(), 'public', 'vto-cache');
  try {
    if (fs.existsSync(cacheDir)) {
      fs.readdirSync(cacheDir).forEach(file => {
        fs.unlinkSync(path.join(cacheDir, file));
      });
    }
    res.json({ status: 'ok', message: 'Cache cleared' });
  } catch (e: any) {
    console.error('[cache] error clearing cache:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/vto-cache/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = process.env.VERCEL 
    ? path.join('/tmp', 'vto-cache', filename)
    : path.join(process.cwd(), 'public', 'vto-cache', filename);
    
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Image not found in cache');
  }
});
export default app;