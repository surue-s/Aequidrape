// Centralized application state
const STATE = {
  currentPage: 'shop',
  userProfile: JSON.parse(localStorage.getItem('userProfile')) || null,
  products: [],
  currentProduct: null,
};

// DOM Elements
const dom = {
  appContainer: () => document.getElementById('app'),
  profileBadge: () => document.getElementById('profile-badge'),
  shopGrid: () => document.getElementById('product-grid'),
  productDetailContainer: () => document.getElementById('product-detail-container'),
  // Add other frequently accessed elements as needed
};

// Client-side fallback scoring function
function fallbackEvaluateGarment(garment) {
  // This is a simple heuristic and not a full replacement for the backend rules
  let score = 0;
  let compatibility = [];
  let risks = [];
  let summary = '';

  if (STATE.userProfile) {
    if (STATE.userProfile.dexterity === 'limited' && garment.closure_type.toLowerCase().includes('magnetic')) {
      score += 2;
      compatibility.push('Magnetic closure suits limited dexterity');
    }
    if (STATE.userProfile.posture === 'seated' && garment.back_rise === 'high') {
      score += 2;
      compatibility.push('High back rise suits seated posture');
    }
    if (STATE.userProfile.sensory.includes('tag-sensitive') && garment.tags.includes('tag-free')) {
      score += 1;
      compatibility.push('Tag-free design addresses sensitivity');
    }
  }

  if (score >= 4) {
    return {
      insight: {
        compatibility,
        risks,
        questions_for_seller: ['Can you confirm the ease of use for someone with limited dexterity?'],
        confidence: 'high',
        summary: 'This garment may work well for you based on your profile.'
      },
      audio_summary: 'This garment may work well for you based on your profile.',
      markdown_summary: '# Fallback Summary\n\nThis garment may work well for you based on your profile.',
      seller_email_template: 'Hello, I am interested in this item but need to check accessibility details.'
    };
  } else if (score >= 2) {
    return {
      insight: {
        compatibility,
        risks,
        questions_for_seller: ['Can you confirm the fit for my specific needs?'],
        confidence: 'moderate',
        summary: 'This garment may work for you, but check a few details first.'
      },
      audio_summary: 'This garment may work for you, but check a few details first.',
      markdown_summary: '# Fallback Summary\n\nThis garment may work for you, but check a few details first.',
      seller_email_template: 'Hello, I am interested in this item but need to check accessibility details.'
    };
  } else {
    return {
      insight: {
        compatibility: [],
        risks: ['No strong compatibility markers found for your profile.'],
        questions_for_seller: ['Is this suitable for my access needs?'],
        confidence: 'low',
        summary: 'This garment may not be a good fit for your access needs.'
      },
      audio_summary: 'This garment may not be a good fit for your access needs.',
      markdown_summary: '# Fallback Summary\n\nThis garment may not be a good fit for your access needs.',
      seller_email_template: 'Hello, I am interested in this item but need to check accessibility details.'
    };
  }
}


// API Integration Functions
async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    STATE.products = await response.json();
  } catch (error) {
    console.warn('Failed to load products from API, using fallback:', error);
    // Fallback data
    STATE.products = [
      {
        id: "adaptive-jacket-001",
        name: "Adaptive Jacket Demo",
        price: 99.99,
        image_url: "/demo-images/jacket.jpg",
        closure_type: "Magnetic",
        back_rise: "High",
        stretch: "High",
        tags: ["tag-free", "soft"]
      },
      {
        id: "adaptive-shirt-002",
        name: "Adaptive Shirt Demo",
        price: 49.99,
        image_url: "/demo-images/shirt.jpg",
        closure_type: "Zipper",
        back_rise: "Medium",
        stretch: "Moderate",
        tags: ["flat-seams-back"]
      },
      {
        id: "adaptive-pants-003",
        name: "Adaptive Pants Demo",
        price: 79.99,
        image_url: "/demo-images/pants.jpg",
        closure_type: "Hook and Loop",
        back_rise: "High",
        stretch: "Maximum",
        tags: ["tag-free", "soft"]
      },
      {
        id: "adaptive-dress-004",
        name: "Adaptive Dress Demo",
        price: 89.99,
        image_url: "/demo-images/dress.jpg",
        closure_type: "Button",
        back_rise: "Low",
        stretch: "None",
        tags: []
      },
      {
        id: "adaptive-skirt-005",
        name: "Adaptive Skirt Demo",
        price: 69.99,
        image_url: "/demo-images/skirt.jpg",
        closure_type: "Elastic",
        back_rise: "Medium",
        stretch: "High",
        tags: ["soft"]
      }
    ];
  }
  renderShopPage();
}

async function evaluateGarment(garmentId) {
  if (!STATE.userProfile) {
    console.error('Cannot evaluate without a user profile.');
    return null;
  }

  try {
    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_profile: STATE.userProfile,
        garment_id: garmentId
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('API evaluation failed, using fallback:', error);
    const garment = STATE.products.find(p => p.id === garmentId);
    if (garment) {
      return {
        ...fallbackEvaluateGarment(garment),
        garment: garment,
        timestamp: new Date().toISOString(),
        mode: 'fallback'
      };
    }
    return null;
  }
}


// DOM Rendering Functions
function renderShopPage() {
  const container = dom.shopGrid();
  if (!container) return;
  
  container.innerHTML = ''; // Clear existing content
  STATE.products.forEach(product => {
    container.appendChild(renderProductCard(product));
  });
}

function renderProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.setAttribute('tabindex', '0'); // Make focusable for keyboard nav
  card.setAttribute('role', 'button'); // Semantically a button
  card.setAttribute('aria-label', `View details for ${product.name}`); // ARIA label

  // Calculate a simple compatibility indicator if profile exists
  let compatText = '';
  if (STATE.userProfile) {
    // Use the fallback logic for a quick indicator
    const tempResult = fallbackEvaluateGarment(product);
    compatText = ` (${tempResult.insight.confidence} match)`;
  }

  card.innerHTML = `
    <img src="${product.image_url}" alt="${product.name}">
    <h3>${product.name}</h3>
    <p class="price">$${product.price.toFixed(2)}</p>
    <p class="compat-indicator">${compatText}</p>
  `;

  card.addEventListener('click', () => {
    STATE.currentProduct = product;
    window.location.hash = `#detail/${product.id}`;
  });

  return card;
}

function displayProductDetail() {
  const product = STATE.currentProduct;
  if (!product || !dom.productDetailContainer()) return;

  const container = dom.productDetailContainer();
  container.innerHTML = `
    <div class="product-header">
      <button onclick="history.back()" aria-label="Go back">← Back</button>
      <h1>${product.name}</h1>
    </div>
    <div class="product-content">
      <div class="image-section">
        <img src="${product.image_url}" alt="${product.name}">
      </div>
      <div class="details-section">
        <p class="price">$${product.price.toFixed(2)}</p>
        <div class="specs">
          <h3>Specs</h3>
          <ul>
            <li>Closure: ${product.closure_type}</li>
            <li>Back Rise: ${product.back_rise}</li>
            <li>Stretch: ${product.stretch}</li>
            <li>Tags: ${product.tags.join(', ')}</li>
          </ul>
        </div>
        <div class="tabs">
          <button class="tab-button active" data-tab="overview" onclick="switchTab('overview')" role="tab" aria-selected="true" aria-controls="panel-overview">Overview</button>
          <button class="tab-button" data-tab="compatibility" onclick="switchTab('compatibility')" role="tab" aria-selected="false" aria-controls="panel-compatibility">Compatibility</button>
        </div>
        <div id="panel-overview" class="tab-panel active" role="tabpanel">
          <p>Detailed description would go here...</p>
        </div>
        <div id="panel-compatibility" class="tab-panel" role="tabpanel" style="display: none;">
          <div id="compatibility-gauge"></div>
          <button id="speak-summary-btn" onclick="speakSummary()">Speak Summary</button>
        </div>
      </div>
    </div>
  `;

  // Load and render compatibility data
  loadAndRenderCompatibility();
}

async function loadAndRenderCompatibility() {
  if (!STATE.currentProduct) return;
  const result = await evaluateGarment(STATE.currentProduct.id);
  if (result) {
    renderCompatibilityGauge(result.insight);
  }
}

function renderCompatibilityGauge(insight) {
  const container = document.getElementById('compatibility-gauge');
  if (!container) return;

  // Map confidence to a percentage for the progress bar
  let confidencePercent;
  switch (insight.confidence) {
    case 'high':
      confidencePercent = 85;
      break;
    case 'moderate':
      confidencePercent = 50;
      break;
    case 'low':
      confidencePercent = 20;
      break;
    default:
      confidencePercent = 0;
  }

  // Map confidence to CSS class
  let confidenceClass;
  switch (insight.confidence) {
    case 'high':
      confidenceClass = 'gauge-high';
      break;
    case 'moderate':
      confidenceClass = 'gauge-moderate';
      break;
    case 'low':
      confidenceClass = 'gauge-low';
      break;
    default:
      confidenceClass = 'gauge-unknown';
  }

  container.innerHTML = `
    <h3>Accessibility Fit</h3>
    <p>Confidence: <span id="confidence-label">${insight.confidence.charAt(0).toUpperCase() + insight.confidence.slice(1)}</span></p>
    <div class="progress-bar">
      <div class="progress ${confidenceClass}" style="width: ${confidencePercent}%"></div>
    </div>
    <p>${insight.summary}</p>
    <button id="toggle-details-btn" onclick="toggleGaugeDetails()">Show Details</button>
    <div id="gauge-details" style="display: none;">
      <h4>Strengths</h4>
      <ul>
        ${insight.compatibility.map(item => `<li>${item}</li>`).join('')}
      </ul>
      <h4>Potential Risks</h4>
      <ul>
        ${insight.risks.map(item => `<li>${item}</li>`).join('')}
      </ul>
      <h4>Questions for Seller</h4>
      <ol>
        ${insight.questions_for_seller.map(question => `<li>${question}</li>`).join('')}
      </ol>
    </div>
  `;
}

function saveProfile(event) {
  event.preventDefault(); // Prevent default form submission

  const formData = new FormData(event.target);
  const profile = {
    posture: formData.get('posture'),
    dexterity: formData.get('dexterity'),
    sensory: Array.from(document.querySelectorAll('input[name="sensory"]:checked')).map(cb => cb.value),
    mobility_aids: Array.from(document.querySelectorAll('input[name="mobility_aids"]:checked')).map(cb => cb.value),
    fit_concerns: Array.from(document.querySelectorAll('input[name="fit_concerns"]:checked')).map(cb => cb.value),
  };

  // Validation
  if (!profile.posture || !profile.dexterity) {
    // In a real app, we'd show this in the UI
    console.error('Posture and Dexterity are required fields.');
    return;
  }

  STATE.userProfile = profile;
  localStorage.setItem('userProfile', JSON.stringify(profile));

  updateProfileBadge();
  window.location.hash = '#shop';
}

// UI Interaction Functions
function switchTab(tabName) {
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
    btn.setAttribute('aria-selected', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabName}`);
    panel.style.display = panel.id === `panel-${tabName}` ? 'block' : 'none';
    panel.setAttribute('aria-hidden', panel.id !== `panel-${tabName}`);
  });
}

let currentSpeechUtterance = null;

function speakSummary() {
  const summaryElement = document.querySelector('#compatibility-gauge p');
  if (!summaryElement) return;

  const summaryText = summaryElement.textContent;

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  if (currentSpeechUtterance && currentSpeechUtterance.text === summaryText) {
     // If it was the same text, stop it
     currentSpeechUtterance = null;
     return;
  }

  currentSpeechUtterance = new SpeechSynthesisUtterance(summaryText);
  window.speechSynthesis.speak(currentSpeechUtterance);
}

function toggleGaugeDetails() {
  const detailsDiv = document.getElementById('gauge-details');
  const toggleBtn = document.getElementById('toggle-details-btn');
  if (detailsDiv && toggleBtn) {
    const isVisible = detailsDiv.style.display !== 'none';
    detailsDiv.style.display = isVisible ? 'none' : 'block';
    toggleBtn.textContent = isVisible ? 'Show Details' : 'Hide Details';
    toggleBtn.setAttribute('aria-expanded', !isVisible);
  }
}

function updateProfileBadge() {
  const badge = dom.profileBadge();
  if (badge) {
    if (STATE.userProfile) {
      badge.textContent = `${STATE.userProfile.posture}, ${STATE.userProfile.dexterity}`;
      badge.classList.remove('empty');
    } else {
      badge.textContent = 'Set Profile';
      badge.classList.add('empty');
    }
  }
}

function handleHashChange() {
  const hash = window.location.hash;
  if (hash.startsWith('#detail/')) {
    const productId = hash.split('/')[1];
    STATE.currentProduct = STATE.products.find(p => p.id === productId) || null;
    if (STATE.currentProduct) {
      STATE.currentPage = 'detail';
      displayProductDetail();
    } else {
      window.location.hash = '#shop';
    }
  } else if (hash === '#profile') {
    STATE.currentPage = 'profile';
    // Assuming profile page is handled by HTML and we just show it
    document.querySelectorAll('.page').forEach(page => page.style.display = 'none');
    document.getElementById('profile-page')?.style.display = 'block';
  } else {
    STATE.currentPage = 'shop';
    document.querySelectorAll('.page').forEach(page => page.style.display = 'none');
    document.getElementById('shop-page')?.style.display = 'block';
    if (STATE.products.length === 0) {
      loadProducts(); // Load if not already loaded
    } else {
      renderShopPage(); // Re-render if products are already in state
    }
  }
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  updateProfileBadge();
  window.addEventListener('hashchange', handleHashChange);
  // Initialize the app by triggering the hashchange handler
  if (window.location.hash) {
    handleHashChange();
  } else {
    window.location.hash = '#shop'; // Default route
  }
});