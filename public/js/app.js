/* Aequidrape — single source of truth for frontend logic */


const STATE = {
  page: 'home',
  profile: JSON.parse(localStorage.getItem('aequidrape_profile') || 'null'),
  cart: JSON.parse(localStorage.getItem('aequidrape_cart') || '[]'), // NEW: Cart state
  products: [],
  garmentId: null,
  current: null,
  insight: null,
  filters: new Set(),
  photo: { key: 'standing', src: '/demo-images/01-standing-original.jpg', custom: false, base64: null },
  garment: { base64: null, modifiedUrl: null, custom: false },
};

const PHOTOS = {
  standing: '/demo-images/01-standing-original.jpg',
  seated: '/demo-images/02-seated-original.jpg',
  wheelchair: '/demo-images/03-wheelchair-original.jpg',
  prosthetic: '/demo-images/04-prosthetic-original.jpg',
};

const DEX_MAP = ['standard', 'limited', 'one_handed'];
const DEX_LABELS = ['Full use of both hands', 'Limited grip or strength', 'One hand available'];


async function resizeAndCompress(file, maxSize = 1024) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (h / w) * maxSize; w = maxSize; }
          else { w = (w / h) * maxSize; h = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  if (window.AOS) AOS.init({ duration: 700, once: true, disable: matchMedia('(prefers-reduced-motion: reduce)').matches });
  updateProfileBadge();
  await loadProducts();
  renderGarmentList();
  
  // NEW: Knob drag listeners for compare slider
  const knob = document.getElementById('cmp-knob');
  const range = document.getElementById('cmp-range');
  const stage = document.getElementById('stage');
  if (knob && range && stage) {
    let isDragging = false;
    const startDrag = (e) => { isDragging = true; e.preventDefault(); };
    const endDrag = () => isDragging = false;
    const moveDrag = (e) => {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const rect = stage.getBoundingClientRect();
      let pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      range.value = pct;
      setCmp(pct);
    };
    knob.addEventListener('mousedown', startDrag);
    knob.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('touchmove', moveDrag, { passive: false });
  }

  window.addEventListener('hashchange', () => navigateTo(location.hash.slice(1) || 'home'));
  navigateTo(location.hash.slice(1) || 'home');
});

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) STATE.products = await res.json();
  } catch {}
  if (!STATE.products.length) STATE.products = [
    { id: 'adaptive-jacket-001', name: 'Jacket', closure_type: 'zipper', stretch: 'moderate', back_rise: 'medium', seams: 'Standard', pocket_access: 'Side pockets', price: 140, description: 'Everyday zip jacket.', image_path: 'garments/jacket.jpg' },
  ];
  renderProducts();
}

function catalog() { return STATE.products; }
function priceOf(g) { return g.price ?? 0; }

/* ---------- cart ---------- */
function addToCart(id) {
  if (!STATE.cart.includes(id)) {
    STATE.cart.push(id);
    localStorage.setItem('aequidrape_cart', JSON.stringify(STATE.cart));
    updateCartUI();
  }
}

function updateCartUI() {
  renderProducts();
  if (STATE.page === 'home') renderProducts('featured-products', catalog().slice(0, 4));
  renderGarmentList();
  const cartBtn = document.getElementById('add-to-cart-btn');
  if (cartBtn && STATE.current) {
    cartBtn.textContent = STATE.cart.includes(STATE.current.id) ? 'In bag' : 'Add to try-on bag';
    cartBtn.disabled = STATE.cart.includes(STATE.current.id);
  }
}

/* ---------- routing ---------- */
function navigateTo(page) {
  let el = document.getElementById(page + '-page');
  if (!el) { page = 'home'; el = document.getElementById('home-page'); }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  STATE.page = page;
  history.replaceState(null, '', '#' + page);
  scrollTo(0, 0);
  document.body.classList.remove('nav-open');
  if (page === 'shop') renderProducts();
  if (page === 'home') renderProducts('featured-products', catalog().slice(0, 4));
  if (window.AOS) AOS.refresh();
}

function toggleMobNav() { document.body.classList.toggle('nav-open'); }

/* ---------- profile ---------- */
function updateDexLabel(v) { const el = document.getElementById('dex-label'); if (el) el.textContent = DEX_LABELS[+v]; }

function updateProfileBadge() {
  const text = document.getElementById('badge-text');
  const badge = document.getElementById('profile-badge');
  if (STATE.profile) {
    const p = { seated: 'Seated', standing: 'Standing', mixed: 'Mixed' }[STATE.profile.posture] || 'Set';
    const d = { standard: 'Full use', limited: 'Limited', one_handed: '1-hand' }[STATE.profile.dexterity] || '';
    text.textContent = p + ' · ' + d;
    badge.classList.add('set');
  } else { text.textContent = 'Set profile'; badge.classList.remove('set'); }
}

function saveProfile() {
  const f = document.getElementById('profile-form');
  const posture = f.querySelector('input[name="posture"]:checked')?.value;
  if (!posture) { document.getElementById('profile-status').textContent = 'Choose a posture to continue.'; return; }
  STATE.profile = {
    posture,
    dexterity: DEX_MAP[+document.getElementById('dex-range').value],
    dex_notes: document.getElementById('dex-notes').value.trim(),
    sensory: [...f.querySelectorAll('input[name="sensory"]:checked')].map(i => i.value),
    mobility_aids: [...f.querySelectorAll('input[name="mobility_aids"]:checked')].map(i => i.value),
    aid_other: document.getElementById('aid-other').value.trim(),
    fit_concerns: [...f.querySelectorAll('input[name="fit_concerns"]:checked')].map(i => i.value),
  };
  localStorage.setItem('aequidrape_profile', JSON.stringify(STATE.profile));
  updateProfileBadge();
  navigateTo('shop');
}

function applyNeed(kind) {
  if (!STATE.profile) STATE.profile = { posture: 'seated', dexterity: 'standard', sensory: [], mobility_aids: [], fit_concerns: [], dex_notes: '', aid_other: '' };
  if (kind === 'seated') STATE.profile.posture = 'seated';
  if (kind === 'one_handed') STATE.profile.dexterity = 'one_handed';
  if (kind === 'sensory') STATE.profile.sensory = ['tag-free'];
  if (kind === 'prosthetic') STATE.profile.mobility_aids = ['prosthetic-leg'];
  updateProfileBadge();
  navigateTo('shop');
}

/* ---------- studio: photo ---------- */
function selectPhoto(key, btn) {
  STATE.photo = { key, src: PHOTOS[key], custom: false, base64: null };
  document.querySelectorAll('.thumb-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('stage-before').src = PHOTOS[key];
  document.getElementById('consent-row').hidden = true;
  resetStage();
}

function uploadPhoto() { document.getElementById('photo-upload').click(); }

function onPhotoFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  resizeAndCompress(file).then(base64 => {
    STATE.photo = { key: 'custom', src: base64, custom: true, base64: base64 };
    document.querySelectorAll('.thumb-btn').forEach(b => b.classList.remove('active'));
    input.closest('.thumb-col').querySelector('.upload').classList.add('active');
    document.getElementById('stage-before').src = base64;
    document.getElementById('consent-row').hidden = false;
    resetStage();
  });
}
/* ---------- studio: garment ---------- */
function renderGarmentList() {
  const list = document.getElementById('garment-list');
  if (!list) return;
  
  // NEW: Only show items in cart
  const cartItems = catalog().filter(g => STATE.cart.includes(g.id));
  if (cartItems.length === 0) {
    list.innerHTML = '<p style="color:var(--ink-2); padding: 12px 0; font-size: 0.95rem; text-align: center;">Your try-on bag is empty.<br/>Add garments from the shop to try them on.</p>';
    return;
  }
  
  list.innerHTML = cartItems.map(g => `
    <button class="garment-opt ${STATE.garmentId === g.id ? 'active' : ''}" onclick="selectGarment('${g.id}', this)">
      <span><strong>${g.name}</strong><small>${g.closure_type}</small></span>
      <span class="price">$${priceOf(g)}</span>
    </button>`).join('');
}

function selectGarment(id, btn) {
  STATE.garmentId = id;
  STATE.garment = { base64: null, modifiedUrl: null, custom: false };
  document.querySelectorAll('.garment-opt').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('garment-preview').hidden = true;
  document.getElementById('modify-status').textContent = '';
}


function onGarmentFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  resizeAndCompress(file).then(base64 => {
    STATE.garmentId = null;
    STATE.garment = { base64: base64, modifiedUrl: null, custom: true };
    document.querySelectorAll('.garment-opt').forEach(b => b.classList.remove('active'));
    const prev = document.getElementById('garment-preview');
    prev.hidden = false;
    document.getElementById('garment-preview-img').src = base64;
    document.getElementById('garment-preview-label').textContent = 'Your garment';
  });
}
async function toBase64(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(blob);
  });
}

async function currentGarmentBase64() {
  if (STATE.garment.base64) return STATE.garment.base64;
  const g = catalog().find(p => p.id === STATE.garmentId);
  if (g && g.image_path) return toBase64('/' + g.image_path);
  return null;
}

async function runModification() {
  const prompt = document.getElementById('modify-prompt').value.trim();
  const status = document.getElementById('modify-status');
  if (!prompt) { status.textContent = 'Describe a modification first.'; return; }
  const base64 = await currentGarmentBase64();
  if (!base64) { status.textContent = 'Pick or upload a garment first.'; return; }
  status.textContent = 'Modifying garment...';
  try {
    const res = await fetch('/api/modify-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64, prompt }),
    });
    const data = await res.json();
    if (data.url) {
      STATE.garment.modifiedUrl = data.url;
      const prev = document.getElementById('garment-preview');
      prev.hidden = false;
      document.getElementById('garment-preview-img').src = data.url;
      document.getElementById('garment-preview-label').textContent = 'Modified: ' + prompt;
      status.textContent = 'Garment modified. Ready for try-on.';
    } else {
      status.textContent = 'Modification failed: ' + (data.error || 'unknown error');
    }
  } catch (e) {
    status.textContent = 'Modification failed: ' + e.message;
  }
}

/* ---------- studio: try-on ---------- */
function resetStage() {
  ['layer-after', 'tag-after', 'cmp-line', 'cmp-knob', 'cmp-range'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
  document.getElementById('gauge-card').hidden = true;
  document.getElementById('studio-status').textContent = '';
}

// UPDATED: Apply inline styles as robust fallback for CSS variable mapping
function setCmp(v) {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const pct = Math.max(0, Math.min(100, parseFloat(v)));

  // 1. Update CSS variable
  stage.style.setProperty('--pos', pct + '%');

  // 2. Force clip-path on the after layer
  const afterLayer = document.getElementById('layer-after');
  if (afterLayer) {
    afterLayer.style.clipPath = `inset(0 0 0 ${pct}%)`;
    afterLayer.style.webkitClipPath = `inset(0 0 0 ${pct}%)`;
    afterLayer.hidden = false;
  }

  // 3. Force position on the line and knob
  const line = document.getElementById('cmp-line');
  if (line) {
    line.style.left = `${pct}%`;
    line.style.transform = `translateX(-50%)`; // Fallback centering
    line.hidden = false;
  }

  const knob = document.getElementById('cmp-knob');
  if (knob) {
    knob.style.left = `${pct}%`;
    knob.style.transform = `translate(-50%, -50%)`;
    knob.hidden = false;
  }

  // 4. Sync native range input
  const range = document.getElementById('cmp-range');
  if (range) {
    range.value = pct;
    range.hidden = false;
  }
}
async function runTryOn() {
  const status = document.getElementById('studio-status');
  if (STATE.photo.custom && !document.getElementById('consent').checked) {
    status.textContent = 'Tick the consent box to use your own photo.'; return;
  }
  if (!STATE.garmentId && !STATE.garment.custom) { status.textContent = 'Pick or upload a garment first.'; return; }

  status.textContent = 'Contacting YouCam...';
  const personBase64 = STATE.photo.base64 || await toBase64(STATE.photo.src);
  const payload = { person_base64: personBase64 };
  if (STATE.garment.modifiedUrl) payload.garment_url = STATE.garment.modifiedUrl;
  else payload.garment_base64 = await currentGarmentBase64();

  try {
    const res = await fetch('/api/try-on', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.url) {
      document.getElementById('stage-after').src = data.url;
      ['layer-after', 'tag-after', 'cmp-line', 'cmp-knob', 'cmp-range'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = false; });
      setCmp(50);
      status.textContent = data.status === 'cached' ? 'Cached render ready. Drag to compare.' : 'Real render ready. Drag to compare.';
    } else {
      status.textContent = 'Try-on failed: ' + (data.error || 'unknown error');
    }
  } catch (e) {
    status.textContent = 'Try-on failed: ' + e.message;
  }
  await evaluate();
}

/* ---------- fit notes (neutral, no verdicts) ---------- */
async function evaluate() {
  const g = catalog().find(p => p.id === STATE.garmentId) || STATE.current;
  if (!g) return;
  let insight = null;
  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_profile: STATE.profile || { posture: 'seated', dexterity: 'limited', sensory: [], mobility_aids: [], fit_concerns: [] }, garment_id: g.id }),
    });
    if (res.ok) { const data = await res.json(); insight = data.insight || data; }
  } catch {}
  if (!insight) insight = { compatibility: [], risks: [], questions_for_seller: [], summary: '' };

  const notes = [STATE.profile?.dex_notes, STATE.profile?.aid_other].filter(Boolean).join('; ');
  if (notes) insight.questions_for_seller = [...(insight.questions_for_seller || []), 'Can this garment accommodate: ' + notes + '?'];

  STATE.insight = insight;
  renderNotes(insight, g);
}

function fillList(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  const title = el.querySelector('h4');
  el.innerHTML = (title ? title.outerHTML : '') +
    (items && items.length ? items.map(t => `<li><span>${t}</span></li>`).join('') : '<li><span>Nothing flagged.</span></li>');
}

function renderNotes(ins, g) {
  const card = document.getElementById('gauge-card');
  card.hidden = false;
  const name = document.getElementById('gauge-garment-name');
  if (name) name.textContent = g ? g.name : '';
  fillList('gauge-ok', ins.compatibility);
  fillList('gauge-warn', ins.risks);
  fillList('gauge-ask', ins.questions_for_seller);
}

function speakSummary() {
  if (!STATE.insight) return;
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  const parts = [
    ...(STATE.insight.compatibility || []),
    ...(STATE.insight.risks || []),
  ];
  speechSynthesis.speak(new SpeechSynthesisUtterance(parts.join('. ') || 'No fit notes yet.'));
}

/* ---------- shop ---------- */
function renderProducts(containerId = 'products', list = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let items = list || [...catalog()];
  if (!list && STATE.filters.size) {
    items = items.filter(g => [...STATE.filters].every(f => (g.closure_type || '').includes(f) || (g.tags || []).includes(f)));
  }
  const sort = document.getElementById('sort-select')?.value;
  if (sort === 'price-low') items.sort((a, b) => priceOf(a) - priceOf(b));
  if (sort === 'price-high') items.sort((a, b) => priceOf(b) - priceOf(a));
  container.innerHTML = items.map(g => `
    <article class="p-card" onclick="showProduct('${g.id}')">
      <div class="p-media">
        <img src="/${g.image_path}" alt="${g.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'" />
        <span class="flag">${g.closure_type}</span>
        <button class="quick" onclick="event.stopPropagation(); addToCart('${g.id}'); this.textContent='In bag'; this.disabled=true;">
          ${STATE.cart.includes(g.id) ? 'In bag' : 'Add to bag'}
        </button>
      </div>
      <div class="p-body">
        <h3>${g.name}</h3>
        <p class="meta">${g.fabric || ''} · ${g.stretch} stretch</p>
        <div class="row"><span class="price">$${priceOf(g)}</span></div>
      </div>
    </article>`).join('') || '<p style="color:var(--ink-2)">No garments match these filters.</p>';
}

function toggleFilter(btn) {
  const f = btn.dataset.filter;
  STATE.filters.has(f) ? STATE.filters.delete(f) : STATE.filters.add(f);
  btn.classList.toggle('active');
  renderProducts();
}

function sortProducts() { renderProducts(); }


/* ---------- product detail ---------- */
function showProduct(id) {
  const g = catalog().find(p => p.id === id);
  if (!g) return;
  STATE.current = g;
  document.getElementById('breadcrumb-text').textContent = g.name;
  document.getElementById('product-name').textContent = g.name;
  document.getElementById('product-price').textContent = '$' + priceOf(g);
  document.getElementById('product-description').textContent = g.description || '';
  document.getElementById('detail-img').src = '/' + g.image_path;
  const set = (sid, v) => { const el = document.getElementById(sid); if (el) el.textContent = v || '—'; };
  set('spec-closure', g.closure_type); set('spec-back-rise', g.back_rise);
  set('spec-stretch', g.stretch); set('spec-seams', g.seams); set('spec-pockets', g.pocket_access);
  
  // NEW: Hook up add to cart button in detail view
  const cartBtn = document.getElementById('add-to-cart-btn');
  if (cartBtn) {
    cartBtn.textContent = STATE.cart.includes(g.id) ? 'In bag' : 'Add to try-on bag';
    cartBtn.disabled = STATE.cart.includes(g.id);
    cartBtn.onclick = () => {
      addToCart(g.id);
      cartBtn.textContent = 'Added to bag';
      cartBtn.disabled = true;
    };
  }

  evaluate().then(() => {
    if (STATE.insight) {
      fillList('d-ok', STATE.insight.compatibility);
      fillList('d-warn', STATE.insight.risks);
      fillList('d-ask', STATE.insight.questions_for_seller);
      const q = document.getElementById('questions-list');
      if (q) q.innerHTML = (STATE.insight.questions_for_seller || []).map(t => `<label class="q-item"><input type="checkbox" /><span>${t}</span></label>`).join('');
    }
  });
  navigateTo('product');
}

function tryOnThis() {
  if (STATE.current) {
    STATE.garmentId = STATE.current.id;
    renderGarmentList();
  }
  navigateTo('home');
  setTimeout(() => document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' }), 60);
}

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