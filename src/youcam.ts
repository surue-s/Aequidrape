import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// .env loader (safe for serverless where process.env is already populated by Vercel)
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
const CACHE_DIR = process.env.VERCEL 
  ? path.join('/tmp', 'vto-cache') 
  : path.join(process.cwd(), 'public', 'vto-cache');
  
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
console.log('[youcam] API key ' + (getApiKey() ? 'loaded' : 'MISSING'));

async function uploadImage(buffer: Buffer, filename: string): Promise<string> {
const blob = new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' });
  // 1. Telegraph (Primary)
  try {
    console.log('[upload] Trying telegra.ph...');
    const formData = new FormData();
    formData.append('file', blob, filename);
    
    const res = await fetch('https://telegra.ph/upload', {
      method: 'POST',
      body: formData,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    if (data?.[0]?.src) {
      console.log('[upload] Success via telegra.ph');
      return 'https://telegra.ph' + data[0].src;
    }
    console.log('[upload] telegra.ph unexpected response:', JSON.stringify(data).slice(0, 100));
  } catch (e: any) {
    console.log('[upload] telegra.ph error:', e.message);
  }

  // 2. uguu.se (Fallback)
  try {
    console.log('[upload] Trying uguu.se...');
    const formData2 = new FormData();
    formData2.append('files[]', blob, filename);
    
    const res2 = await fetch('https://uguu.se/upload', {
      method: 'POST',
      body: formData2,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data2 = await res2.json();
    if (data2?.success === true && data2?.files?.[0]?.url) {
      console.log('[upload] Success via uguu.se');
      return data2.files[0].url;
    }
  } catch (e: any) {
    console.log('[upload] uguu.se error:', e.message);
  }

  throw new Error('All image hosts failed. Check server logs.');
}

async function pollTask(baseUrl: string, taskId: string, maxAttempts = 90): Promise<any> {
  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(baseUrl + '/' + taskId, { headers: { Authorization: 'Bearer ' + getApiKey() } });
    const data = await res.json();
    const status = data?.data?.task_status;
    console.log('[Poll ' + i + '/' + maxAttempts + '] ' + status);
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

async function downloadToLocalCache(remoteUrl: string, hash: string): Promise<string> {
  const localFile = path.join(CACHE_DIR, hash + '.jpg');
  const localUrl = '/vto-cache/' + hash + '.jpg';

  let res = await fetch(remoteUrl);
  if (!res.ok) {
    console.log('[VTO] plain fetch of result got ' + res.status + ', retrying with bearer token');
    res = await fetch(remoteUrl, { headers: { Authorization: 'Bearer ' + getApiKey() } });
  }
  if (!res.ok) {
    throw new Error('Failed to download rendered image (' + res.status + ' ' + res.statusText + '): ' + remoteUrl);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(localFile, buf);
  return localUrl;
}

export async function modifyGarmentImage(garmentBuffer: Buffer, prompt: string): Promise<string> {
  const API_KEY = getApiKey();
  if (!API_KEY) throw new Error('Missing API Key');
  const garmentUrl = await uploadImage(garmentBuffer, 'garment_edit.jpg');
  const fullPrompt = 'A high-quality flat lay photo of a clothing item. ' + prompt + '. Professional studio lighting, clean background, high resolution.';
  const startRes = await fetch(EDIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API_KEY },
    body: JSON.stringify({ src_file_urls: [garmentUrl], model: 'youcam-image-v2', prompt: fullPrompt, size: '1024*1024' }),
  });
  if (!startRes.ok) throw new Error('Edit start failed: ' + (await startRes.text()).slice(0, 200));
  const taskId = (await startRes.json())?.data?.task_id;
  if (!taskId) throw new Error('No task_id for edit');
  const remoteUrl = extractUrl(await pollTask(EDIT_URL, taskId));

  const hash = crypto.createHash('md5').update(garmentUrl).update(prompt).digest('hex');
  return downloadToLocalCache(remoteUrl, hash);
}

export async function runClothesVTO(personBuffer: Buffer, garmentBuffer: Buffer | null, garmentUrl?: string) {
  const API_KEY = getApiKey();
  if (!API_KEY) throw new Error('Missing API Key');

  const personUrl = await uploadImage(personBuffer, 'person.jpg');
  let garmentUrlFinal = garmentUrl;

  // CRITICAL FIX: If garmentUrl is a local path (e.g., from our cache), read it and upload to a public host
  if (garmentUrlFinal && garmentUrlFinal.startsWith('/')) {
    const localPath = process.env.VERCEL 
      ? path.join('/tmp', garmentUrlFinal) 
      : path.join(process.cwd(), 'public', garmentUrlFinal);
      
    if (fs.existsSync(localPath)) {
      console.log('[VTO] Local garment detected, uploading to public host...');
      const localBuffer = fs.readFileSync(localPath);
      garmentUrlFinal = await uploadImage(localBuffer, 'modified_garment.jpg');
    } else {
      throw new Error('Local cached garment not found: ' + localPath);
    }
  }

  if (!garmentUrlFinal && garmentBuffer) {
    garmentUrlFinal = await uploadImage(garmentBuffer, 'garment.jpg');
  }
  
  if (!garmentUrlFinal) throw new Error('Missing garment image');

  const hash = crypto.createHash('md5').update(personUrl).update(garmentUrlFinal).digest('hex');
  const cacheFile = path.join(CACHE_DIR, hash + '.json');
  const cachedLocalFile = path.join(CACHE_DIR, hash + '.jpg');
  
  try {
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (c.url && fs.existsSync(cachedLocalFile)) {
      console.log('[VTO] Cache hit');
      return { url: c.url, status: 'cached' };
    }
  } catch { /* miss */ }

  console.log('[VTO] Starting task with URLs...');
  const startRes = await fetch(VTO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API_KEY },
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

  const remoteUrl = extractUrl(await pollTask(VTO_URL, taskId));
  const localUrl = await downloadToLocalCache(remoteUrl, hash);

  fs.writeFileSync(cacheFile, JSON.stringify({ url: localUrl }));
  return { url: localUrl, status: 'live' };
}