var _personMaskCanvas = null;
var _originalBgCanvas = null;
var _bgLibLoaded = false;
var _removeBackgroundFn = null;

// Lazy-load the background removal library from esm.sh
// esm.sh resolves all bare specifiers (like "ndarray") automatically
async function loadBgLibrary() {
  if (_bgLibLoaded && _removeBackgroundFn) return;
  
  try {
    var module = await import('https://esm.sh/@imgly/background-removal@1.5.5');
    _removeBackgroundFn = module.default || module.removeBackground;
    _bgLibLoaded = true;
    console.log('[bg-removal] Library loaded successfully');
  } catch (e) {
    console.error('[bg-removal] Failed to load library:', e);
    throw new Error('Background removal library failed to load. Check network connection.');
  }
}

// Remove background and return clean person image
async function removeBackground(imageSrc) {
  await loadBgLibrary();
  
  // Fetch the image as a blob
  var response = await fetch(imageSrc);
  var blob = await response.blob();

  console.log('[bg-removal] Processing image...');

  // Remove background - returns a blob with transparent background
  var resultBlob = await _removeBackgroundFn(blob, {
    progress: function(key, current, total) {
      console.log('[bg-removal] ' + key + ': ' + Math.round((current / total) * 100) + '%');
    }
  });

  // Load original image for background reference
  var img = new Image();
  img.src = URL.createObjectURL(blob);
  await new Promise(function(r) { img.onload = r; });

  var w = img.width;
  var h = img.height;

  // Store original image (background + person)
  _originalBgCanvas = document.createElement('canvas');
  _originalBgCanvas.width = w;
  _originalBgCanvas.height = h;
  _originalBgCanvas.getContext('2d').drawImage(img, 0, 0);

  // Load the transparent person result
  var personImg = new Image();
  personImg.src = URL.createObjectURL(resultBlob);
  await new Promise(function(r) { personImg.onload = r; });

  // Store transparent person as mask reference
  _personMaskCanvas = document.createElement('canvas');
  _personMaskCanvas.width = w;
  _personMaskCanvas.height = h;
  _personMaskCanvas.getContext('2d').drawImage(personImg, 0, 0);

  // Create "clean" version: person on solid light background for VTO
  var cleanCanvas = document.createElement('canvas');
  cleanCanvas.width = w;
  cleanCanvas.height = h;
  var ctx = cleanCanvas.getContext('2d');
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(personImg, 0, 0);

  return {
    cleanDataUrl: cleanCanvas.toDataURL('image/jpeg', 0.92)
  };
}

// Composite VTO result back onto original background
async function compositeWithBackground(vtoImageUrl) {
  if (!_personMaskCanvas || !_originalBgCanvas) return vtoImageUrl;

  var vtoImg = new Image();
  vtoImg.crossOrigin = 'anonymous';
  vtoImg.src = vtoImageUrl;
  await new Promise(function(r) { vtoImg.onload = r; });

  var w = _originalBgCanvas.width;
  var h = _originalBgCanvas.height;

  var outputCanvas = document.createElement('canvas');
  outputCanvas.width = w;
  outputCanvas.height = h;
  var ctx = outputCanvas.getContext('2d');

  // Draw original background
  ctx.drawImage(_originalBgCanvas, 0, 0);

  // Draw VTO result scaled to match original dimensions
  var vtoCanvas = document.createElement('canvas');
  vtoCanvas.width = w;
  vtoCanvas.height = h;
  var vtoCtx = vtoCanvas.getContext('2d');
  vtoCtx.drawImage(vtoImg, 0, 0, w, h);

  // Get pixel data from both mask and VTO result
  var maskData = _personMaskCanvas.getContext('2d').getImageData(0, 0, w, h);
  var vtoData = vtoCtx.getImageData(0, 0, w, h);

  // Apply mask: where person mask has alpha > threshold, blend VTO pixels
  for (var i = 0; i < maskData.data.length; i += 4) {
    var alpha = maskData.data[i + 3];
    if (alpha > 30) {
      var blend = Math.min(alpha / 255, 1);
      // Soft edge blending
      vtoData.data[i]     = Math.round(vtoData.data[i] * blend + maskData.data[i] * (1 - blend));
      vtoData.data[i + 1] = Math.round(vtoData.data[i + 1] * blend + maskData.data[i + 1] * (1 - blend));
      vtoData.data[i + 2] = Math.round(vtoData.data[i + 2] * blend + maskData.data[i + 2] * (1 - blend));
      vtoData.data[i + 3] = 255;
    } else {
      // Outside person area: make transparent so background shows through
      vtoData.data[i + 3] = 0;
    }
  }

  // Draw masked VTO person onto original background
  var maskedVtoCanvas = document.createElement('canvas');
  maskedVtoCanvas.width = w;
  maskedVtoCanvas.height = h;
  maskedVtoCanvas.getContext('2d').putImageData(vtoData, 0, 0);
  ctx.drawImage(maskedVtoCanvas, 0, 0);

  return outputCanvas.toDataURL('image/jpeg', 0.92);
}