import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import os from 'os';

// .env loader
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) {
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
function getApiKey(): string { return process.env.YOUCAM_API_KEY || ''; }

const VTO_URL = 'https://yce-api-01.makeupar.com/s2s/v3.0/task/cloth';
const EDIT_URL = 'https://yce-api-01.makeupar.com/s2s/v2.0/task/image-to-image/youcam';
const CACHE_DIR = path.join(process.cwd(), 'public', 'vto-cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
console.log('[youcam] API key ' + (getApiKey() ? 'loaded' : 'MISSING'));

async function uploadImage(buffer: Buffer, filename: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `aequidrape_${Date.now()}_${filename}`);
  fs.writeFileSync(tmpFile, buffer);
  const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';

  const cleanup = () => { try { fs.unlinkSync(tmpFile); } catch {} };

  // 1. Telegraph (Primary - works perfectly for valid, small JPEGs)
  try {
    console.log('[upload] Trying telegra.ph...');
    const res = execSync(
      `curl -s -X POST -F "file=@${tmpFile}" -A "${ua}" https://telegra.ph/upload`,
      { encoding: 'utf8', timeout: 30000 }
    ).trim();
    
    const data = JSON.parse(res);
    if (data?.[0]?.src) {
      const url = 'https://telegra.ph' + data[0].src;
      console.log('[upload] Success via telegra.ph:', url);
      cleanup();
      return url;
    }
    console.log('[upload] telegra.ph unexpected response:', res.slice(0, 100));
  } catch (e: any) {
    console.log('[upload] telegra.ph curl error:', e.message);
  }

  // 2. uguu.se (Fallback)
  try {
    console.log('[upload] Trying uguu.se...');
    const res = execSync(
      `curl -s -F "files[]=@${tmpFile}" -A "${ua}" https://uguu.se/upload`,
      { encoding: 'utf8', timeout: 30000 }
    ).trim();
    
    const data = JSON.parse(res);
    if (data?.success === true && data?.files?.[0]?.url) {
      const url = data.files[0].url;
      console.log('[upload] Success via uguu.se:', url);
      cleanup();
      return url;
    }
  } catch (e: any) {
    console.log('[upload] uguu.se error:', e.message);
  }

  cleanup();
  throw new Error('All image hosts failed. Check server logs.');
}

async function pollTask(baseUrl: string, taskId: string, maxAttempts = 90): Promise<any> {
  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`${baseUrl}/${taskId}`, { headers: { Authorization: `Bearer ${getApiKey()}` } });
    const data = await res.json();
    const status = data?.data?.task_status;
    console.log(`[Poll ${i}/${maxAttempts}] ${status}`);
    if (status === 'success') return data.data.results;
    if (status === 'error' || status === 'failed') throw new Error('Task failed: ' + JSON.stringify(data).slice(0, 300));
  }
  throw new Error('Timeout waiting for task');
}

function extractUrl(results: any): string {
  const u = Array.isArray(results) ? (results[0]?.url || results[0]) : results?.url;
  if (typeof u !== 'string' || !u) throw new Error('No image URL in results');
  return u;
}

export async function modifyGarmentImage(garmentBuffer: Buffer, prompt: string): Promise<string> {
  const API_KEY = getApiKey();
  if (!API_KEY) throw new Error('Missing API Key');
  const garmentUrl = await uploadImage(garmentBuffer, 'garment_edit.jpg');
  const fullPrompt = `A high-quality flat lay photo of a clothing item. ${prompt}. Professional studio lighting, clean background, high resolution.`;
  const startRes = await fetch(EDIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ src_file_urls: [garmentUrl], model: 'youcam-image-v2', prompt: fullPrompt, size: '1024*1024' }),
  });
  if (!startRes.ok) throw new Error('Edit start failed: ' + (await startRes.text()).slice(0, 200));
  const taskId = (await startRes.json())?.data?.task_id;
  if (!taskId) throw new Error('No task_id for edit');
  return extractUrl(await pollTask(EDIT_URL, taskId));
}

export async function runClothesVTO(personBuffer: Buffer, garmentBuffer: Buffer | null, garmentUrl?: string) {
  const API_KEY = getApiKey();
  if (!API_KEY) throw new Error('Missing API Key');

  const personUrl = await uploadImage(personBuffer, 'person.jpg');
  
  let garmentUrlFinal = garmentUrl;
  if (!garmentUrlFinal && garmentBuffer) {
    garmentUrlFinal = await uploadImage(garmentBuffer, 'garment.jpg');
  }
  if (!garmentUrlFinal) throw new Error('Missing garment image');

  const hash = crypto.createHash('md5').update(personUrl).update(garmentUrlFinal).digest('hex');
  const cacheFile = path.join(CACHE_DIR, hash + '.json');
  try { 
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); 
    if (c.url) {
      console.log('[VTO] Cache hit');
      return { url: c.url, status: 'cached' }; 
    }
  } catch { /* miss */ }

  console.log('[VTO] Starting task with URLs...');
  const startRes = await fetch(VTO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ 
      src_file_url: personUrl, 
      ref_file_url: garmentUrlFinal, 
      garment_category: 'auto' 
    }),
  });

  if (!startRes.ok) throw new Error('VTO start failed: ' + (await startRes.text()).slice(0, 200));
  const startData = await startRes.json();
  const taskId = startData?.data?.task_id;
  if (!taskId) throw new Error('No task_id for VTO: ' + JSON.stringify(startData));

  const url = extractUrl(await pollTask(VTO_URL, taskId));
  fs.writeFileSync(cacheFile, JSON.stringify({ url }));
  return { url, status: 'live' };
}