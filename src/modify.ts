export async function adaptGarment(prompt: string) {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:1.5b',
        prompt: `Extract clothing adaptations as JSON {"mods":[{"type":"side-zipper|magnetic|hook-loop|tagless|flat-seams|back-rise|ease|pocket|one-hand","side":"left|right|both","label":string}]}. Only use these exact types. Request: "${prompt}"`,
        stream: false,
        format: 'json'
      })
    });

    if (response.ok) {
      const data = await response.json();
      const parsed = JSON.parse(data.response);
      if (parsed.mods && parsed.mods.length > 0) {
        return { ...parsed, source: 'local-llm' };
      }
    }
  } catch (e) {
    console.warn('Ollama unavailable, falling back to rules');
  }

  // Fallback to deterministic rules if Ollama is off
  return fallbackParse(prompt);
}

function fallbackParse(prompt: string) {
  const p = prompt.toLowerCase();
  const mods: any[] = [];
  const side = (p.match(/\b(left|right|both)\b/) || [])[1] || 'left';
  if (/zip/.test(p)) mods.push({ type: 'side-zipper', side, label: `Full ${side}-side zipper` });
  if (/magnet/.test(p)) mods.push({ type: 'magnetic', label: 'Magnetic closure' });
  if (/velcro|hook|loop/.test(p)) mods.push({ type: 'hook-loop', label: 'Hook-and-loop closure' });
  return { mods, source: 'rules' };
}