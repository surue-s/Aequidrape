export function parseAdaptation(prompt: string) {
  const p = prompt.toLowerCase();
  const mods: any[] = []; const patch: any = {};
  const side = (p.match(/\b(left|right|both)\b/) || [])[1] || 'left';
  if (/zip/.test(p)) { mods.push({ type: 'side-zipper', side, label: `Full ${side}-side zipper` }); patch.closure_type = 'side zippers'; }
  if (/magnet/.test(p)) { mods.push({ type: 'magnetic', label: 'Magnetic closure' }); patch.closure_type = 'magnetic'; }
  if (/velcro|hook|loop/.test(p)) { mods.push({ type: 'hook-loop', label: 'Hook-and-loop closure' }); patch.closure_type = 'hook-and-loop'; }
  if (/tag/.test(p)) { mods.push({ type: 'tagless', label: 'Tagless / printed label' }); patch.tags = ['tag-free']; }
  if (/seam/.test(p)) { mods.push({ type: 'flat-seams', label: 'Flat, repositioned seams' }); patch.seams = 'Flat, repositioned'; }
  if (/(long|raise|extend|high).*(back|rise|coverage)/.test(p)) { mods.push({ type: 'back-rise', label: 'Extended back rise' }); patch.back_rise = 'high'; }
  if (/loose|relax|wide|room/.test(p)) { mods.push({ type: 'ease', label: 'Added ease, lower compression' }); patch.stretch = 'high'; }
  if (/pocket/.test(p)) { mods.push({ type: 'pocket', side, label: `Relocated ${side} pocket` }); patch.pocket_access = 'Seated-reachable'; }
  if (/one.?hand/.test(p)) { mods.push({ type: 'one-hand', label: 'One-handed pulls' }); patch.closure_type = patch.closure_type || 'magnetic'; }
  return { mods, patch };
}

export async function adaptGarment(prompt: string) {
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b', stream: false, format: 'json',
        prompt: `Extract clothing adaptations as JSON {"mods":[{"type":"side-zipper|magnetic|hook-loop|tagless|flat-seams|back-rise|ease|pocket|one-hand","side":"left|right|both","label":string}]}, only these types. Request: "${prompt}"`,
      }),
    });
    if (res.ok) {
      const parsed = JSON.parse((await res.json()).response);
      if (Array.isArray(parsed.mods) && parsed.mods.length)
        return { mods: parsed.mods, patch: parseAdaptation(parsed.mods.map((m: any) => m.label).join(' ')).patch, source: 'local-llm' };
    }
  } catch { /* Ollama not running */ }
  return { ...parseAdaptation(prompt), source: 'rules' };
}