/* Aequidrape — single source of truth for frontend logic */

const STATE = {
  page: 'home',
  profile: JSON.parse(localStorage.getItem('aequidrape_profile') || 'null'),
  cart: JSON.parse(localStorage.getItem('aequidrape_cart') || '[]'),
  modifications: JSON.parse(localStorage.getItem('aequidrape_mods') || '{}'),
  products: [],
  garmentId: null,
  current: null,
  insight: null,
  filters: new Set(),
  photo: { key: 'standing', src: '/demo-images/01-standing-original.jpg', custom: false, base64: null },
  garment: { base64: null, modifiedUrl: null, custom: false },
  tryOnReady: false,
  workshopGarment: null,
  workshopHistory: []
};

const PHOTOS = {
  standing: '/demo-images/01-standing-original.jpg',
  seated: '/demo-images/02-seated-original.jpg',
  wheelchair: '/demo-images/03-wheelchair-original.jpg',
  prosthetic: '/demo-images/04-prosthetic-original.jpg',
};

const DEX_MAP = ['standard', 'limited', 'one_handed'];
const DEX_LABELS = ['Full use of both hands', 'Limited grip or strength', 'One hand available'];

/* ---------- Comfort Engine ---------- */
function getComfortInsights(profile, garment) {
  const insights = [];
  const prompts = [];


  if (!profile || !garment) return { insights, prompts };

 // Add to getComfortInsights function
if (profile.posture === 'seated') {
  insights.push('Seated posture requires 15-20mm additional ease at hip and chest to prevent pressure points.');
  prompts.push('add 15mm wearing ease at hip and chest areas');
}

if (profile.mobility_aids?.includes('prosthetic-leg')) {
  insights.push('Prosthetic accommodation requires asymmetric ease distribution around the residual limb.');
  prompts.push('add asymmetric ease panels around prosthetic area');
}

if (profile.sensory?.includes('soft-fabric')) {
  insights.push('Sensory needs require zero-pressure contact at fit points (shoulders, underarms).');
  prompts.push('add flat-lock seams and remove all pressure points at contact areas');
}
  
  return { insights, prompts };
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  if (window.AOS) AOS.init({ duration: 700, once: true, disable: matchMedia('(prefers-reduced-motion: reduce)').matches });
  updateProfileBadge();
  await loadProducts();
  renderGarmentList();
  
  const stage = document.getElementById('stage');
  if (stage) {
    let isDragging = false;
    const updateSlider = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const rect = stage.getBoundingClientRect();
      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.max(0, Math.min(100, pct));
      setCmp(pct);
    };
    const startDrag = (e) => { if (!STATE.tryOnReady) return; isDragging = true; updateSlider(e); e.preventDefault(); };
    const endDrag = () => { isDragging = false; };
    const moveDrag = (e) => { if (!isDragging || !STATE.tryOnReady) return; updateSlider(e); e.preventDefault(); };

    stage.addEventListener('mousedown', startDrag);
    stage.addEventListener('touchstart', startDrag, { passive: false });
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

function removeFromBag(id) {
  STATE.cart = STATE.cart.filter(cId => cId !== id);
  if (STATE.garmentId === id) {
    STATE.garmentId = null;
    resetStage();
  }
  delete STATE.modifications[id];
  localStorage.setItem('aequidrape_cart', JSON.stringify(STATE.cart));
  localStorage.setItem('aequidrape_mods', JSON.stringify(STATE.modifications));
  renderGarmentList();
  updateCartUI();
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
  
  const cartItems = catalog().filter(g => STATE.cart.includes(g.id));
  if (cartItems.length === 0) {
    list.innerHTML = '<p style="color:var(--ink-2); padding: 12px 0; font-size: 0.95rem; text-align: center;">Your try-on bag is empty.<br/>Add garments from the shop to try them on.</p>';
    return;
  }
  
  list.innerHTML = cartItems.map(g => {
    const isModified = STATE.modifications[g.id];
    const isActive = STATE.garmentId === g.id;
    return `
      <div class="garment-opt-wrap" style="display:flex; gap:8px; align-items:center;">
        <button class="garment-opt ${isActive ? 'active' : ''}" onclick="selectGarment('${g.id}', this)" style="flex:1;">
          <span>
            <strong>${g.name} ${isModified ? '<small style="color:var(--accent); font-weight:600;">(Modified)</small>' : ''}</strong>
            <small>${g.closure_type}</small>
          </span>
          <span class="price">$${priceOf(g)}</span>
        </button>
        <button class="remove-btn" onclick="event.stopPropagation(); removeFromBag('${g.id}')" aria-label="Remove from bag">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>`;
  }).join('');
}

function selectGarment(id, btn) {
  STATE.garmentId = id;
  STATE.garment = { base64: null, modifiedUrl: STATE.modifications[id]?.url || null, custom: false };
  
  document.querySelectorAll('.garment-opt').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  const prev = document.getElementById('garment-preview');
  if (STATE.garment.modifiedUrl) {
    prev.hidden = false;
    document.getElementById('garment-preview-img').src = STATE.garment.modifiedUrl;
    document.getElementById('garment-preview-label').textContent = 'Modified: ' + (STATE.modifications[id]?.prompt || '');
  } else {
    prev.hidden = true;
  }
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
      if (STATE.garmentId) {
        STATE.modifications[STATE.garmentId] = { prompt, url: data.url };
        localStorage.setItem('aequidrape_mods', JSON.stringify(STATE.modifications));
        renderGarmentList();
      }
      
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
  STATE.tryOnReady = false;
  ['layer-after', 'tag-after', 'cmp-line', 'cmp-knob', 'cmp-range'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
  document.getElementById('gauge-card').hidden = true;
  document.getElementById('studio-status').textContent = '';
}

function setCmp(v) {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const pct = Math.max(0, Math.min(100, parseFloat(v)));

  stage.style.setProperty('--pos', pct + '%');

  var beforeLayer = document.querySelector('.stage .layer.before');
  if (beforeLayer) {
    beforeLayer.style.zIndex = '1';
    beforeLayer.style.clipPath = 'none';
    beforeLayer.style.webkitClipPath = 'none';
  }

  var afterLayer = document.getElementById('layer-after');
  if (afterLayer) {
    afterLayer.style.zIndex = '2';
    afterLayer.style.clipPath = 'inset(0 0 0 ' + pct + '%)';
    afterLayer.style.webkitClipPath = 'inset(0 0 0 ' + pct + '%)';
    afterLayer.hidden = false;
  }

  var line = document.getElementById('cmp-line');
  if (line) {
    line.style.left = pct + '%';
    line.style.zIndex = '4';
    line.hidden = false;
  }

  var knob = document.getElementById('cmp-knob');
  if (knob) {
    knob.style.left = pct + '%';
    knob.style.zIndex = '5';
    knob.hidden = false;
  }

  var range = document.getElementById('cmp-range');
  if (range) {
    range.value = pct;
    range.style.zIndex = '6';
    range.hidden = false;
  }
}

async function runTryOn() {
  const status = document.getElementById('studio-status');
  if (STATE.photo.custom && !document.getElementById('consent').checked) {
    status.textContent = 'Tick the consent box to use your own photo.'; return;
  }
  if (!STATE.garmentId && !STATE.garment.custom) { status.textContent = 'Pick or upload a garment first.'; return; }

    const isAdaptiveProfile = STATE.profile && (
    STATE.profile.posture === 'seated' || 
    (STATE.profile.mobility_aids && STATE.profile.mobility_aids.length > 0) || 
    STATE.profile.dexterity !== 'standard'
  );

  status.textContent = isAdaptiveProfile 
    ? 'Applying adaptive drape (AI fit may vary for prosthetics & seated postures)...' 
    : 'Contacting YouCam...';
  const personBase64 = STATE.photo.base64 || await toBase64(STATE.photo.src);
  const payload = { person_base64: personBase64 };
  
  if (STATE.garmentId && STATE.modifications[STATE.garmentId]) {
    payload.garment_url = STATE.modifications[STATE.garmentId].url;
  } else if (STATE.garment.modifiedUrl) {
    payload.garment_url = STATE.garment.modifiedUrl;
  } else {
    payload.garment_base64 = await currentGarmentBase64();
  }

  try {
    const res = await fetch('/api/try-on', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.url) {
      const afterImg = document.getElementById('stage-after');
      await new Promise((resolve) => {
        afterImg.onload = resolve;
        afterImg.onerror = resolve;
        afterImg.src = data.url + (data.url.includes('?') ? '&' : '?') + '_t=' + Date.now();
      });
      ['layer-after', 'tag-after', 'cmp-line', 'cmp-knob', 'cmp-range'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = false; });
      STATE.tryOnReady = true;
      setCmp(50);
      status.textContent = data.status === 'cached' ? 'Cached render ready. Drag to compare.' : ' Render ready. Drag to compare. (AI fit may vary for prosthetics & seated postures due to current model limitations) ';
    } else {
      status.textContent = 'Try-on failed: ' + (data.error || 'unknown error');
    }
  } catch (e) {
    status.textContent = 'Try-on failed: ' + e.message;
  }
  await evaluate();
}

/* ---------- fit notes ---------- */
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
  
  container.innerHTML = items.map(g => {
    const inCart = STATE.cart.includes(g.id);
    return `
    <article class="p-card" onclick="showProduct('${g.id}')">
      <div class="p-media">
        <img src="/${g.image_path}" alt="${g.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'" />
        <span class="flag">${g.closure_type}</span>
        <div class="cart-actions">
          <button class="quick ${inCart ? 'hidden' : ''}" onclick="event.stopPropagation(); addToCart('${g.id}')">Add to bag</button>
          <button class="quick remove ${!inCart ? 'hidden' : ''}" onclick="event.stopPropagation(); removeFromBag('${g.id}')">Remove</button>
          <button class="quick modify" onclick="event.stopPropagation(); openWorkshop('${g.id}')">Modify</button>
        </div>
      </div>
      <div class="p-body">
        <h3>${g.name}</h3>
        <p class="meta">${g.fabric || ''} · ${g.stretch} stretch</p>
        <div class="row"><span class="price">$${priceOf(g)}</span></div>
      </div>
    </article>`;
  }).join('') || '<p style="color:var(--ink-2)">No garments match these filters.</p>';
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
    
    const comfort = getComfortInsights(STATE.profile, g);
    const adaptPanel = document.getElementById('adapt-list');
    if (adaptPanel) {
      let html = '<h4 style="margin-bottom:12px; color:var(--accent);">AI Comfort Assessment</h4>';
      if (comfort.insights.length === 0) {
        html += '<p style="color:var(--ink-2); font-size:14px;">This garment is highly compatible with your profile.</p>';
      } else {
        html += '<ul style="margin-bottom:16px; list-style:none; padding:0;">' + comfort.insights.map(i => `<li style="margin-bottom:8px; font-size:14px; color:var(--ink-2); display:flex; gap:8px;"><span style="color:var(--warn);">⚠</span> ${i}</li>`).join('') + '</ul>';
      }
      
      if (comfort.prompts.length > 0) {
        html += '<h4 style="margin-bottom:12px;">Suggested Workshop Modifications</h4>';
        html += comfort.prompts.map(p => `
          <div class="ai-input-wrapper" style="margin-bottom:10px;">
            <input type="text" value="${p}" id="prompt-${g.id}" readonly />
            <button onclick="quickModify('${g.id}', '${p}')">Modify</button>
          </div>`).join('');
      }
      adaptPanel.innerHTML = html;
    }
  });
  navigateTo('product');
}

function quickModify(garmentId, prompt) {
  openWorkshop(garmentId);
  setTimeout(() => {
    const promptInput = document.getElementById('ws-prompt');
    if (promptInput) {
      promptInput.value = prompt;
      runWorkshopMod();
    }
  }, 200);
}

/* ---------- NEW: WORKSHOP LOGIC ---------- */
function openWorkshop(garmentId) {
  if (!STATE.cart.includes(garmentId)) addToCart(garmentId);
  STATE.workshopGarment = catalog().find(p => p.id === garmentId);
  STATE.workshopHistory = [];
  
  document.getElementById('ws-original').src = '/' + STATE.workshopGarment.image_path;
  document.getElementById('ws-current').src = '/' + STATE.workshopGarment.image_path;
  document.getElementById('ws-chat-body').innerHTML = '<div class="chat-msg system">Select this garment to see how it can be adapted. Type a modification below.</div>';
  document.getElementById('ws-email-output').hidden = true;
  
  navigateTo('workshop');
}

async function runWorkshopMod() {
  const easePurpose = document.getElementById('ws-ease-purpose').value;
  const fullPrompt = prompt + ' (wearing purpose: ' + easePurpose + ')';  
  const prompt = document.getElementById('ws-prompt').value.trim();
  const status = document.getElementById('ws-status');
  if (!prompt) { status.textContent = 'Describe a modification first.'; return; }
  
  const currentImg = document.getElementById('ws-current').src;
  const base64 = await toBase64(currentImg);
  
  status.textContent = 'Applying modification...';
  const chatBody = document.getElementById('ws-chat-body');
  
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.textContent = prompt;
  chatBody.appendChild(userMsg);
  chatBody.scrollTop = chatBody.scrollHeight;
  
  document.getElementById('ws-prompt').value = '';
  
  try {
    const res = await fetch('/api/modify-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64, prompt }),
    });
    const data = await res.json();
    if (data.url) {
      STATE.workshopHistory.push({ prompt, imageUrl: data.url });
      document.getElementById('ws-current').src = data.url;
      
      // Sync to global modifications so main studio try-on uses the latest
      if (STATE.workshopGarment) {
        STATE.modifications[STATE.workshopGarment.id] = { prompt, url: data.url };
        localStorage.setItem('aequidrape_mods', JSON.stringify(STATE.modifications));
      }
      
      const aiMsg = document.createElement('div');
      aiMsg.className = 'chat-msg ai';
      aiMsg.innerHTML = '<strong>Adaptation Applied:</strong> ' + prompt + '<br/><img src="' + data.url + '" alt="Modified" />';
      chatBody.appendChild(aiMsg);
      chatBody.scrollTop = chatBody.scrollHeight;
      
      status.textContent = 'Ready for next modification.';
    } else {
      status.textContent = 'Modification failed: ' + (data.error || 'unknown error');
    }
  } catch (e) {
    status.textContent = 'Modification failed: ' + e.message;
  }
}

async function generateEmail() {
  const status = document.getElementById('ws-status');
  if (STATE.workshopHistory.length === 0) { status.textContent = 'Make at least one modification first.'; return; }
  
  status.textContent = 'Drafting intelligent email with AI...';
  try {
    const res = await fetch('/api/generate-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: STATE.profile || {},
        garment: STATE.workshopGarment,
        history: STATE.workshopHistory
      })
    });
    const data = await res.json();
    
    if (res.ok && data.email) {
      document.getElementById('ws-email-text').value = data.email;
      document.getElementById('ws-email-output').hidden = false;
      status.textContent = 'AI Email draft ready.';
    } else {
      status.textContent = 'AI failed: ' + (data.error || 'Unknown error. Check server logs.');
    }
  } catch (e) {
    status.textContent = 'Network error: ' + e.message;
  }
}

function tryOnThis() {
  if (STATE.current) {
    if (!STATE.cart.includes(STATE.current.id)) addToCart(STATE.current.id);
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