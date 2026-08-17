# Aequidrape

Adaptive fashion virtual try-on platform for disabled shoppers. Modify garments with voice or text, preview them on your body, and send a professional modification request to the seller.

## Features

- Fit profile with posture, dexterity, mobility aids, and body measurements
- AI garment modification via text or voice input
- Virtual try-on with before/after compare slider
- Estimated pressure zones based on profile and garment data
- Workshop with full modification history (chat-style)
- AI-drafted seller email from accumulated modification context
- Background removal pipeline for cleaner try-on results

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js, TypeScript |
| Virtual Try-On | YouCam Clothes VTO API v3.0 |
| Image Editing | YouCam Image-to-Image API |
| Email Generation | OpenRouter API (nvidia/nemotron-3-ultra-550b-a55b:free) |
| Voice Input | Web Speech API |
| Background Removal | @imgly/background-removal (ONNX Runtime, WASM) |

## Prerequisites

- Node.js >= 18.0.0
- A YouCam API key (Perfect Corp developer portal)
- An OpenRouter API key (free at openrouter.ai)

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/aequidrape.git
cd aequidrape
npm install
