import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Configuration
const API_KEY = process.env.YOUCAM_API_KEY || "";
const API_URL = "https://api.youcam.com/api/v1/clothes/virtual-try-on";
const CACHE_DIR = path.join(process.cwd(), 'public', 'vto-cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export async function runClothesVTO(personImageBase64: string, garmentImagePath: string) {
    // 1. Validation
    if (!API_KEY) return { status: 'error', message: 'Missing YOUCAM_API_KEY in environment' };
    if (!fs.existsSync(garmentImagePath)) return { status: 'error', message: `Garment image not found at ${garmentImagePath}` };

    // 2. Read Images
    const garmentBuffer = fs.readFileSync(garmentImagePath);
    
    // Strip data URI prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = personImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const personBuffer = Buffer.from(base64Data, 'base64');

    // 3. Check Cache (Speed up demo & save API quota)
    const hash = crypto.createHash('md5')
        .update(garmentBuffer)
        .update(personBuffer.slice(0, 2000)) // Hash first 2KB of person image for speed
        .digest('hex');
        
    const cacheFile = path.join(CACHE_DIR, `${hash}.json`);

    if (fs.existsSync(cacheFile)) {
        try {
            const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
            if (cached.url) return { status: 'cached', url: cached.url };
        } catch (e) { /* Ignore bad cache file */ }
    }

    // 4. Prepare Multipart Form Data
    // We use global FormData and Blob (available in Node 18+).
    // The 3rd argument to append() sets the filename, which some APIs require.
    const form = new FormData();
    
    const personBlob = new Blob([personBuffer], { type: 'image/jpeg' });
    form.append('image', personBlob, 'person.jpg');

    const garmentBlob = new Blob([garmentBuffer], { type: 'image/jpeg' });
    form.append('garment_image', garmentBlob, 'garment.jpg');

    // Optional: If the API strictly requires a garment_id string alongside the image, 
    // you can add it here, but usually the image is enough for "try-on".
    // form.append('garment_id', 'generic-id'); 

    // 5. Call API
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            },
            body: form
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { 
                status: 'error', 
                code: response.status, 
                message: `API Error: ${errorText.slice(0, 200)}` 
            };
        }

        const contentType = response.headers.get('content-type') || '';
        let resultUrl = '';

        if (contentType.includes('application/json')) {
            const data = await response.json();
            // Handle various response shapes
            resultUrl = data.image || data.preview_url || data.result_image || data.url || '';
            
            // If API returns raw base64 string in JSON
            if (resultUrl && !resultUrl.startsWith('http') && !resultUrl.startsWith('data:')) {
                 resultUrl = `data:image/jpeg;base64,${resultUrl}`;
            }
        } else if (contentType.includes('image')) {
            // Handle direct image response
            const buffer = Buffer.from(await response.arrayBuffer());
            resultUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
        }

        if (!resultUrl) {
            return { status: 'error', message: 'Success (200) but no image URL found in response.' };
        }

        // 6. Save to Cache
        fs.writeFileSync(cacheFile, JSON.stringify({ url: resultUrl }));

        return { status: 'success', url: resultUrl };

    } catch (error: any) {
        return { status: 'error', message: `Network Error: ${error.message}` };
    }
}