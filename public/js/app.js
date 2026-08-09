/**
 * Aequidrape — production frontend.
 * Routing, state, VTO studio, rendering, accessibility.
 * Backend contract: GET /api/products | GET /api/garments | POST /api/evaluate
 * YouCam plug-in point: setTryOnResult(url)
 * No alerts, no emojis, no paid AI. All failures degrade gracefully.
 */

const STATE = {
  page: 'home',
  profile: JSON.parse(localStorage.getItem('aequidrape_profile') || 'null'),
  products: [],
  photo: { key: 'standing', src: '/demo-images/01-standing-original.jpg', custom: false },
  garmentId: null,
  insight: null,
  current: null,
  filters: new Set(),
};

const PHOTOS = {
  standing: '/demo-images/01-standing-original.jpg',
  seated: '/demo-images/02-seated-original.jpg',
  wheelchair: '/demo-images/03-wheelchair-original.jpg',
  prosthetic: '/demo-images/04-prosthetic-original.jpg',
};

const DEMO_PRODUCTS = [
  { id: 'adaptive-jacket-001', name: 'Magnetic Front Jacket', category: 'outerwear', color: 'rgba(201,122,60,0.55)', closure_type: 'magnetic', fabric: 'Technical cotton blend', stretch: 'moderate', tags: ['magnetic', 'tag-free'], seams: 'Flat back seams', back_rise: 'high', pocket_access: 'Side seams, seated-reachable', price: 140, description: 'Magnetic closure jacket with high back rise, built for seated comfort and one-handed dressing.' },
  { id: 'seated-pants-001', name: 'Seated Cargo Pant', category: 'bottom', color: 'rgba(74,144,164,0.5)', closure_type: 'hook-and-loop', fabric: 'Stretch twill', stretch: 'high', tags: ['hook-and-loop', 'high-stretch'], seams: 'Minimal inner-thigh', back_rise: 'high', pocket_access: 'Hip pockets, seated-reachable', price: 110, description: 'High back rise cargo pant with hook-and-loop closures and a reinforced gusset.' },
  { id: 'onehanded-shirt-001', name: 'One-Handed Shirt', category: 'top', color: 'rgba(139,163,157,0.55)', closure_type: 'magnetic', fabric: 'Soft cotton jersey', stretch: 'slight', tags: ['magnetic', 'tag-free'], seams: 'Soft flat seams', back_rise: 'medium', pocket_access: 'Chest pocket, magnetic flap', price: 85, description: 'Magnetic button-front shirt with a soft collar, designed for limited dexterity.' },
  { id: 'accessible-hoodie-001', name: 'No-Pull Hoodie', category: 'outerwear', color: 'rgba(87,83,75,0.45)', closure_type: 'magnetic', fabric: 'Organic cotton fleece', stretch: 'high', tags: ['magnetic', 'high-stretch', 'tag-free'], seams: 'Flat throughout', back_rise: 'medium', pocket_access: 'Deep kangaroo', price: 130, description: 'Full-zip magnetic hoodie. No drawstrings, roomy sleeves, high stretch.' },
  { id: 'adaptive-leggings-001', name: 'Side-Zip Legging', category: 'bottom', color: 'rgba(217,100,89,0.4)', closure_type: 'elastic + side zippers', fabric: 'High-stretch nylon', stretch: 'maximum', tags: ['zipper', 'high-stretch'], seams: 'Seam-free thigh option', back_rise: 'high', pocket_access: 'Side medical-device pocket', price: 95, description: 'Maximum-stretch legging with removable side zippers for braces and prosthetics.' },
];

const ART = {
  jacket: '<path d="M50 8 L36 14 L22 24 L16 54 L28 58 L30 42 L30 112 L70 112 L70 42 L72 58 L84 54 L78 24 L64 14 Z M50 8 L44 16 L50 22 L56 16 Z"/><line x1="50" y1="22" x2="50" y2="112"/>',
  shirt: '<path d="M50 10 L38 14 L26 22 L22 44 L32 48 L34 36 L34 108 L66 108 L66 36 L68 48 L78 44 L74 22 L62 14 Z M38 14 L50 30 L62 14"/>',
  pants: '<path d="M34 10 L66 10 L70 60 L68 112 L56 112 L52 62 L48 62 L44 112 L32 112 L30 60 Z"/><line x1="34" y1="20" x2="66" y2="20"/>',
  hoodie: '<path d="M50 6 C40 6 34 14 34 20 L24 26 L18 54 L30 58 L32 44 L32 112 L68 112 L68 44 L70 58 L82 54 L76 26 L66 20 C66 14 60 6 50 6 Z M42 20 C42 12 58 12 58 20"/><path d="M40 88 L60 88 L60 106 L40 106 Z"/>',
  leggings: '<path d="M36 10 L64 10 L66 56 L62 112 L54 112 L51 60 L49 60 L46 112 L38 112 L34 56 Z"/><line x1="36" y1="30" x2="44" y2="108"/><line x1="64" y1="30" x2="56" y2="108"/>',
};

const ICONS = {
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  ask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
};

/* ================= boot ================= */
document.addEventListener('DOMContentLoaded', async () => {
  if (window.AOS) AOS.init({ duration: 700, easing: 'ease-out-cubic', once: true, disable: matchMedia('(prefers-reduced-motion: reduce)').matches });
  updateProfileBadge();
  await loadProducts();
  renderGarmentList();
  window.addEventListener('hashchange', routeFromHash);
  routeFromHash();
});

/* ================= API normalization ================= */
async function loadProducts() {
  // Tolerates both server shapes: /api/products (array) and /api/garments ({garments}).
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      const data = await res.json();
      STATE.products = Array.isArray(data) ? data : (data.garments || data.products || []);
    }
  } catch { /* offline: fall through */ }
  if (!STATE.products.length) {
    try {
      const res = await fetch('/api/garments');
      if (res.ok) {
        const data = await res.json();
        STATE.products = Array.isArray(data) ? data : (data.garments || []);
      }
    } catch { /* offline: fall through */ }
  }
  if (!STATE.products.length) STATE.products = DEMO_PRODUCTS;
  renderProducts();
}

function catalog() { return STATE.products.length ? STATE.products : DEMO_PRODUCTS; }
function priceOf(g) { return g.price ?? (parseInt(String(g.price_range || '').replace(/\D/g, ''), 10) || 0); }
function hay(g) { return JSON.stringify(g).toLowerCase(); }
function artFor(g) {
  if (g.art) return ART[g.art];
  const n = (g.name || '').toLowerCase();
  if (n.includes('hoodie')) return ART.hoodie;
  if (n.includes('legging')) return ART.leggings;
  if (g.category === 'top') return ART.shirt;
  if (g.category === 'bottom') return ART.pants;
  return ART.jacket;
}

/* ================= status lines (no alerts) ================= */
function statusLine(id, anchorSelector, role) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('p');
    el.id = id;
    el.setAttribute('role', role);
    el.style.cssText = 'font-size:13px;font-weight:600;margin:10px 0 0;color:var(--ink-2);';
    const anchor = document.querySelector(anchorSelector);
    if (anchor) anchor.insertAdjacentElement('afterend', el);
  }
  return el;
}
function studioStatus(msg) { const el = statusLine('studio-status', '#run-vto', 'status'); el.textContent = msg; }
function profileStatus(msg) { const el = statusLine('profile-status', '#profile-form', 'alert'); el.textContent = msg; }

/* ================= routing + focus management ================= */
function navigateTo(page) {
  let el = document.getElementById(page + '-page');
  if (!el) { page = 'home'; el = document.getElementById('home-page'); }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  STATE.page = page;
  history.replaceState(null, '', '#' + page);
  scrollTo(0, 0);
  const heading = el.querySelector('h1, h2');
  if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  if (page === 'shop') renderProducts();
  if (page === 'home') { renderProducts('featured-products', catalog().slice(0, 4)); if (window.AOS) AOS.refresh(); }
  if (!document.querySelector('.page.active')) document.getElementById('home-page').classList.add('active');
}

function routeFromHash() {
  const hash = location.hash.slice(1);
  const page = (!hash || hash === 'studio' || hash === 'about') ? 'home'
    : (document.getElementById(hash + '-page') ? hash : 'home');
  navigateTo(page);
  const anchor = hash && document.getElementById(hash);
  if (anchor && page !== hash) {
    setTimeout(() => anchor.scrollIntoView({ behavior: 'smooth' }), 80);
  }
}

/* ================= profile ================= */
function updateProfileBadge() {
  const badge = document.getElementById('profile-badge');
  const text = document.getElementById('badge-text');
  if (!badge || !text) return;
  if (STATE.profile) {
    const p = { seated: 'Seated', standing: 'Standing', mixed: 'Mixed' }[STATE.profile.posture] || 'Set';
    const d = { standard: 'Standard', limited: 'Limited', one_handed: '1-hand' }[STATE.profile.dexterity] || '';
    text.textContent = p + ' · ' + d;
    badge.classList.add('set');
  } else { text.textContent = 'Set profile'; badge.classList.remove('set'); }
}

function saveProfile() {
  const f = document.getElementById('profile-form');
  const posture = f.querySelector('input[name="posture"]:checked')?.value;
  const dexterity = f.querySelector('input[name="dexterity"]:checked')?.value;
  if (!posture || !dexterity) {
    profileStatus('Choose a posture and a dexterity level to continue.');
    (f.querySelector('input[name="posture"]:checked') ? f.querySelector('input[name="dexterity"]') : f.querySelector('input[name="posture"]'))?.focus();
    return;
  }
  STATE.profile = {
    posture, dexterity,
    sensory: [...f.querySelectorAll('input[name="sensory"]:checked')].map(i => i.value),
    mobility_aids: [...f.querySelectorAll('input[name="mobility_aids"]:checked')].map(i => i.value),
    fit_concerns: [...f.querySelectorAll('input[name="fit_concerns"]:checked')].map(i => i.value),
  };
  localStorage.setItem('aequidrape_profile', JSON.stringify(STATE.profile));
  updateProfileBadge();
  renderProducts();
  navigateTo('shop');
}

/* ================= studio ================= */
function selectPhoto(key, btn) {
  STATE.photo = { key, src: PHOTOS[key], custom: false };
  document.querySelectorAll('.thumb-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('stage-before').src = PHOTOS[key];
  document.getElementById('stage-after').src = PHOTOS[key];
  document.getElementById('consent-row').hidden = true;
  resetStage();
}

function uploadPhoto() { document.getElementById('photo-upload').click(); }

function onPhotoFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    STATE.photo = { key: 'custom', src: reader.result, custom: true };
    document.querySelectorAll('.thumb-btn').forEach(b => b.classList.remove('active'));
    input.closest('.thumb-col').querySelector('.upload').classList.add('active');
    document.getElementById('stage-before').src = STATE.photo.src;
    document.getElementById('stage-after').src = STATE.photo.src;
    document.getElementById('consent-row').hidden = false;
    resetStage();
  };
  reader.readAsDataURL(file);
}

function renderGarmentList() {
  const list = document.getElementById('garment-list');
  if (!list) return;
  list.innerHTML = catalog().slice(0, 4).map(g => `
    <button class="garment-opt ${STATE.garmentId === g.id ? 'active' : ''}" onclick="selectGarment('${g.id}', this)">
      <span><strong>${g.name}</strong><small>${g.closure_type} · ${g.stretch} stretch</small></span>
      <span class="price">$${priceOf(g)}</span>
    </button>`).join('');
}

function selectGarment(id, btn) {
  STATE.garmentId = id;
  document.querySelectorAll('.garment-opt').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const g = catalog().find(p => p.id === id);
  if (g && g.color) document.getElementById('drape-svg').setAttribute('fill', g.color);
  studioStatus('');
}

function resetStage() {
  ['layer-after', 'tag-after', 'cmp-line', 'cmp-knob', 'cmp-range'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
  const tb = document.getElementById('tag-before'); if (tb) tb.hidden = false;
  const mg = document.getElementById('mini-gauge'); if (mg) mg.hidden = true;
  const gc = document.getElementById('gauge-card'); if (gc) gc.hidden = true;
}

function setCmp(v) { document.getElementById('stage').style.setProperty('--pos', v + '%'); }

async function runTryOn() {
  if (STATE.photo.custom && !document.getElementById('consent').checked) {
    studioStatus('Confirm the consent box to use your own photo, or pick a demo photo.'); return;
  }
  if (!STATE.garmentId) { studioStatus('Choose a garment first.'); return; }
  const stage = document.getElementById('stage');
  stage.classList.add('loading');
  studioStatus('Contacting YouCam Clothes VTO...');
  let result = null;
  try {
    const res = await fetch('/api/try-on', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: STATE.photo.src, garment_id: STATE.garmentId }),
    });
    if (res.ok) result = await res.json();
  } catch { /* offline */ }
  stage.classList.remove('loading');
  ['layer-after', 'tag-after', 'cmp-line', 'cmp-knob', 'cmp-range'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = false; });
  setCmp(50);
  if (result && result.url) {
    setTryOnResult(result.url);
    document.getElementById('tag-after').textContent = result.status === 'live' ? 'YouCam live' : 'YouCam cached';
    studioStatus('Real render ready. Drag the slider to compare.');
  } else {
    document.getElementById('tag-after').textContent = 'Simulated';
    studioStatus('YouCam unavailable (' + ((result && result.error) || 'garment image missing') + '). Showing simulated drape.');
  }
  await evaluate();
}

/** YouCam integration point: call your /api/try-on, then setTryOnResult(url). */
function setTryOnResult(url) {
  document.getElementById('stage-after').src = url;
  document.getElementById('drape-svg').style.display = 'none';
}

/* ================= evaluation ================= */
async function evaluate() {
  const g = catalog().find(p => p.id === STATE.garmentId);
  let insight = null;
  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_profile: STATE.profile || { posture: 'seated', dexterity: 'limited', sensory: [], mobility_aids: ['wheelchair'], fit_concerns: [] },
        garment_id: STATE.garmentId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      insight = data.insight || data; // tolerates nested and flattened server shapes
    }
  } catch { /* offline: local rules below */ }
  if (!insight || !insight.compatibility) insight = localInsight(g);
  STATE.insight = insight;
  STATE.reviewMeta = insightRaw; // the full parsed response, before flattening
  renderReviewExtras();
  renderGauge(insight, g);
}

function localInsight(g) {
  if (!g) return { compatibility: [], risks: [], questions_for_seller: [], confidence: 'low', summary: 'No garment selected.' };
  const p = STATE.profile || { posture: 'seated', dexterity: 'limited', sensory: ['tag-free'], mobility_aids: ['wheelchair'], fit_concerns: ['back-coverage'] };
  const h = hay(g);
  const ok = [], warn = [], ask = [];
  if (p.dexterity !== 'standard' && /magnetic|hook|zipper/.test(g.closure_type)) ok.push(g.closure_type + ' closure supports easier dressing.');
  if (p.posture === 'seated' && g.back_rise === 'high') ok.push('High back rise supports seated coverage.');
  if (p.sensory.includes('tag-free') && h.includes('tag-free')) ok.push('Tag-free construction reduces irritation.');
  if (p.posture === 'seated' && g.back_rise !== 'high') warn.push('Back rise may sit low while seated.');
  if (p.mobility_aids.includes('prosthetic') && g.stretch === 'slight') warn.push('Low stretch may limit room around a brace or prosthetic.');
  if (p.fit_concerns.includes('pocket-access')) ask.push('Are pockets reachable from a seated position?');
  ask.push('What is the seated back length in centimetres?');
  const confidence = warn.length === 0 && ok.length >= 2 ? 'high' : warn.length > ok.length ? 'low' : 'moderate';
  return { compatibility: ok, risks: warn, questions_for_seller: ask, confidence, summary: `${g.name}: ${ok.join(' ')} ${warn.join(' ')} Confidence ${confidence}.` };
}

function fillList(id, items, kind) {
  const el = document.getElementById(id);
  if (!el) return;
  const title = el.querySelector('h4');
  el.innerHTML = (title ? title.outerHTML : '') +
    (items && items.length ? items.map(t => `<li>${ICONS[kind]}<span>${t}</span></li>`).join('') : '<li><span>Nothing flagged.</span></li>');
}

function renderGauge(ins, g) {
  const fill = { high: 'high', moderate: 'moderate', low: 'low' }[ins.confidence] || 'moderate';
  const mg = document.getElementById('mini-gauge');
  if (mg) {
    mg.hidden = false;
    document.getElementById('mini-conf-text').textContent = ins.confidence;
    document.getElementById('mini-conf-fill').className = 'fill ' + fill;
  }
  const card = document.getElementById('gauge-card');
  if (!card) return;
  card.hidden = false;
  const gn = document.getElementById('gauge-garment-name'); if (gn) gn.textContent = g ? g.name : '';
  fillList('gauge-ok', ins.compatibility, 'ok');
  fillList('gauge-warn', ins.risks, 'warn');
  fillList('gauge-ask', ins.questions_for_seller, 'ask');
  document.getElementById('gauge-fill').className = 'fill ' + fill;
  document.getElementById('gauge-conf').textContent = ins.confidence;
}

function setAudioLabels(t) { const b = document.getElementById('audio-btn'); if (b) b.lastChild.textContent = ' ' + t; }
function speakSummary() {
  if (!STATE.insight) return;
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); setAudioLabels('Listen'); return; }
  const u = new SpeechSynthesisUtterance(STATE.insight.summary);
  u.onend = () => setAudioLabels('Listen');
  speechSynthesis.speak(u);
  setAudioLabels('Stop');
}

/* ================= review extras: email, report, copy ================= */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function md2html(md) {
  const lines = esc(md).split('\n');
  const out = []; let inList = false;
  for (const line of lines) {
    if (/^\s*[-*] /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + line.replace(/^\s*[-*] /, '') + '</li>');
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      const h = line.match(/^#{1,3} (.*)$/);
      if (h) out.push('<h3>' + h[1] + '</h3>');
      else if (line.trim()) out.push('<p>' + line + '</p>');
    }
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

function buildEmailTemplate(g, ins) {
  return [
    'Subject: Fit and access questions before ordering - ' + g.name,
    '',
    'Hello,',
    '',
    'I am considering this garment and rely on the following for dressing and comfort. Could you confirm:',
    ...ins.questions_for_seller.map(q => '- ' + q),
    '',
    'Listed details I depend on (please correct if wrong):',
    '- Closure: ' + g.closure_type,
    '- Back rise: ' + g.back_rise,
    '- Stretch: ' + g.stretch,
    '',
    'Thank you.',
  ].join('\n');
}

function defaultReport(g, ins) {
  return [
    '# Aequidrape assessment - ' + g.name,
    '',
    '## Works for you',
    ...(ins.compatibility.length ? ins.compatibility.map(t => '- ' + t) : ['- Nothing strong from available data.']),
    '',
    '## Worth checking',
    ...(ins.risks.length ? ins.risks.map(t => '- ' + t) : ['- Nothing flagged.']),
    '',
    '## Ask the seller',
    ...ins.questions_for_seller.map(t => '- ' + t),
    '',
    'Confidence: ' + ins.confidence + '. This is decision support, not a fit guarantee.',
  ].join('\n');
}

function renderReviewExtras() {
  const g = STATE.current || catalog().find(p => p.id === STATE.garmentId);
  const ins = STATE.insight;
  const box = document.getElementById('review-extras');
  if (!g || !ins || !box) return;
  const meta = STATE.reviewMeta || {};
  STATE.emailTemplate = meta.seller_email_template || buildEmailTemplate(g, ins);
  STATE.reportMd = meta.markdown_summary || defaultReport(g, ins);
  document.getElementById('report-body').innerHTML = md2html(STATE.reportMd);
  box.hidden = false;
}

async function copyText(text, msg) {
  const status = document.getElementById('extras-status');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'absolute'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  status.textContent = msg;
  setTimeout(() => { if (status.textContent === msg) status.textContent = ''; }, 2500);
}

function copySellerEmail() { if (STATE.emailTemplate) copyText(STATE.emailTemplate, 'Seller email copied. Paste it into your message to the retailer.'); }
function copyReport() { if (STATE.reportMd) copyText(STATE.reportMd, 'Full report copied as markdown.'); }
/* ================= products ================= */
function compat(g) {
  if (!STATE.profile) return null;
  const p = STATE.profile; let m = 0, r = 0;
  if (p.dexterity !== 'standard' && /magnetic|hook|zipper/.test(g.closure_type)) m++;
  if (p.dexterity !== 'standard' && /button/.test(g.closure_type)) r++;
  if (p.posture === 'seated' && g.back_rise === 'high') m++;
  if (p.posture === 'seated' && g.back_rise === 'low') r++;
  if (p.mobility_aids.length && /high|maximum/.test(g.stretch)) m++;
  return r > m ? 'low' : m >= 2 ? 'high' : 'moderate';
}

function renderProducts(containerId = 'products', list = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let items = list || [...catalog()];
  if (!list && STATE.filters.size) {
    items = items.filter(g => {
      const h = hay(g);
      return [...STATE.filters].every(f => h.includes(f.replace('-loop', '').replace('zipper', 'zipper')) || h.includes(f));
    });
  }
  const sort = document.getElementById('sort-select')?.value;
  if (sort === 'price-low') items.sort((a, b) => priceOf(a) - priceOf(b));
  if (sort === 'price-high') items.sort((a, b) => priceOf(b) - priceOf(a));
  container.innerHTML = items.map(g => {
    const c = compat(g);
    return `
    <article class="p-card">
      <div class="p-media">
        <span class="flag">${g.closure_type}</span>
        <svg class="art" viewBox="0 0 100 120" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${artFor(g)}</svg>
        <button class="quick" onclick="showProduct('${g.id}')">View garment</button>
      </div>
      <div class="p-body">
        <h3>${g.name}</h3>
        <p class="meta">${g.fabric} · ${g.stretch} stretch</p>
        <div class="row">
          <span class="price">$${priceOf(g)}</span>
          ${c ? `<span class="compat ${c}"><i></i>${{ high: 'Likely fit', moderate: 'Check details', low: 'Ask seller' }[c]}</span>` : ''}
        </div>
      </div>
    </article>`;
  }).join('') || '<p style="color:var(--ink-2)">No garments match the selected filters.</p>';
}

function toggleFilter(btn) {
  const f = btn.dataset.filter;
  STATE.filters.has(f) ? STATE.filters.delete(f) : STATE.filters.add(f);
  btn.classList.toggle('active');
  renderProducts();
}

function sortProducts() { renderProducts(); }

/* ================= product detail ================= */
function showProduct(id) {
  const g = catalog().find(p => p.id === id);
  if (!g) return;
  STATE.current = g;
  document.getElementById('breadcrumb-text').textContent = g.name;
  document.getElementById('product-name').textContent = g.name;
  document.getElementById('product-price').textContent = '$' + priceOf(g);
  document.getElementById('product-description').textContent = g.description || '';
  document.getElementById('detail-art').innerHTML = `<svg viewBox="0 0 100 120" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${artFor(g)}</svg>`;
  const specs = [g.closure_type, g.back_rise, g.stretch, g.seams, g.pocket_access];
  ['spec-closure', 'spec-back-rise', 'spec-stretch', 'spec-seams', 'spec-pockets'].forEach((sid, i) => {
    const el = document.getElementById(sid); if (el) el.textContent = specs[i] || '—';
  });
  const ins = localInsight(g);
  STATE.insight = ins;
  STATE.reviewMeta = null;
  renderReviewExtras();
  fillList('d-ok', ins.compatibility, 'ok');
  fillList('d-warn', ins.risks, 'warn');
  fillList('d-ask', ins.questions_for_seller, 'ask');
  document.getElementById('d-fill').className = 'fill ' + ins.confidence;
  document.getElementById('d-conf').textContent = ins.confidence;
  document.getElementById('questions-list').innerHTML = ins.questions_for_seller.map(q => `<label class="q-item"><input type="checkbox" /><span>${q}</span></label>`).join('');
  navigateTo('product');
}

function tryOnThis() {
  if (STATE.current) selectGarment(STATE.current.id, null);
  navigateTo('home');
  setTimeout(() => document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' }), 60);
}

/* ================= tabs + gauge toggle (event-safe) ================= */
function toggleGaugeDetails(e) {
  const body = document.getElementById('gauge-details');
  if (!body) return;
  const open = body.hidden;
  body.hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', String(open));
}

function switchTab(name, e) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
  document.getElementById(name)?.classList.add('active');
  e.currentTarget.classList.add('active');
  e.currentTarget.setAttribute('aria-selected', 'true');
}

/* ================= editorial shortcuts ================= */
function applyNeed(kind) {
  if (!STATE.profile) STATE.profile = { posture: 'seated', dexterity: 'standard', sensory: [], mobility_aids: [], fit_concerns: [] };
  if (kind === 'seated') STATE.profile.posture = 'seated';
  if (kind === 'one_handed') STATE.profile.dexterity = 'one_handed';
  if (kind === 'sensory') STATE.profile.sensory = ['tag-free'];
  if (kind === 'prosthetic') STATE.profile.mobility_aids = ['prosthetic'];
  updateProfileBadge();
  navigateTo('shop');
}

/* ================= demo contrast (Decision B) ================= */
const DEMO_PROFILES = {
  A: { label: 'Profile A', who: 'Seated · limited dexterity · wheelchair', posture: 'seated', dexterity: 'limited', sensory: ['tag-free'], mobility_aids: ['wheelchair'], fit_concerns: ['back-coverage'] },
  B: { label: 'Profile B', who: 'Standing · standard dexterity', posture: 'standing', dexterity: 'standard', sensory: [], mobility_aids: [], fit_concerns: [] },
};

function runDemoContrast() {
  const g = catalog().find(p => p.id === 'adaptive-jacket-001') || catalog()[0];
  const saved = STATE.profile;
  const html = ['A', 'B'].map(k => {
    const { label, who, ...prof } = DEMO_PROFILES[k];
    STATE.profile = prof;
    const ins = localInsight(g);
    const fill = { high: 'high', moderate: 'moderate', low: 'low' }[ins.confidence] || 'moderate';
    const rows = [
      ...ins.compatibility.slice(0, 2).map(t => '<li>+ ' + t + '</li>'),
      ...ins.risks.slice(0, 2).map(t => '<li>- ' + t + '</li>'),
    ].join('');
    return `
    <div class="contrast-card">
      <h4>${label} — <span style="text-transform:capitalize">${ins.confidence}</span> confidence</h4>
      <p class="who">${who} vs ${g.name}</p>
      <div class="mini-gauge" style="margin:0">
        <div class="bar"><div class="fill ${fill}"></div></div>
      </div>
      <ul>${rows || '<li>No strong signals from available data.</li>'}</ul>
    </div>`;
  }).join('');
  STATE.profile = saved;
  const panel = document.getElementById('contrast-panel');
  panel.innerHTML = html;
  panel.hidden = false;
}

/* ================= adaptation prompts ================= */
function parseAdaptationClient(prompt) {
  const p = prompt.toLowerCase();
  const mods = []; const patch = {};
  const side = (p.match(/\b(left|right|both)\b/) || [])[1] || 'left';
  if (/zip/.test(p)) { mods.push({ type: 'side-zipper', side, label: 'Full ' + side + '-side zipper' }); patch.closure_type = 'side zippers'; }
  if (/magnet/.test(p)) { mods.push({ type: 'magnetic', label: 'Magnetic closure' }); patch.closure_type = 'magnetic'; }
  if (/velcro|hook|loop/.test(p)) { mods.push({ type: 'hook-loop', label: 'Hook-and-loop closure' }); patch.closure_type = 'hook-and-loop'; }
  if (/tag/.test(p)) { mods.push({ type: 'tagless', label: 'Tagless / printed label' }); patch.tags = ['tag-free']; }
  if (/seam/.test(p)) { mods.push({ type: 'flat-seams', label: 'Flat, repositioned seams' }); patch.seams = 'Flat, repositioned'; }
  if (/(long|raise|extend|high).*(back|rise|coverage)/.test(p)) { mods.push({ type: 'back-rise', label: 'Extended back rise' }); patch.back_rise = 'high'; }
  if (/loose|relax|wide|room/.test(p)) { mods.push({ type: 'ease', label: 'Added ease, lower compression' }); patch.stretch = 'high'; }
  if (/pocket/.test(p)) { mods.push({ type: 'pocket', side, label: 'Relocated ' + side + ' pocket' }); patch.pocket_access = 'Seated-reachable'; }
  if (/one.?hand/.test(p)) { mods.push({ type: 'one-hand', label: 'One-handed pulls' }); patch.closure_type = patch.closure_type || 'magnetic'; }
  return { mods, patch };
}

function drawOverlays(mods) {
  const svg = document.querySelector('#detail-art svg');
  if (!svg) return;
  svg.querySelectorAll('.mod-overlay').forEach(n => n.remove());
  const NS = 'http://www.w3.org/2000/svg';
  for (const m of mods) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'mod-overlay');
    g.setAttribute('stroke', '#c97a3c'); g.setAttribute('stroke-width', '2.5');
    g.setAttribute('fill', 'none'); g.setAttribute('stroke-dasharray', '5 4');
    if (m.type === 'side-zipper') {
      const l = document.createElementNS(NS, 'line');
      const x = m.side === 'right' ? 68 : 32;
      l.setAttribute('x1', x); l.setAttribute('y1', 24); l.setAttribute('x2', x); l.setAttribute('y2', 110);
      g.appendChild(l);
    } else if (m.type === 'magnetic' || m.type === 'one-hand') {
      for (let y = 30; y <= 100; y += 14) {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', 50); c.setAttribute('cy', y); c.setAttribute('r', 2.6); c.setAttribute('fill', '#c97a3c');
        g.appendChild(c);
      }
    } else if (m.type === 'hook-loop') {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', 44); r.setAttribute('y', 40); r.setAttribute('width', 12); r.setAttribute('height', 40);
      g.appendChild(r);
    } else if (m.type === 'pocket') {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', m.side === 'right' ? 60 : 34); r.setAttribute('y', 70);
      r.setAttribute('width', 10); r.setAttribute('height', 12);
      g.appendChild(r);
    } else if (m.type === 'back-rise') {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M30 112 L70 112 L70 120 L30 120 Z');
      g.appendChild(p);
    } else if (m.type === 'tagless') {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', 44); l.setAttribute('y1', 14); l.setAttribute('x2', 56); l.setAttribute('y2', 20);
      g.appendChild(l);
    }
    svg.appendChild(g);
  }
}

async function applyAdaptation() {
  const prompt = document.getElementById('adapt-prompt').value.trim();
  const status = document.getElementById('adapt-status');
  if (!prompt || !STATE.current) return;
  status.textContent = 'Parsing adaptation...';
  let data = null;
  try {
    const res = await fetch('/api/modify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, garment_id: STATE.current.id }) });
    if (res.ok) data = await res.json();
  } catch { /* offline */ }
  if (!data || !data.mods) data = { ...parseAdaptationClient(prompt), source: 'rules' };
  if (!data.mods.length) { status.textContent = 'No recognized modification. Try: zipper, magnetic, velcro, tag, seams, pocket, looser, longer back.'; return; }
  const merged = { ...STATE.current, ...data.patch };
  document.getElementById('adapt-mods').innerHTML =
    data.mods.map(m => `<li><strong>${m.label}</strong><span>${m.type}</span></li>`).join('');
  drawOverlays(data.mods);
  const ins = localInsight(merged);
  STATE.insight = ins; STATE.reviewMeta = null;
  renderGauge(ins, merged); renderReviewExtras();
  status.textContent = (data.source === 'local-llm' ? 'Local model' : 'Spec engine') + ` applied ${data.mods.length} modification(s). Gauge re-scored.`;
}