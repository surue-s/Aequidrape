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
  const OR_KEY = process.env.OPENROUTER_API_KEY;

  if (!OR_KEY || OR_KEY === 'sk-or-v1-your-key-here') {
    return res.status(400).json({ error: 'Missing valid OPENROUTER_API_KEY in .env' });
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

  const systemPrompt = `You are an expert adaptive fashion advocate and accessibility consultant, trained in 3D virtual garment design for disabled people. Your task is to draft a polite, professional, and highly effective inquiry email to a clothing brand on behalf of a disabled shopper.

Use the following concepts from adaptive fashion research:
- "Wearing ease": the distance between body and garment, which must be distributed differently for seated postures, prosthetics, and sensory needs.
- "Fit points": areas where the garment has direct contact with the body (shoulders, underarms, waist).
- "Fashion points": areas where the garment drapes freely for aesthetic appearance.
- "Co-design": the collaborative process of Design–Display–Evaluation–Adjustment.

The shopper has used our platform to identify necessary modifications based on their specific posture, dexterity, sensory needs, mobility aids, and exact body measurements. Your goal is to clearly communicate these needs without oversharing private medical details, explain *why* the modifications are necessary, and ask if the brand can accommodate these alterations or offer similar adaptive alternatives.

Tone: Professional, respectful, empowering, and clear.
Format: Output ONLY the email Subject line (starting with "Subject: ") and the Email Body. Do not include any introductory or concluding remarks outside the email itself.`;

  const userPrompt = `Shopper Profile:
- Posture: ${profile.posture || 'Not specified'}
- Dexterity: ${profile.dexterity || 'Not specified'}
- Sensory Needs: ${(profile.sensory || []).join(', ') || 'None'}
- Mobility Aids: ${(profile.mobility_aids || []).join(', ') || 'None'}
- Fit Concerns: ${(profile.fit_concerns || []).join(', ') || 'None'}
- Additional Context: ${profile.dex_notes || profile.aid_other || 'None'}
- Body Measurements: ${measureStr}

Garment Details:
- Name: ${garment.name || 'Garment'}
- Current Closure: ${garment.closure_type || 'Standard'}
- Fabric/Stretch: ${garment.fabric || 'Standard'}, ${garment.stretch || 'Standard'}
- Back Rise: ${garment.back_rise || 'Standard'}

Requested Modifications (from Workshop History):
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
        // Reverted to Llama 3.1 8B Instruct - much better for natural language emails than code-optimized models
        model: 'meta-llama/llama-3.1-8b-instruct:free',
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

app.get('*', (_req, res) => {
  const index = path.join(process.cwd(), 'public', 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).send('Not found');
});

app.listen(PORT, () => console.log(`[server] Running at http://localhost:${PORT} with ${garments.length} garments`));