import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import os from 'os';

// ---- .env loader (import-order safe; runs at module load) ----
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

function getApiKey(): string {
  return process.env.YOUCAM_API_KEY || '';
}

// ---- ALL constants live HERE. Never scatter or delete during edits. ----
const VTO_URL = 'https://yce-api-01.makeupar.com/s2s/v3.0/task/cloth';
const EDIT_URL = 'https://yce-api-01.makeupar.com/s2s/v2.0/task/image-to-image/youcam';
const CACHE_DIR = path.join(process.cwd(), 'public', 'vto-cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

console.log('[youcam] API key ' + (getApiKey() ? 'loaded (' + getApiKey().slice(0, 6) + '...)' : 'MISSING'));

// ---- Temp image hosting ----
// YouCam downloads URLs server-side. catbox.moe is BLOCKED by YouCam
async function uploadImage(buffer: Buffer, filename: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `aequidrape_${Date.now()}_${filename}`);
  fs.writeFileSync(tmpFile, buffer);
  const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';

  const cleanup = () => { try { fs.unlinkSync(tmpFile); } catch {} };

  // 1. uguu.se (PROVEN TO WORK WITH YOUCAM)
  try {
    console.log('[upload] Trying uguu.se...');
    // CRITICAL: The field name MUST be "files[]" for uguu.se
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
    console.log('[upload] uguu.se unexpected response:', res.slice(0, 150));
  } catch (e: any) {
    console.log('[upload] uguu.se curl error:', e.message);
  }

  // 2. 0x0.st (Fallback)
  try {
    console.log('[upload] Trying 0x0.st...');
    const res = execSync(
      `curl -s -F "file=@${tmpFile}" -A "${ua}" https://0x0.st`,
      { encoding: 'utf8', timeout: 30000 }
    ).trim();
    
    if (res.startsWith('http')) {
      console.log('[upload] Success via 0x0.st');
      cleanup();
      return res;
    }
    console.log('[upload] 0x0.st unexpected response:', res.slice(0, 100));
  } catch (e: any) {
    console.log('[upload] 0x0.st curl error:', e.message);
  }

  // 3. tmpfiles.org (Fallback)
  try {
    console.log('[upload] Trying tmpfiles.org...');
    const res = execSync(
      `curl -s -F "file=@${tmpFile}" -A "${ua}" https://tmpfiles.org/api/v1/upload`,
      { encoding: 'utf8', timeout: 30000 }
    ).trim();
    
    const data = JSON.parse(res);
    if (data?.status === 'success' && data?.data?.url) {
      const url = data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      console.log('[upload] Success via tmpfiles.org:', url);
      cleanup();
      return url;
    }
    console.log('[upload] tmpfiles.org unexpected response:', res.slice(0, 100));
  } catch (e: any) {
    console.log('[upload] tmpfiles.org curl error:', e.message);
  }

  cleanup();
  throw new Error('All image hosts failed. Check server logs.');
}
// ---- Async task polling (YouCam pattern: POST start -> GET poll) ----
async function pollTask(baseUrl: string, taskId: string, maxAttempts = 90): Promise<any> {
  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`${baseUrl}/${taskId}`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    });
    const data = await res.json();
    const status = data?.data?.task_status;
    console.log(`[Poll ${i}/${maxAttempts}] ${status}`);
    if (status === 'success') return data.data.results;
    if (status === 'error' || status === 'failed') {
      throw new Error('Task failed: ' + JSON.stringify(data).slice(0, 300));
    }
  }
  throw new Error('Timeout waiting for task');
}

function extractUrl(results: any): string {
  const u = Array.isArray(results) ? (results[0]?.url || results[0]) : results?.url;
  if (typeof u !== 'string' || !u) throw new Error('No image URL in results');
  return u;
}

// ---- AI garment modification (image-to-image) ----
export async function modifyGarmentImage(garmentBuffer: Buffer, prompt: string): Promise<string> {
  const API_KEY = getApiKey();
  if (!API_KEY) throw new Error('Missing API Key');

  console.log('[Modify] uploading garment...');
  const garmentUrl = await uploadImage(garmentBuffer, 'garment_edit.jpg');
  const fullPrompt = `A high-quality flat lay photo of a clothing item. ${prompt}. Professional studio lighting, clean background, high resolution.`;

  const startRes = await fetch(EDIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      src_file_urls: [garmentUrl],
      model: 'youcam-image-v2',
      prompt: fullPrompt,
      size: '1024*1024',
    }),
  });
  if (!startRes.ok) throw new Error('Edit start failed: ' + (await startRes.text()).slice(0, 200));
  const taskId = (await startRes.json())?.data?.task_id;
  if (!taskId) throw new Error('No task_id for edit');

  return extractUrl(await pollTask(EDIT_URL, taskId));
}

// ---- Clothes VTO (with md5-keyed result cache) ----
export async function runClothesVTO(personBuffer: Buffer, garmentBuffer: Buffer) {
  const API_KEY = getApiKey();
  if (!API_KEY) throw new Error('Missing API Key');

  const hash = crypto.createHash('md5').update(personBuffer).update(garmentBuffer).digest('hex');
  const cacheFile = path.join(CACHE_DIR, hash + '.json');
  try {
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (c.url) return { url: c.url, status: 'cached' };
  } catch { /* cache miss */ }

  console.log('[VTO] uploading images...');
  const personUrl = await uploadImage(personBuffer, 'person.jpg');
  const garmentUrl = await uploadImage(garmentBuffer, 'garment.jpg');

  const startRes = await fetch(VTO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      src_file_url: personUrl,
      ref_file_url: garmentUrl,
      garment_category: 'auto',
    }),
  });
  if (!startRes.ok) throw new Error('VTO start failed: ' + (await startRes.text()).slice(0, 200));
  const taskId = (await startRes.json())?.data?.task_id;
  if (!taskId) throw new Error('No task_id for VTO');

  const url = extractUrl(await pollTask(VTO_URL, taskId));
  fs.writeFileSync(cacheFile, JSON.stringify({ url }));
  return { url, status: 'live' };
}