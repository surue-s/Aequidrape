/**
 * Aequidrape — production frontend
 * Routing, state, VTO studio, rendering.
 * YouCam integration point: setTryOnResult(url)
 */

const STATE = {
  page: 'home',
  profile: JSON.parse(localStorage.getItem('aequidrape_profile') || 'null'),
  products: [],
  photo: { key: 'standing', src: '/demo-images/01-standing-original.jpg', custom: false },
  garmentId: null,
  insight: null,
  filters: new Set(),
};

const PHOTOS = {
  standing: '/demo-images/01-standing-original.jpg',
  seated: '/demo-images/02-seated-original.jpg',
  wheelchair: '/demo-images/03-wheelchair-original.jpg',
  prosthetic: '/demo-images/04-prosthetic-original.jpg',
};

const DEMO_PRODUCTS = [
  { id: 'adaptive-jacket-001', name: 'Magnetic Front Jacket', category: 'outerwear', art: 'jacket', color: 'rgba(201,122,60,0.55)', closure_type: 'magnetic', fabric: 'Technical cotton blend', stretch: 'moderate', tags: ['magnetic', 'tag-free'], seams: 'Flat back seams', back_rise: 'high', sleeve_adjustable: true, pocket_access: 'Side seams, seated-reachable', price: 140, description: 'Magnetic closure jacket with high back rise, built for seated comfort and one-handed dressing.' },
  { id: 'seated-pants-001', name: 'Seated Cargo Pant', category: 'bottom', art: 'pants', color: 'rgba(74,144,164,0.5)', closure_type: 'hook-and-loop', fabric: 'Stretch twill', stretch: 'high', tags: ['hook-and-loop', 'high-stretch'], seams: 'Minimal inner-thigh', back_rise: 'high', sleeve_adjustable: false, pocket_access: 'Hip pockets, seated-reachable', price: 110, description: 'High back rise cargo pant with hook-and-loop closures and a reinforced gusset.' },
  { id: 'onehanded-shirt-001', name: 'One-Handed Shirt', category: 'top', art: 'shirt', color: 'rgba(139,163,157,0.55)', closure_type: 'magnetic', fabric: 'Soft cotton jersey', stretch: 'slight', tags: ['magnetic', 'tag-free'], seams: 'Soft flat seams', back_rise: 'medium', sleeve_adjustable: true, pocket_access: 'Chest pocket, magnetic flap', price: 85, description: 'Magnetic button-front shirt with a soft collar, designed for limited dexterity.' },
  { id: 'accessible-hoodie-001', name: 'No-Pull Hoodie', category: 'outerwear', art: 'hoodie', color: 'rgba(87,83,75,0.45)', closure_type: 'magnetic', fabric: 'Organic cotton fleece', stretch: 'high', tags: ['magnetic', 'high-stretch', 'tag-free'], seams: 'Flat throughout', back_rise: 'medium', sleeve_adjustable: true, pocket_access: 'Deep kangaroo', price: 130, description: 'Full-zip magnetic hoodie. No drawstrings, roomy sleeves, high stretch.' },
  { id: 'adaptive-leggings-001', name: 'Side-Zip Legging', category: 'bottom', art: 'leggings', color: 'rgba(217,100,89,0.4)', closure_type: 'elastic + side zippers', fabric: 'High-stretch nylon', stretch: 'maximum', tags: ['zipper', 'high-stretch'], seams: 'Seam-free thigh option', back_rise: 'high', sleeve_adjustable: false, pocket_access: 'Side medical-device pocket', price: 95, description: 'Maximum-stretch legging with removable side zippers for braces and prosthetics.' },
];

const ART = {
  jacket: '<path d="M50 8 L36 14 L22 24 L16 54 L28 58 L30 42 L30 112 L70 112 L70 42 L72 58 L84 54 L78 24 L64 14 Z M50 8 L44 16 L50 22 L56 16 Z"/><line x1="50" y1="22" x2="50" y2="112"/>',
  shirt: '<path d="M50 10 L38 14 L26 22 L22 44 L32 48 L34 36 L34 108 L66 108 L66 36 L68 48 L78 44 L74 22 L62 14 Z M38 14 L50 30 L62 14"/>',
  pants: '<path d="M34 10 L66 10 L70 60 L68 112 L56 112 L52 62 L48 62 L44 112 L32 112 L30 60 Z"/><line x1="34" y1="20" x2="66" y2="20"/>',
  hoodie: '<path d="M50 6 C40 6 34 14 34 20 L24 26 L18 54 L30 58 L32 44 L32 112 L68 112 L68 44 L70 58 L82 54 L76 26 L66 20 C66 14 60 6 50 6 Z M42 20 C42 12 58 12 58 20"/><path d="M40 88 L60 88 L60 106 L40 106 Z"/>',
  leggings: '<path d="M36 10 L64 10 L66 56 L62 112 L54 112 L51 60 L49 60 L46 112 L38 112 L34 56 Z"/><line x1="36" y1="30" x2="44" y2="108"/><line x1="64" y1="30" x2="56" y2="108"/>',
};

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.AOS) AOS.init({ duration: 700, easing: 'ease-out-cubic', once: true, disable: reduced });
  loadProducts();
  renderGarmentList();
  updateProfileBadge();
  window.addEventListener('hashchange', () => navigateTo(location.hash.slice(1) || 'home'));
  navigateTo(location.hash.slice(1) || 'home');
});

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    STATE.products = res.ok ? await res.json() : DEMO_PRODUCTS;
  } catch { STATE.products = DEMO_PRODUCTS; }
  renderProducts();
}

/* ---------- routing ---------- */
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(page + '-page');
  if (!el) return;
  el.classList.add('active');
  STATE.page = page;
  history.replaceState(null, '', '#' + page);
  scrollTo(0, 0);
  if (page === 'shop') renderProducts();
  if (page === 'home') renderProducts('featured-products', STATE.products.slice(0, 4));
  if (window.AOS) AOS.refresh();
}

/* ---------- profile ---------- */
function updateProfileBadge() {
  const badge = document.getElementById('profile-badge');
  const text = document.getElementById('badge-text');
  if (STATE.profile) {
    const p = { seated: 'Seated', standing: 'Standing', mixed: 'Mixed' }[STATE.profile.posture] || 'Set';
    const d = { standard: 'Standard', limited: 'Limited', one_handed: '1-hand' }[STATE.profile.dexterity] || '';
    text.textContent = p + ' · ' + d;
    badge.classList.add('set');
  } else { text.textContent = 'Set profile'; badge.classList.remove('set'); }
}

function saveProfile() {
  const f = document.getElementById('profile-form');
  const profile = {
    posture: f.querySelector('input[name="posture"]:checked')?.value,
    dexterity: f.querySelector('input[name="dexterity"]:checked')?.value,
    sensory: [...f.querySelectorAll('input[name="sensory"]:checked')].map(i => i.value),
    mobility_aids: [...f.querySelectorAll('input[name="mobility_aids"]:checked')].map(i => i.value),
    fit_concerns: [...f.querySelectorAll('input[name="fit_concerns"]:checked')].map(i => i.value),
  };
  if (!profile.posture || !profile.dexterity) { alert('Choose a posture and a dexterity level.'); return; }
  STATE.profile = profile;
  localStorage.setItem('aequidrape_profile', JSON.stringify(profile));
  updateProfileBadge();
  renderProducts();
  navigateTo('shop');
}

/* ---------- studio ---------- */
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
  const file = input.files[0];
  if (!file) return;
  STATE.photo = { key: 'custom', src: URL.createObjectURL(file), custom: true };
  document.querySelectorAll('.thumb-btn').forEach(b => b.classList.remove('active'));
  input.closest('.thumb-col').querySelector('.upload').classList.add('active');
  document.getElementById('stage-before').src = STATE.photo.src;
  document.getElementById('stage-after').src = STATE.photo.src;
  document.getElementById('consent-row').hidden = false;
  resetStage();
}

function renderGarmentList() {
  const list = document.getElementById('garment-list');
  list.innerHTML = (STATE.products.length ? STATE.products : DEMO_PRODUCTS).slice(0, 4).map(g => `
    <button class="garment-opt ${STATE.garmentId === g.id ? 'active' : ''}" onclick="selectGarment('${g.id}', this)">
      <span><strong>${g.name}</strong><small>${g.closure_type} · ${g.stretch} stretch</small></span>
      <span class="price">$${g.price}</span>
    </button>`).join('');
}

function selectGarment(id, btn) {
  STATE.garmentId = id;
  document.querySelectorAll('.garment-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const g = (STATE.products.length ? STATE.products : DEMO_PRODUCTS).find(p => p.id === id);
  if (g) document.getElementById('drape-svg').setAttribute('fill', g.color || 'rgba(201,122,60,0.55)');
}

function resetStage() {
  ['layer-after', 'tag-after', 'cmp-line', 'cmp-knob', 'cmp-range'].forEach(id => document.getElementById(id).hidden = true);
  document.getElementById('tag-before').hidden = false;
  document.getElementById('mini-gauge').hidden = true;
  document.getElementById('gauge-card').hidden = true;
}

function setCmp(v) { document.getElementById('stage').style.setProperty('--pos', v + '%'); }

function runTryOn() {
  if (STATE.photo.custom && !document.getElementById('consent').checked) {
    alert('Please confirm the consent box to use your own photo.'); return;
  }
  if (!STATE.garmentId) { alert('Choose a garment first.'); return; }
  const stage = document.getElementById('stage');
  stage.classList.add('loading');
  setTimeout(async () => {
    stage.classList.remove('loading');
    ['layer-after', 'tag-after', 'cmp-line', 'cmp-knob', 'cmp-range'].forEach(id => document.getElementById(id).hidden = false);
    document.getElementById('tag-before').hidden = false;
    setCmp(50);
    await evaluate();
  }, 900);
}

/** YouCam integration point: call your /api/try-on here, then
 *  setTryOnResult(url) to replace the simulated drape with the real render. */
function setTryOnResult(url) {
  const after = document.getElementById('stage-after');
  after.src = url;
  document.getElementById('drape-svg').style.display = 'none';
}

async function evaluate() {
  const garment = (STATE.products.length ? STATE.products : DEMO_PRODUCTS).find(p => p.id === STATE.garmentId);
  let insight = null;
  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_profile: STATE.profile || { posture: 'seated', dexterity: 'limited', sensory: [], mobility_aids: ['wheelchair'], fit_concerns: [] }, garment_id: STATE.garmentId }),
    });
    if (res.ok) insight = await res.json();
  } catch { /* fall through to local */ }
  if (!insight) insight = localInsight(garment);
  STATE.insight = insight;
  renderGauge(insight, garment);
}

function localInsight(g) {
  const p = STATE.profile || { posture: 'seated', dexterity: 'limited', sensory: ['tag-free'], mobility_aids: ['wheelchair'], fit_concerns: ['back-coverage'] };
  const ok = [], warn = [], ask = [];
  if ((p.dexterity !== 'standard') && /magnetic|hook/.test(g.closure_type)) ok.push(g.closure_type + ' closure supports easier dressing.');
  if (p.posture === 'seated' && g.back_rise === 'high') ok.push('High back rise supports seated coverage.');
  if (p.sensory.includes('tag-free') && g.tags.includes('tag-free')) ok.push('Tag-free neckline reduces irritation.');
  if (p.posture === 'seated' && g.back_rise !== 'high') warn.push('Back rise may sit low while seated.');
  if ((p.mobility_aids.includes('prosthetic')) && g.stretch === 'slight') warn.push('Low stretch may limit room around a brace or prosthetic.');
  if (p.fit_concerns.includes('pocket-access')) ask.push('Are pockets reachable from a seated position?');
  ask.push('What is the seated back length in centimetres?');
  const conf = warn.length === 0 && ok.length >= 2 ? 'high' : warn.length > ok.length ? 'low' : 'moderate';
  return { compatibility: ok, risks: warn, questions_for_seller: ask, confidence: conf, summary: `${g.name}: ${ok.length ? ok.join(' ') : 'no strong matches.'} ${warn.join(' ')} Confidence ${conf}.` };
}

function renderGauge(ins, g) {
  const fill = { high: 'high', moderate: 'moderate', low: 'low' }[ins.confidence];
  document.getElementById('mini-gauge').hidden = false;
  document.getElementById('mini-conf-text').textContent = ins.confidence;
  document.getElementById('mini-conf-fill').className = 'fill ' + fill;

  const card = document.getElementById('gauge-card');
  card.hidden = false;
  document.getElementById('gauge-garment-name').textContent = g ? g.name : '';
  fillList('gauge-ok', ins.compatibility, 'ok');
  fillList('gauge-warn', ins.risks, 'warn');
  fillList('gauge-ask', ins.questions_for_seller, 'ask');
  document.getElementById('gauge-fill').className = 'fill ' + fill;
  document.getElementById('gauge-conf').textContent = ins.confidence;
}

const ICONS = {
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  ask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
};

function fillList(id, items, kind) {
  const el = document.getElementById(id);
  el.innerHTML = '<h4>' + el.querySelector('h4').textContent + '</h4>' +
    (items.length ? items.map(t => `<li>${ICONS[kind]}<span>${t}</span></li>`).join('') : '<li><span>Nothing flagged.</span></li>');
}

function speakSummary() {
  if (!STATE.insight) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(STATE.insight.summary));
}

/* ---------- products ---------- */
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
  let items = list || [...(STATE.products.length ? STATE.products : DEMO_PRODUCTS)];
  if (!list && STATE.filters.size) items = items.filter(g => [...STATE.filters].every(f => g.tags.includes(f) || g.closure_type.includes(f.replace('zipper', 'zipper'))));
  const sort = document.getElementById('sort-select')?.value;
  if (sort === 'price-low') items.sort((a, b) => a.price - b.price);
  if (sort === 'price-high') items.sort((a, b) => b.price - a.price);
  container.innerHTML = items.map(g => {
    const c = compat(g);
    return `
    <article class="p-card">
      <div class="p-media">
        <span class="flag">${g.closure_type}</span>
        <svg class="art" viewBox="0 0 100 120" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${ART[g.art] || ART.jacket}</svg>
        <button class="quick" onclick="showProduct('${g.id}')">View garment</button>
      </div>
      <div class="p-body">
        <h3>${g.name}</h3>
        <p class="meta">${g.fabric} · ${g.stretch} stretch</p>
        <div class="row">
          <span class="price">$${g.price}</span>
          ${c ? `<span class="compat ${c}"><i></i>${{ high: 'Likely fit', moderate: 'Check details', low: 'Ask seller' }[c]}</span>` : ''}
        </div>
      </div>
    </article>`;
  }).join('');
}

function toggleFilter(btn) {
  const f = btn.dataset.filter;
  STATE.filters.has(f) ? STATE.filters.delete(f) : STATE.filters.add(f);
  btn.classList.toggle('active');
  renderProducts();
}

function sortProducts() { renderProducts(); }

/* ---------- detail ---------- */
function showProduct(id) {
  const g = (STATE.products.length ? STATE.products : DEMO_PRODUCTS).find(p => p.id === id);
  if (!g) return;
  STATE.current = g;
  document.getElementById('breadcrumb-text').textContent = g.name;
  document.getElementById('product-name').textContent = g.name;
  document.getElementById('product-price').textContent = '$' + g.price;
  document.getElementById('product-description').textContent = g.description;
  document.getElementById('detail-art').innerHTML = `<svg viewBox="0 0 100 120" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${ART[g.art] || ART.jacket}</svg>`;
  ['spec-closure', 'spec-back-rise', 'spec-stretch', 'spec-seams', 'spec-pockets'].forEach((sid, i) => {
    document.getElementById(sid).textContent = [g.closure_type, g.back_rise, g.stretch, g.seams, g.pocket_access][i];
  });
  const ins = localInsight(g);
  fillList('d-ok', ins.compatibility, 'ok');
  fillList('d-warn', ins.risks, 'warn');
  fillList('d-ask', ins.questions_for_seller, 'ask');
  document.getElementById('d-fill').className = 'fill ' + ins.confidence;
  document.getElementById('d-conf').textContent = ins.confidence;
  document.getElementById('questions-list').innerHTML = ins.questions_for_seller.map(q => `<label class="q-item"><input type="checkbox" /><span>${q}</span></label>`).join('');
  navigateTo('product');
}

function tryOnThis() {
  if (STATE.current) selectGarment(STATE.current.id, document.querySelector('.garment-opt') || null);
  navigateTo('home');
  setTimeout(() => document.getElementById('studio').scrollIntoView({ behavior: 'smooth' }), 60);
}

function toggleGaugeDetails(e) {
  const body = document.getElementById('gauge-details');
  const open = body.hidden;
  body.hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', String(open));
}

function switchTab(name, e) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
  document.getElementById(name).classList.add('active');
  e.currentTarget.classList.add('active');
  e.currentTarget.setAttribute('aria-selected', 'true');
}

/* ---------- editorial shortcuts ---------- */
function applyNeed(kind) {
  if (!STATE.profile) STATE.profile = { posture: 'seated', dexterity: 'standard', sensory: [], mobility_aids: [], fit_concerns: [] };
  if (kind === 'seated') STATE.profile.posture = 'seated';
  if (kind === 'one_handed') STATE.profile.dexterity = 'one_handed';
  if (kind === 'sensory') STATE.profile.sensory = ['tag-free'];
  if (kind === 'prosthetic') STATE.profile.mobility_aids = ['prosthetic'];
  updateProfileBadge();
  navigateTo('shop');
}