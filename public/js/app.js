/**
 * Aequidrape Frontend App
 * Unified logic for Shop, Profile, Gauge, and the new Adaptive Studio.
 */

const STATE = {
  current_page: 'home',
  user_profile: JSON.parse(localStorage.getItem('aequidrape_profile')) || null,
  products: [],
  current_product: null,
  current_review: null,
  // Studio State
  studio: {
    personBase64: null,
    garmentBase64: null,
    modifiedGarmentUrl: null
  }
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  updateProfileBadge();
  setupNavigation();
  navigateTo(location.hash.slice(1) || 'home');
});

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) STATE.products = await res.json();
  } catch (e) { console.warn('API failed, using fallback'); }
  
  if (!STATE.products.length) {
    STATE.products = [
      { id: 'adaptive-jacket-001', name: 'Adaptive Jacket', price_range: '$140', closure_type: 'magnetic', back_rise: 'high', stretch: 'moderate', image_path: 'garments/jacket.jpg', description: 'Magnetic closure jacket.' },
      { id: 'seated-pants-001', name: 'Seated Cargo Pant', price_range: '$110', closure_type: 'hook-and-loop', back_rise: 'high', stretch: 'high', image_path: 'garments/pants.jpg', description: 'High back rise cargo pant.' },
      { id: 'onehanded-shirt-001', name: 'One-Handed Shirt', price_range: '$85', closure_type: 'magnetic', back_rise: 'medium', stretch: 'slight', image_path: 'garments/shirt.jpg', description: 'Magnetic button-front shirt.' },
      { id: 'accessible-hoodie-001', name: 'No-Pull Hoodie', price_range: '$130', closure_type: 'magnetic', back_rise: 'medium', stretch: 'high', image_path: 'garments/hoodie.jpg', description: 'Full-zip magnetic hoodie.' },
      { id: 'adaptive-leggings-001', name: 'Side-Zip Legging', price_range: '$95', closure_type: 'side zippers', back_rise: 'high', stretch: 'maximum', image_path: 'garments/leggings.jpg', description: 'Maximum-stretch legging.' }
    ];
  }
  renderAllProducts();
}

// ========== NAVIGATION ==========
function setupNavigation() {
  window.addEventListener('hashchange', () => navigateTo(location.hash.slice(1) || 'home'));
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  let el = document.getElementById(`${page}-page`);
  if (!el) { page = 'home'; el = document.getElementById('home-page'); }
  
  el.classList.add('active');
  STATE.current_page = page;
  history.replaceState(null, '', '#' + page);
  scrollTo(0, 0);

  if (page === 'shop' || page === 'home') renderAllProducts();
  if (page === 'product') displayProductDetail();
}

// ========== PROFILE MANAGEMENT ==========
function updateProfileBadge() {
  const badge = document.getElementById('badge-text');
  if (!badge) return;
  if (STATE.user_profile) {
    const p = STATE.user_profile.posture === 'seated' ? 'Seated' : 'Standing';
    const d = STATE.user_profile.dexterity === 'limited' ? 'Limited' : 'Standard';
    badge.textContent = `${p} · ${d}`;
  } else {
    badge.textContent = 'Set profile';
  }
}

function saveProfile() {
  const form = document.getElementById('profile-form');
  if (!form) return;
  const profile = {
    posture: form.querySelector('input[name="posture"]:checked')?.value,
    dexterity: form.querySelector('input[name="dexterity"]:checked')?.value,
    sensory: Array.from(form.querySelectorAll('input[name="sensory"]:checked')).map(i => i.value),
    mobility_aids: Array.from(form.querySelectorAll('input[name="mobility_aids"]:checked')).map(i => i.value),
    fit_concerns: Array.from(form.querySelectorAll('input[name="fit_concerns"]:checked')).map(i => i.value),
  };
  if (!profile.posture || !profile.dexterity) { alert('Select posture and dexterity.'); return; }
  STATE.user_profile = profile;
  localStorage.setItem('aequidrape_profile', JSON.stringify(profile));
  updateProfileBadge();
  navigateTo('shop');
}

// ========== PRODUCT RENDERING ==========
function renderAllProducts() {
  const containers = [document.getElementById('products'), document.getElementById('featured-products')];
  containers.forEach(container => {
    if (!container) return;
    container.innerHTML = STATE.products.map(p => `
      <div class="product-card" onclick="showProduct('${p.id}')" style="cursor:pointer;">
        <div class="product-image">
          <img src="/${p.image_path}" alt="${p.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='👕'" />
        </div>
        <div class="product-info">
          <h3 class="product-name">${p.name}</h3>
          <div class="product-specs">
            <span class="product-spec-tag">${p.closure_type}</span>
            <span class="product-spec-tag">${p.stretch} stretch</span>
          </div>
        </div>
      </div>
    `).join('');
  });
}

function showProduct(id) {
  STATE.current_product = STATE.products.find(p => p.id === id);
  if (STATE.current_product) navigateTo('product');
}

function displayProductDetail() {
  const p = STATE.current_product;
  if (!p) return;
  
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTxt('breadcrumb-text', p.name);
  setTxt('product-name', p.name);
  setTxt('product-price', p.price_range || '$0');
  setTxt('product-description', p.description || '');
  setTxt('spec-closure', p.closure_type);
  setTxt('spec-back-rise', p.back_rise);
  setTxt('spec-stretch', p.stretch);
  
  const imgEl = document.getElementById('product-main-image');
  if (imgEl) imgEl.innerHTML = `<img src="/${p.image_path}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'; this.parentElement.innerHTML='👕'" />`;

  if (STATE.user_profile) displayCompatibilityGauge(p);
}

async function displayCompatibilityGauge(product) {
  let review = null;
  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_profile: STATE.user_profile, garment_id: product.id })
    });
    if (res.ok) {
      const data = await res.json();
      review = data.insight || data;
    }
  } catch (e) { console.warn('Evaluate failed'); }

  if (!review) review = { compatibility: ['Magnetic closure'], risks: [], confidence: 'moderate', questions_for_seller: ['What is the seated back length?'] };
  
  const gauge = document.getElementById('product-gauge');
  if (!gauge) return;
  
  gauge.innerHTML = `
    <div class="gauge-header">
      <h2 class="gauge-title"><span class="gauge-title-icon">${review.confidence === 'high' ? '✓' : '⚠'}</span> ${review.confidence === 'high' ? 'Likely compatible' : 'Check details'}</h2>
      <button class="btn btn-text" onclick="toggleGaugeDetails()" aria-expanded="false">Details</button>
    </div>
    <div class="gauge-content" id="gauge-details" style="display:none">
      <div class="gauge-section"><h4 class="gauge-section-title">Strengths</h4>${review.compatibility.map(c => `<div class="gauge-item"><span class="gauge-item-icon gauge-item-positive">✓</span><span>${c}</span></div>`).join('')}</div>
      <div class="gauge-section"><h4 class="gauge-section-title">Risks</h4>${review.risks.map(r => `<div class="gauge-item"><span class="gauge-item-icon gauge-item-warning">⚠</span><span>${r}</span></div>`).join('')}</div>
    </div>
    <div class="gauge-footer">
      <span class="gauge-confidence-label">Confidence</span>
      <div class="gauge-confidence-bar"><div class="gauge-confidence-fill ${review.confidence}"></div></div>
      <span style="text-transform:capitalize; font-weight:bold;">${review.confidence}</span>
    </div>
  `;

  const qList = document.getElementById('questions-list');
  if (qList) qList.innerHTML = review.questions_for_seller.map(q => `<div class="question-item"><input type="checkbox" /><span class="question-text">${q}</span></div>`).join('');
}

function toggleGaugeDetails() {
  const details = document.getElementById('gauge-details');
  const btn = event.target;
  const isExpanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', !isExpanded);
  details.style.display = isExpanded ? 'none' : 'block';
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.tab-button').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
  const tab = document.getElementById(tabName + '-tab') || document.getElementById(tabName);
  if (tab) tab.style.display = 'block';
  event.target.classList.add('active');
  event.target.setAttribute('aria-selected', 'true');
}

// ========== NEW STUDIO LOGIC (Upload, Modify, Try-On) ==========

// 1. Person Upload
document.addEventListener('change', (e) => {
  if (e.target.id === 'person-upload') {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      STATE.studio.personBase64 = ev.target.result;
      const preview = document.getElementById('person-preview');
      if (preview) preview.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }
  
  // 2. Garment Upload
  if (e.target.id === 'garment-upload') {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      STATE.studio.garmentBase64 = ev.target.result;
      STATE.studio.modifiedGarmentUrl = null; // Reset modification
      const preview = document.getElementById('garment-preview');
      if (preview) preview.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// 3. Run Modification (Image-to-Image)
async function runModification() {
  const prompt = document.getElementById('modify-prompt')?.value;
  const status = document.getElementById('modify-status');
  if (!prompt) { if(status) status.textContent = 'Enter a prompt first.'; return; }
  if (!STATE.studio.garmentBase64) { if(status) status.textContent = 'Upload a garment first.'; return; }

  if(status) status.textContent = 'Modifying garment with AI... (takes ~30s)';
  try {
    const res = await fetch('/api/modify-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: STATE.studio.garmentBase64, prompt })
    });
    const data = await res.json();
    if (data.url) {
      STATE.studio.modifiedGarmentUrl = data.url;
      const preview = document.getElementById('garment-preview');
      if (preview) preview.src = data.url;
      if(status) status.textContent = 'Garment modified successfully!';
    } else {
      if(status) status.textContent = 'Error: ' + (data.error || 'Unknown');
    }
  } catch (e) {
    if(status) status.textContent = 'Error: ' + e.message;
  }
}

// 4. Run Try-On
async function runTryOn() {
  const status = document.getElementById('vto-status');
  const resultImg = document.getElementById('result-preview');
  const placeholder = document.getElementById('result-placeholder');

  if (!STATE.studio.personBase64) { if(status) status.textContent = 'Upload a selfie first.'; return; }
  
  const payload = { person_base64: STATE.studio.personBase64 };
  if (STATE.studio.modifiedGarmentUrl) {
    payload.garment_url = STATE.studio.modifiedGarmentUrl;
  } else if (STATE.studio.garmentBase64) {
    payload.garment_base64 = STATE.studio.garmentBase64;
  } else {
    if(status) status.textContent = 'Upload a garment first.'; return;
  }

  if(status) status.textContent = 'Generating try-on... (takes ~1-2 mins)';
  if(placeholder) placeholder.hidden = true;
  if(resultImg) resultImg.hidden = true;

  try {
    const res = await fetch('/api/try-on', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.url) {
      if(resultImg) { resultImg.src = data.url; resultImg.hidden = false; }
      if(status) status.textContent = 'Success!';
    } else {
      if(status) status.textContent = 'Error: ' + (data.error || 'Unknown');
      if(placeholder) placeholder.hidden = false;
    }
  } catch (e) {
    if(status) status.textContent = 'Error: ' + e.message;
    if(placeholder) placeholder.hidden = false;
  }
}

function uploadPhoto() { alert('Use the Studio page to upload photos and generate try-ons.'); }
function sortProducts() { /* implement if needed */ }