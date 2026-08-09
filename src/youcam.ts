import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const API_KEY = process.env.YOUCAM_API_KEY || "";
const VTO_URL = "https://yce-api-01.makeupar.com/s2s/v3.0/task/cloth";
const EDIT_URL = "https://yce-api-01.makeupar.com/s2s/v2.0/task/image-to-image/youcam";
const CACHE_DIR = path.join(process.cwd(), 'public', 'vto-cache');

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

async function uploadToCatbox(buffer: Buffer, filename: string): Promise<string> {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' }), filename);    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Catbox upload failed: ${res.status}`);
    return (await res.text()).trim();
}

async function pollTask(baseUrl: string, taskId: string, maxAttempts = 60) {
    for (let i = 1; i <= maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const res = await fetch(`${baseUrl}/${taskId}`, { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        const data = await res.json();
        const status = data?.data?.task_status;
        console.log(`[Poll ${i}/${maxAttempts}] Status: ${status}`); // VERBOSE LOGGING
        
        if (status === 'success') return data.data.results;
        if (status === 'error' || status === 'failed') throw new Error(`Task failed: ${JSON.stringify(data)}`);
    }
    throw new Error('Timeout waiting for result');
}

/**
 * VISUAL MODIFICATION: Edit a garment image using AI
 */
export async function modifyGarmentImage(garmentBuffer: Buffer, prompt: string) {
    if (!API_KEY) throw new Error('Missing API Key');
    
    console.log('[Modify] Uploading garment for editing...');
    const garmentUrl = await uploadToCatbox(garmentBuffer, 'garment_edit.jpg');
    
    // Construct a prompt that preserves the garment but adds the feature
    const fullPrompt = `A high-quality flat lay photo of a clothing item. ${prompt}. Professional studio lighting, clean background, high resolution.`;

    console.log('[Modify] Starting edit task...');
    const startRes = await fetch(EDIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({
            src_file_urls: [garmentUrl],
            model: "youcam-image-v2",
            prompt: fullPrompt,
            size: "1024*1024" // Square is best for garments
        })
    });

    if (!startRes.ok) throw new Error(`Edit start failed: ${await startRes.text()}`);
    const startData = await startRes.json();
    const taskId = startData?.data?.task_id;
    if (!taskId) throw new Error('No task ID for edit');

    const results = await pollTask(EDIT_URL, taskId);
    const resultUrl = Array.isArray(results) ? results[0]?.url || results[0] : results?.url;
    if (!resultUrl) throw new Error('No image returned from edit');
    
    return resultUrl;
}

/**
 * VIRTUAL TRY-ON: Drape garment on person
 */
export async function runClothesVTO(personBuffer: Buffer, garmentBuffer: Buffer) {
    if (!API_KEY) throw new Error('Missing API Key');

    console.log('[VTO] Uploading images...');
    const personUrl = await uploadToCatbox(personBuffer, 'person.jpg');
    const garmentUrl = await uploadToCatbox(garmentBuffer, 'garment.jpg');

    console.log('[VTO] Starting try-on task...');
    const startRes = await fetch(VTO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({ src_file_url: personUrl, ref_file_url: garmentUrl, garment_category: 'auto' })
    });

    if (!startRes.ok) throw new Error(`VTO start failed: ${await startRes.text()}`);
    const startData = await startRes.json();
    const taskId = startData?.data?.task_id;
    if (!taskId) throw new Error('No task ID for VTO');

    const results = await pollTask(VTO_URL, taskId);
    const resultUrl = Array.isArray(results) ? results[0]?.url || results[0] : results?.url;
    if (!resultUrl) throw new Error('No image returned from VTO');
    
    return resultUrl;
}