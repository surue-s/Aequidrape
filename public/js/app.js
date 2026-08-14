/* Aequidrape — single source of truth for frontend logic */

const STATE = {
  page: 'home',
  profile: JSON.parse(localStorage.getItem('aequidrape_profile') || 'null'),
  cart: JSON.parse(localStorage.getItem('aequidrape_cart') || '[]'),
  modifications: JSON.parse(localStorage.getItem('aequidrape_mods') || '{}'),
  customPhotos: {}, 
  products: [],
  garmentId: null,
  current: null,
  insight: null,
  filters: new Set(),
  photo: { key: 'standing', src: '/demo-images/01-standing-original.jpg', custom: false, base64: null },
  garment: { base64: null, modifiedUrl: null, custom: false },
  tryOnReady: false,
  workshopGarment: null,
  workshopHistory: [],
  workshopState: JSON.parse(localStorage.getItem('aequidrape_workshop') || '{"garmentId": null, "history": [], "currentImageUrl": null}'),
  isListening: false,
  recognition: null
};

const PHOTOS = {
  standing: '/demo-images/01-standing-original.jpg',
  seated: '/demo-images/02-seated-original.jpg',
  wheelchair: '/demo-images/03-wheelchair-original.jpg',
  prosthetic: '/demo-images/04-prosthetic-original.jpg',
};

var DEX_MAP = ['standard', 'limited', 'one_handed', 'no_hands'];
var DEX_LABELS = ['Full use of both hands', 'Limited grip or strength', 'One hand available', 'No hands'];

/* ---------- Pressure Zone Rules ---------- */
function getPressureZones(profile, garment) {
  const zones = [];
  if (!profile || !garment) return zones;

  if (profile.posture === 'seated') {
    zones.push({
      location: 'Chest / Upper Hip',
      severity: garment.stretch === 'slight' ? 'high' : 'medium',
      reason: 'Seated posture increases pressure at chest and hip. ' +
        (garment.stretch === 'slight' ? 'Low-stretch fabric (' + (garment.fabric || 'standard') + ') amplifies restriction.' : 'Moderate stretch partially accommodates.')
    });
    zones.push({
      location: 'Lower Back',
      severity: garment.back_rise !== 'high' ? 'high' : 'low',
      reason: garment.back_rise !== 'high'
        ? 'Standard back rise may gap or expose lower back when seated.'
        : 'High back rise provides seated coverage.'
    });
    zones.push({
      location: 'Knees / Lap',
      severity: 'medium',
      reason: 'Seated posture creates sustained pressure at knee and lap areas. Check seam placement.'
    });
  }

  if (profile.mobility_aids && profile.mobility_aids.includes('prosthetic-leg')) {
    zones.push({
      location: 'Prosthetic Interface',
      severity: garment.stretch === 'slight' ? 'high' : 'medium',
      reason: 'Prosthetic socket requires asymmetric ease. ' +
        (garment.stretch === 'slight' ? 'Low-stretch fabric may restrict donning/doffing.' : 'Stretch allows accommodation.')
    });
  }
  if (profile.mobility_aids && profile.mobility_aids.includes('prosthetic-arm')) {
    zones.push({
      location: 'Shoulder / Armhole',
      severity: 'medium',
      reason: 'Prosthetic arm may require wider armhole or adaptive closure at shoulder.'
    });
  }

  if (profile.sensory && profile.sensory.includes('tag-free')) {
    zones.push({
      location: 'Neckline / Tags',
      severity: 'high',
      reason: 'Sensory sensitivity at neckline. Tags must be removed or printed.'
    });
  }
  if (profile.sensory && profile.sensory.includes('soft-fabric')) {
    zones.push({
      location: 'All Contact Points',
      severity: /fleece|cotton/i.test(garment.fabric || '') ? 'low' : 'high',
      reason: /fleece|cotton/i.test(garment.fabric || '')
        ? (garment.fabric || 'Material') + ' is generally soft against skin.'
        : (garment.fabric || 'Material') + ' may cause sensory irritation at direct contact points.'
    });
  }

  if (profile.mobility_aids && (profile.mobility_aids.includes('manual-wheelchair') || profile.mobility_aids.includes('power-chair'))) {
    zones.push({
      location: 'Back / Seat Interface',
      severity: 'high',
      reason: 'Sustained pressure between garment and wheelchair seat. Check for bunching fabric and seam ridges.'
    });
    zones.push({
      location: 'Elbows / Armrests',
      severity: 'medium',
      reason: 'Repeated friction at armrest contact points. Reinforced or flat seams recommended.'
    });
  }

  if (profile.dexterity === 'limited' || profile.dexterity === 'one_handed' || profile.dexterity === 'no_hands') {
    zones.push({
      location: 'Closure Points',
      severity: /button/i.test(garment.closure_type || '') ? 'high' : 'medium',
      reason: profile.dexterity === 'no_hands'
        ? 'No-hand use requires fully automated or adaptive closures (magnetic, velcro, or pullover).'
        : /button/i.test(garment.closure_type || '')
          ? 'Button closures create pressure points that are difficult to manage with limited dexterity.'
          : (garment.closure_type || 'Standard') + ' closure minimizes fine-motor pressure points.'
    });
    if (profile.dexterity === 'no_hands') {
      zones.push({
        location: 'Donning / Doffing Points',
        severity: 'high',
        reason: 'Garment must be donnable without hand use. Consider open-back designs, magnetic closures, or pull-on styles.'
      });
    }
  }

  return zones;
}

function renderPressureZones() {
  const g = catalog().find(function(p) { return p.id === STATE.garmentId; }) || STATE.workshopGarment || STATE.current;
  if (!g || !STATE.profile) return;

  const zones = getPressureZones(STATE.profile, g);
  const panel = document.getElementById('pressure-panel');
  const container = document.getElementById('pressure-zones');
  if (!panel || !container) return;

  if (zones.length === 0) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  container.innerHTML = zones.map(function(z) {
    return '<div class="pressure-zone">' +
      '<span class="pressure-dot ' + z.severity + '"></span>' +
      '<div class="zone-info">' +
        '<h4>' + z.location + ' <small style="color:var(--ink-3); font-weight:400;">(' + z.severity + ')</small></h4>' +
        '<p>' + z.reason + '</p>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderStudioChat() {
  var chatPanel = document.getElementById('studio-chat');
  var chatBody = document.getElementById('studio-chat-body');
  if (!chatPanel || !chatBody) return;

  if (!STATE.workshopState.history || STATE.workshopState.history.length === 0) {
    chatPanel.hidden = true;
    return;
  }

  chatPanel.hidden = false;
  chatBody.innerHTML = '';
  STATE.workshopState.history.forEach(function(h) {
    var aiMsg = document.createElement('div');
    aiMsg.className = 'chat-msg ai';
    aiMsg.innerHTML = '<strong>Applied:</strong> ' + h.prompt + '<br/><img src="' + h.imageUrl + '" alt="Modified" />';
    chatBody.appendChild(aiMsg);
  });
  chatBody.scrollTop = chatBody.scrollHeight;
}

function renderWorkshopHistory() {
  var chatBody = document.getElementById('ws-chat-body');
  if (!chatBody) return;
  chatBody.innerHTML = '';
  
  if (!STATE.workshopState.history || STATE.workshopState.history.length === 0) {
    chatBody.innerHTML = '<div class="chat-msg system">Select this garment to see how it can be adapted. Type a modification below.</div>';
    return;
  }
  
  STATE.workshopState.history.forEach(function(h) {
    var aiMsg = document.createElement('div');
    aiMsg.className = 'chat-msg ai';
    aiMsg.innerHTML = '<strong>Adaptation Applied:</strong> ' + h.prompt + '<br/><img src="' + h.imageUrl + '" alt="Modified" />';
    chatBody.appendChild(aiMsg);
  });
  chatBody.scrollTop = chatBody.scrollHeight;
}

function navigateToWorkshop() {
  if (!STATE.workshopState.garmentId) {
    alert('Please select a garment from the Shop to start modifying.');
    navigateTo('shop');
    return;
  }
  navigateTo('home');
  setTimeout(function() { 
    var studio = document.getElementById('studio'); 
    if (studio) studio.scrollIntoView({ behavior: 'smooth' }); 
  }, 100);
}

function toggleVoiceInput(inputId, btnId) {
  var input = document.getElementById(inputId);
  var micBtn = document.getElementById(btnId);
  
  if (!input || !micBtn) return;
  
  var SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionAPI) {
    alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
    return;
  }
  
  if (STATE.isListening && STATE.recognition) {
    STATE.recognition.stop();
    return;
  }
  
  STATE.recognition = new SpeechRecognitionAPI();
  STATE.recognition.continuous = false;
  STATE.recognition.interimResults = false;
  STATE.recognition.lang = 'en-US';
  
  STATE.recognition.onstart = function() {
    STATE.isListening = true;
    micBtn.classList.add('listening');
    input.placeholder = 'Listening... speak now';
  };
  
  STATE.recognition.onresult = function(event) {
    var transcript = event.results[0][0].transcript;
    input.value = input.value ? input.value + ' ' + transcript : transcript;
  };
  
  STATE.recognition.onerror = function(event) {
    STATE.isListening = false;
    micBtn.classList.remove('listening');
    input.placeholder = inputId === 'ws-prompt' 
      ? 'e.g. replace buttons with magnets' 
      : 'e.g. add a full zipper on the left side';
    if (event.error === 'not-allowed') {
      alert('Microphone access denied. Please allow microphone permissions.');
    }
  };
  
  STATE.recognition.onend = function() {
    STATE.isListening = false;
    micBtn.classList.remove('listening');
    input.placeholder = inputId === 'ws-prompt' 
      ? 'e.g. replace buttons with magnets' 
      : 'e.g. add a full zipper on the left side';
  };
  
  STATE.recognition.start();
}

/* ---------- Comfort Engine ---------- */
function getComfortInsights(profile, garment) {
  const insights = [];
  const prompts = [];
  if (!profile || !garment) return { insights: insights, prompts: prompts };

  if (profile.posture === 'seated') {
    insights.push('Seated posture requires 15-20mm additional ease at hip and chest to prevent pressure points.');
    prompts.push('add 15mm wearing ease at hip and chest areas');
  }
  if (profile.mobility_aids && profile.mobility_aids.includes('prosthetic-leg')) {
    insights.push('Prosthetic accommodation requires asymmetric ease distribution around the residual limb.');
    prompts.push('add asymmetric ease panels around prosthetic area');
  }
  if (profile.sensory && profile.sensory.includes('soft-fabric')) {
    insights.push('Sensory needs require zero-pressure contact at fit points (shoulders, underarms).');
    prompts.push('add flat-lock seams and remove all pressure points at contact areas');
  }
  
  if (profile.dexterity === 'limited' || profile.dexterity === 'one_handed' || profile.dexterity === 'no_hands') {
    if (/button/i.test(garment.closure_type || '')) {
      insights.push('Standard buttons require fine motor skills.');
      prompts.push('replace buttons with magnetic closures');
    }
    if (profile.dexterity === 'no_hands') {
      insights.push('No-hand use requires fully adaptive closures or pullover designs.');
      prompts.push('convert to pullover style with open-back or magnetic front closure');
    }
  }
  
  return { insights: insights, prompts: prompts };
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', async function() {
  if (window.AOS) AOS.init({ duration: 700, once: true, disable: matchMedia('(prefers-reduced-motion: reduce)').matches });
  updateProfileBadge();
  await loadProducts();
  renderGarmentList();
  
  const stage = document.getElementById('stage');
  if (stage) {
    let isDragging = false;
    const updateSlider = function(e) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const rect = stage.getBoundingClientRect();
      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.max(0, Math.min(100, pct));
      setCmp(pct);
    };
    const startDrag = function(e) { if (!STATE.tryOnReady) return; isDragging = true; updateSlider(e); e.preventDefault(); };
    const endDrag = function() { isDragging = false; };
    const moveDrag = function(e) { if (!isDragging || !STATE.tryOnReady) return; updateSlider(e); e.preventDefault(); };

    stage.addEventListener('mousedown', startDrag);
    stage.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('touchmove', moveDrag, { passive: false });
  }

  window.addEventListener('hashchange', function() { navigateTo(location.hash.slice(1) || 'home'); });
  navigateTo(location.hash.slice(1) || 'home');
});

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) STATE.products = await res.json();
  } catch (e) {}
  if (!STATE.products.length) STATE.products = [
    { id: 'adaptive-jacket-001', name: 'Jacket', closure_type: 'zipper', stretch: 'moderate', back_rise: 'medium', seams: 'Standard', pocket_access: 'Side pockets', price: 140, description: 'Everyday zip jacket.', image_path: 'garments/jacket.jpg' },
  ];
  renderProducts();
}

function catalog() { return STATE.products; }
function priceOf(g) { return g.price ? g.price : 0; }

/* ---------- cart ---------- */
function addToCart(id) {
  if (STATE.cart.indexOf(id) === -1) {
    STATE.cart.push(id);
    localStorage.setItem('aequidrape_cart', JSON.stringify(STATE.cart));
    updateCartUI();
  }
}

function removeFromBag(id) {
  STATE.cart = STATE.cart.filter(function(cId) { return cId !== id; });
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
    cartBtn.textContent = STATE.cart.indexOf(STATE.current.id) !== -1 ? 'In bag' : 'Add to try-on bag';
    cartBtn.disabled = STATE.cart.indexOf(STATE.current.id) !== -1;
  }
}

/* ---------- routing ---------- */
function navigateTo(page) {
  let el = document.getElementById(page + '-page');
  if (!el) { page = 'home'; el = document.getElementById('home-page'); }
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
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
function updateDexLabel(v) { var el = document.getElementById('dex-label'); if (el) el.textContent = DEX_LABELS[+v]; }

function updateProfileBadge() {
  var text = document.getElementById('badge-text');
  var badge = document.getElementById('profile-badge');
  if (STATE.profile) {
    var p = { seated: 'Seated', standing: 'Standing', mixed: 'Mixed' }[STATE.profile.posture] || 'Set';
    var d = { standard: 'Full use', limited: 'Limited', one_handed: '1-hand', no_hands: 'No hands' }[STATE.profile.dexterity] || '';
    text.textContent = p + ' | ' + d;
    badge.classList.add('set');
  } else { text.textContent = 'Set profile'; badge.classList.remove('set'); }
}

function saveProfile() {
  var f = document.getElementById('profile-form');
  var postureEl = f.querySelector('input[name="posture"]:checked');
  if (!postureEl) { document.getElementById('profile-status').textContent = 'Choose a posture to continue.'; return; }

  var dexEl = f.querySelector('input[name="dexterity"]:checked');

  STATE.profile = {
    posture: postureEl.value,
    dexterity: dexEl ? dexEl.value : 'standard',
    dex_notes: document.getElementById('dex-notes').value.trim(),
    sensory: Array.from(f.querySelectorAll('input[name="sensory"]:checked')).map(function(i) { return i.value; }),
    mobility_aids: Array.from(f.querySelectorAll('input[name="mobility_aids"]:checked')).map(function(i) { return i.value; }),
    aid_other: document.getElementById('aid-other').value.trim(),
    fit_concerns: Array.from(f.querySelectorAll('input[name="fit_concerns"]:checked')).map(function(i) { return i.value; }),
    measurements: {
      height: document.getElementById('m-height').value || null,
      neck: document.getElementById('m-neck').value || null,
      chest: document.getElementById('m-chest').value || null,
      waist: document.getElementById('m-waist').value || null,
      hip: document.getElementById('m-hip').value || null,
      shoulder: document.getElementById('m-shoulder').value || null,
      arm: document.getElementById('m-arm').value || null,
      inseam: document.getElementById('m-inseam').value || null
    }
  };
  localStorage.setItem('aequidrape_profile', JSON.stringify(STATE.profile));
  updateProfileBadge();
  renderPressureZones();
  navigateTo('shop');
}

function applyNeed(kind) {
  if (!STATE.profile) STATE.profile = { posture: 'seated', dexterity: 'standard', sensory: [], mobility_aids: [], fit_concerns: [], dex_notes: '', aid_other: '', measurements: {} };
  if (kind === 'seated') STATE.profile.posture = 'seated';
  if (kind === 'one_handed') STATE.profile.dexterity = 'one_handed';
  if (kind === 'sensory') STATE.profile.sensory = ['tag-free'];
  if (kind === 'prosthetic') STATE.profile.mobility_aids = ['prosthetic-leg'];
  updateProfileBadge();
  renderPressureZones();
  navigateTo('shop');
}

/* ---------- studio: photo ---------- */
function selectPhoto(key, btn) {
  document.querySelectorAll('.photo-rail .thumb-btn').forEach(function(b) { 
    b.classList.remove('active'); 
  });
  btn.classList.add('active');

  if (STATE.customPhotos && STATE.customPhotos[key]) {
    STATE.photo = { key: key, src: STATE.customPhotos[key], custom: true, base64: STATE.customPhotos[key] };
    document.getElementById('stage-before').src = STATE.customPhotos[key];
    document.getElementById('consent-row').hidden = false;
  } else if (PHOTOS[key]) {
    STATE.photo = { key: key, src: PHOTOS[key], custom: false, base64: null };
    document.getElementById('stage-before').src = PHOTOS[key];
    document.getElementById('consent-row').hidden = true;
  }
  
  resetStage();
}

function uploadPhoto() { document.getElementById('photo-upload').click(); }

async function resizeAndCompress(file, maxSize) {
  maxSize = maxSize || 1024;
  return new Promise(function(resolve) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
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
  
  resizeAndCompress(file).then(function(base64) {
    const customKey = 'custom_' + Date.now();
    
    if (!STATE.customPhotos) STATE.customPhotos = {};
    STATE.customPhotos[customKey] = base64;
    STATE.photo = { key: customKey, src: base64, custom: true, base64: base64 };
    
    document.getElementById('stage-before').src = base64;
    document.getElementById('consent-row').hidden = false;
    resetStage();

    const rail = document.querySelector('.photo-rail');
    const uploadBtn = rail.querySelector('.thumb-btn.upload');
    
    rail.querySelectorAll('.thumb-btn').forEach(function(b) { 
      b.classList.remove('active'); 
    });

    const newBtn = document.createElement('button');
    newBtn.className = 'thumb-btn active';
    newBtn.innerHTML = '<img src="' + base64 + '" alt="Your upload" />';
    newBtn.onclick = function() {
      selectPhoto(customKey, newBtn);
    };
    
    rail.insertBefore(newBtn, uploadBtn);
    input.value = '';
  });
}

/* ---------- studio: garment ---------- */
function renderGarmentList() {
  const list = document.getElementById('garment-list');
  if (!list) return;
  
  const cartItems = catalog().filter(function(g) { return STATE.cart.indexOf(g.id) !== -1; });
  if (cartItems.length === 0) {
    list.innerHTML = '<p style="color:var(--ink-2); padding: 12px 0; font-size: 0.95rem; text-align: center;">Your try-on bag is empty.<br/>Add garments from the shop to try them on.</p>';
    return;
  }
  
  list.innerHTML = cartItems.map(function(g) {
    const isModified = STATE.modifications[g.id];
    const isActive = STATE.garmentId === g.id;
    return '<div class="garment-opt-wrap" style="display:flex; gap:8px; align-items:center;">' +
      '<button class="garment-opt ' + (isActive ? 'active' : '') + '" onclick="selectGarment(\'' + g.id + '\', this)" style="flex:1;">' +
      '<span><strong>' + g.name + ' ' + (isModified ? '<small style="color:var(--accent); font-weight:600;">(Modified)</small>' : '') + '</strong><small>' + g.closure_type + '</small></span>' +
      '<span class="price">$' + priceOf(g) + '</span></button>' +
      '<button class="remove-btn" onclick="event.stopPropagation(); removeFromBag(\'' + g.id + '\')" aria-label="Remove from bag"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>';
  }).join('');
}

function selectGarment(id, btn) {
  STATE.garmentId = id;
  STATE.garment = { base64: null, modifiedUrl: STATE.modifications[id] ? STATE.modifications[id].url : null, custom: false };
  
  document.querySelectorAll('.garment-opt').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  
  var prev = document.getElementById('garment-preview');
  if (STATE.garment.modifiedUrl) {
    prev.hidden = false;
    document.getElementById('garment-preview-img').src = STATE.garment.modifiedUrl;
    document.getElementById('garment-preview-label').textContent = 'Modified: ' + (STATE.modifications[id] ? STATE.modifications[id].prompt : '');
  } else {
    prev.hidden = true;
  }
  document.getElementById('modify-status').textContent = '';
  renderPressureZones();

  STATE.workshopGarment = catalog().find(function(p) { return p.id === id; });
  if (STATE.workshopState.garmentId === id && STATE.workshopState.history.length > 0) {
    renderStudioChat();
  } else {
    var chatPanel = document.getElementById('studio-chat');
    if (chatPanel) chatPanel.hidden = true;
  }
}

function onGarmentFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  resizeAndCompress(file).then(function(base64) {
    STATE.garmentId = null;
    STATE.garment = { base64: base64, modifiedUrl: null, custom: true };
    document.querySelectorAll('.garment-opt').forEach(function(b) { b.classList.remove('active'); });
    const prev = document.getElementById('garment-preview');
    prev.hidden = false;
    document.getElementById('garment-preview-img').src = base64;
    document.getElementById('garment-preview-label').textContent = 'Your garment';
  });
}

async function toBase64(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise(function(resolve) {
    const fr = new FileReader();
    fr.onload = function() { resolve(fr.result); };
    fr.readAsDataURL(blob);
  });
}

async function currentGarmentBase64() {
  if (STATE.garment.base64) return STATE.garment.base64;
  const g = catalog().find(function(p) { return p.id === STATE.garmentId; });
  if (g && g.image_path) return toBase64('/' + g.image_path);
  return null;
}

async function runModification() {
  var prompt = document.getElementById('modify-prompt').value.trim();
  var status = document.getElementById('modify-status');
  if (!prompt) { status.textContent = 'Describe a modification first.'; return; }
  var base64 = await currentGarmentBase64();
  if (!base64) { status.textContent = 'Pick or upload a garment first.'; return; }

  var easeEl = document.getElementById('ws-ease-purpose');
  var easePurpose = easeEl ? easeEl.value : 'basic';
  var fullPrompt = prompt + ' (purpose: ' + easePurpose + ')';

  status.textContent = 'Modifying garment... Please wait.';
  var modBtn = document.querySelector('.studio-panel.right .ai-input-wrapper button:last-child');
  if (modBtn) { modBtn.disabled = true; modBtn.textContent = 'Working...'; }

  var chatBody = document.getElementById('studio-chat-body');
  var chatPanel = document.getElementById('studio-chat');
  if (chatBody && chatPanel) {
    chatPanel.hidden = false;
    var userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.textContent = fullPrompt;
    chatBody.appendChild(userMsg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  document.getElementById('modify-prompt').value = '';

  try {
    var res = await fetch('/api/modify-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64, prompt: fullPrompt }),
    });
    var data = await res.json();
    if (data.url) {
      if (STATE.garmentId) {
        STATE.modifications[STATE.garmentId] = { prompt: fullPrompt, url: data.url };
        localStorage.setItem('aequidrape_mods', JSON.stringify(STATE.modifications));
        renderGarmentList();
      }

      STATE.workshopState.garmentId = STATE.garmentId;
      STATE.workshopState.history.push({ prompt: fullPrompt, imageUrl: data.url });
      STATE.workshopState.currentImageUrl = data.url;
      localStorage.setItem('aequidrape_workshop', JSON.stringify(STATE.workshopState));

      STATE.workshopGarment = catalog().find(function(p) { return p.id === STATE.garmentId; });

      STATE.garment.modifiedUrl = data.url;
      var prev = document.getElementById('garment-preview');
      prev.hidden = false;
      document.getElementById('garment-preview-img').src = data.url;
      document.getElementById('garment-preview-label').textContent = 'Modified: ' + fullPrompt;
      status.textContent = 'Garment modified. Ready for try-on.';

      if (chatBody) {
        var aiMsg = document.createElement('div');
        aiMsg.className = 'chat-msg ai';
        aiMsg.innerHTML = '<strong>Applied:</strong> ' + fullPrompt + '<br/><img src="' + data.url + '" alt="Modified" />';
        chatBody.appendChild(aiMsg);
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    } else {
      status.textContent = 'Modification failed: ' + (data.error || 'unknown error');
    }
  } catch (e) {
    status.textContent = 'Modification failed: ' + e.message;
  } finally {
    if (modBtn) { modBtn.disabled = false; modBtn.textContent = 'Modify'; }
  }
}

/* ---------- studio: try-on ---------- */
function resetStage() {
  STATE.tryOnReady = false;
  ['layer-after', 'tag-after', 'cmp-line', 'cmp-knob', 'cmp-range'].forEach(function(id) { var el = document.getElementById(id); if (el) el.hidden = true; });
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
      await new Promise(function(resolve) {
        afterImg.onload = resolve;
        afterImg.onerror = resolve;
        afterImg.src = data.url + (data.url.indexOf('?') !== -1 ? '&' : '?') + '_t=' + Date.now();
      });
      ['layer-after', 'tag-after', 'cmp-line', 'cmp-knob', 'cmp-range'].forEach(function(id) { var el = document.getElementById(id); if (el) el.hidden = false; });
      STATE.tryOnReady = true;
      setCmp(50);
      status.textContent = data.status === 'cached' 
        ? 'Cached render ready. Drag to compare.' 
        : 'Render ready. Drag to compare. (AI fit may vary for prosthetics & seated postures due to current model limitations)';
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
  const g = catalog().find(function(p) { return p.id === STATE.garmentId; }) || STATE.current;
  if (!g) return;
  let insight = null;
  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_profile: STATE.profile || { posture: 'seated', dexterity: 'limited', sensory: [], mobility_aids: [], fit_concerns: [] }, garment_id: g.id }),
    });
    if (res.ok) { const data = await res.json(); insight = data.insight || data; }
  } catch (e) {}
  if (!insight) insight = { compatibility: [], risks: [], questions_for_seller: [], summary: '' };

  const notes = [STATE.profile ? STATE.profile.dex_notes : '', STATE.profile ? STATE.profile.aid_other : ''].filter(Boolean).join('; ');
  if (notes) insight.questions_for_seller = (insight.questions_for_seller || []).concat(['Can this garment accommodate: ' + notes + '?']);

  STATE.insight = insight;
  renderNotes(insight, g);
}

function fillList(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  const title = el.querySelector('h4');
  el.innerHTML = (title ? title.outerHTML : '') +
    (items && items.length ? items.map(function(t) { return '<li><span>' + t + '</span></li>'; }).join('') : '<li><span>Nothing flagged.</span></li>');
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
  const parts = (STATE.insight.compatibility || []).concat(STATE.insight.risks || []);
  speechSynthesis.speak(new SpeechSynthesisUtterance(parts.join('. ') || 'No fit notes yet.'));
}

/* ---------- shop ---------- */
function renderProducts(containerId, list) {
  containerId = containerId || 'products';
  var container = document.getElementById(containerId);
  if (!container) return;
  var items = list || catalog().slice();
  if (!list && STATE.filters.size) {
    items = items.filter(function(g) { return Array.from(STATE.filters).every(function(f) { return (g.closure_type || '').indexOf(f) !== -1 || (g.tags || []).indexOf(f) !== -1; }); });
  }
  var sort = document.getElementById('sort-select') ? document.getElementById('sort-select').value : '';
  if (sort === 'price-low') items.sort(function(a, b) { return priceOf(a) - priceOf(b); });
  if (sort === 'price-high') items.sort(function(a, b) { return priceOf(b) - priceOf(a); });
  
  container.innerHTML = items.map(function(g) {
    var inCart = STATE.cart.indexOf(g.id) !== -1;
    return '<article class="p-card" onclick="showProduct(\'' + g.id + '\')">' +
      '<div class="p-media">' +
      '<img src="/' + g.image_path + '" alt="' + g.name + '" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display=\'none\'" />' +
      '<span class="flag">' + g.closure_type + '</span>' +
      '<div class="cart-actions">' +
      '<button class="quick ' + (inCart ? 'hidden' : '') + '" onclick="event.stopPropagation(); addToCart(\'' + g.id + '\')">Add to bag</button>' +
      '<button class="quick remove ' + (!inCart ? 'hidden' : '') + '" onclick="event.stopPropagation(); removeFromBag(\'' + g.id + '\')">Remove</button>' +
      '<button class="quick modify" onclick="event.stopPropagation(); openWorkshop(\'' + g.id + '\')">Modify</button>' +
      '</div></div>' +
      '<div class="p-body"><h3>' + g.name + '</h3><p class="meta">' + (g.fabric || '') + ' | ' + g.stretch + ' stretch</p><div class="row"><span class="price">$' + priceOf(g) + '</span></div></div></article>';
  }).join('') || '<p style="color:var(--ink-2)">No garments match these filters.</p>';
}

function toggleFilter(btn) {
  var f = btn.dataset.filter;
  if (STATE.filters.has(f)) STATE.filters.delete(f); else STATE.filters.add(f);
  btn.classList.toggle('active');
  renderProducts();
}

function sortProducts() { renderProducts(); }

/* ---------- product detail ---------- */
function showProduct(id) {
  var g = catalog().find(function(p) { return p.id === id; });
  if (!g) return;
  STATE.current = g;
  document.getElementById('breadcrumb-text').textContent = g.name;
  document.getElementById('product-name').textContent = g.name;
  document.getElementById('product-price').textContent = '$' + priceOf(g);
  document.getElementById('product-description').textContent = g.description || '';
  document.getElementById('detail-img').src = '/' + g.image_path;
  var set = function(sid, v) { var el = document.getElementById(sid); if (el) el.textContent = v || '-'; };
  set('spec-closure', g.closure_type); set('spec-back-rise', g.back_rise);
  set('spec-stretch', g.stretch); set('spec-seams', g.seams); set('spec-pockets', g.pocket_access);
  
  var cartBtn = document.getElementById('add-to-cart-btn');
  if (cartBtn) {
    cartBtn.textContent = STATE.cart.indexOf(g.id) !== -1 ? 'In bag' : 'Add to try-on bag';
    cartBtn.disabled = STATE.cart.indexOf(g.id) !== -1;
    cartBtn.onclick = function() {
      addToCart(g.id);
      cartBtn.textContent = 'Added to bag';
      cartBtn.disabled = true;
    };
  }

  evaluate().then(function() {
    if (STATE.insight) {
      fillList('d-ok', STATE.insight.compatibility);
      fillList('d-warn', STATE.insight.risks);
      fillList('d-ask', STATE.insight.questions_for_seller);
      var q = document.getElementById('questions-list');
      if (q) q.innerHTML = (STATE.insight.questions_for_seller || []).map(function(t) { return '<label class="q-item"><input type="checkbox" /><span>' + t + '</span></label>'; }).join('');
    }
    
    var comfort = getComfortInsights(STATE.profile, g);
    var adaptPanel = document.getElementById('adapt-list');
    if (adaptPanel) {
      var html = '<h4 style="margin-bottom:12px; color:var(--accent);">AI Comfort Assessment</h4>';
      if (comfort.insights.length === 0) {
        html += '<p style="color:var(--ink-2); font-size:14px;">This garment is highly compatible with your profile.</p>';
      } else {
        html += '<ul style="margin-bottom:16px; list-style:none; padding:0;">' + comfort.insights.map(function(i) { return '<li style="margin-bottom:8px; font-size:14px; color:var(--ink-2); display:flex; gap:8px;"><span style="color:var(--warn);">!</span> ' + i + '</li>'; }).join('') + '</ul>';
      }
      if (comfort.prompts.length > 0) {
        html += '<h4 style="margin-bottom:12px;">Suggested Workshop Modifications</h4>';
        html += comfort.prompts.map(function(p) {
          return '<div class="ai-input-wrapper" style="margin-bottom:10px;"><input type="text" value="' + p + '" id="prompt-' + g.id + '" readonly /><button onclick="quickModify(\'' + g.id + '\', \'' + p + '\')">Modify</button></div>';
        }).join('');
      }
      adaptPanel.innerHTML = html;
    }
  });
  
  renderPressureZones();
  navigateTo('product');
}

function quickModify(garmentId, prompt) {
  openWorkshop(garmentId);
  setTimeout(function() {
    var promptInput = document.getElementById('ws-prompt');
    if (promptInput) {
      promptInput.value = prompt;
      runWorkshopMod();
    }
  }, 200);
}

/* ---------- WORKSHOP LOGIC ---------- */
function openWorkshop(garmentId) {
  if (STATE.cart.indexOf(garmentId) === -1) addToCart(garmentId);
  var g = catalog().find(function(p) { return p.id === garmentId; });
  STATE.workshopGarment = g;
  STATE.garmentId = garmentId;
  renderGarmentList();

  document.getElementById('ws-original').src = '/' + g.image_path;
  
  if (STATE.workshopState.garmentId === garmentId && STATE.workshopState.history && STATE.workshopState.history.length > 0) {
    document.getElementById('ws-current').src = STATE.workshopState.currentImageUrl;
    renderWorkshopHistory();
  } else {
    STATE.workshopState = { garmentId: garmentId, history: [], currentImageUrl: '/' + g.image_path };
    localStorage.setItem('aequidrape_workshop', JSON.stringify(STATE.workshopState));
    document.getElementById('ws-current').src = '/' + g.image_path;
    var chatBody = document.getElementById('ws-chat-body');
    if (chatBody) chatBody.innerHTML = '<div class="chat-msg system">Type a modification below to adapt this garment.</div>';
  }
  
  document.getElementById('ws-email-output').hidden = true;
  renderPressureZones();
  navigateTo('workshop');
}

async function runWorkshopMod() {
  var prompt = document.getElementById('ws-prompt').value.trim();
  var status = document.getElementById('ws-status');
  if (!prompt) { status.textContent = 'Describe a modification first.'; return; }

  var easeEl = document.getElementById('ws-ease-purpose');
  var easePurpose = easeEl ? easeEl.value : 'basic';
  var fullPrompt = prompt + ' (wearing purpose: ' + easePurpose + ')';
  
  var currentImg = document.getElementById('ws-current').src;
  var base64 = await toBase64(currentImg);
  
  status.textContent = 'Applying modification... Please wait.';
  var applyBtn = document.querySelector('#workshop-page .ai-input-wrapper button:last-child');
  if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = 'Working...'; }
  
  var chatBody = document.getElementById('ws-chat-body');
  
  var userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.textContent = fullPrompt;
  chatBody.appendChild(userMsg);
  chatBody.scrollTop = chatBody.scrollHeight;
  
  document.getElementById('ws-prompt').value = '';
  
  try {
    var res = await fetch('/api/modify-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64, prompt: fullPrompt }),
    });
    var data = await res.json();
    if (data.url) {
      STATE.workshopHistory.push({ prompt: fullPrompt, imageUrl: data.url });
      
      STATE.workshopState.history.push({ prompt: fullPrompt, imageUrl: data.url });
      STATE.workshopState.currentImageUrl = data.url;
      localStorage.setItem('aequidrape_workshop', JSON.stringify(STATE.workshopState));
      
      document.getElementById('ws-current').src = data.url;
      
      if (STATE.workshopGarment) {
        STATE.modifications[STATE.workshopGarment.id] = { prompt: fullPrompt, url: data.url };
        localStorage.setItem('aequidrape_mods', JSON.stringify(STATE.modifications));
      }
      
      var aiMsg = document.createElement('div');
      aiMsg.className = 'chat-msg ai';
      aiMsg.innerHTML = '<strong>Adaptation Applied:</strong> ' + fullPrompt + '<br/><img src="' + data.url + '" alt="Modified" />';
      chatBody.appendChild(aiMsg);
      chatBody.scrollTop = chatBody.scrollHeight;
      
      status.textContent = 'Ready for next modification.';
    } else {
      status.textContent = 'Modification failed: ' + (data.error || 'unknown error');
    }
  } catch (e) {
    status.textContent = 'Modification failed: ' + e.message;
  } finally {
    if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Apply Change'; }
  }
}

async function generateEmail() {
  var status = document.getElementById('ws-status');
  var history = STATE.workshopState.history || [];
  var garment = STATE.workshopGarment || catalog().find(function(p) { return p.id === STATE.garmentId; });
  
  if (history.length === 0) { status.textContent = 'Make at least one modification first.'; return; }
  
  status.textContent = 'Drafting intelligent email with AI...';
  try {
    var res = await fetch('/api/generate-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: STATE.profile || {},
        garment: garment || {},
        history: history
      })
    });
    var data = await res.json();
    
    if (res.ok && data.email) {
      document.getElementById('ws-email-text').value = data.email;
      document.getElementById('ws-email-output').hidden = false;
      status.textContent = 'AI Email draft ready.';
    } else {
      status.textContent = 'AI failed: ' + (data.error || 'Unknown error.');
    }
  } catch (e) {
    status.textContent = 'Network error: ' + e.message;
  }
}

function tryOnThis() {
  if (STATE.current) {
    if (STATE.cart.indexOf(STATE.current.id) === -1) addToCart(STATE.current.id);
    STATE.garmentId = STATE.current.id;
    renderGarmentList();
  }
  navigateTo('home');
  setTimeout(function() { var el = document.getElementById('studio'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 60);
}

function toggleGaugeDetails(e) {
  var body = document.getElementById('gauge-details');
  if (!body) return;
  var open = body.hidden;
  body.hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', String(open));
}

function switchTab(name, e) {
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
  var target = document.getElementById(name);
  if (target) target.classList.add('active');
  e.currentTarget.classList.add('active');
  e.currentTarget.setAttribute('aria-selected', 'true');
}