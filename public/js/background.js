var _bgModel = null;
var _personMaskCanvas = null;
var _originalBgCanvas = null;

// Remove background and return { personBlob, maskCanvas, bgCanvas }
async function removeBackground(imageSrc) {
  var imgly = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/dist/index.mjs');

  // Fetch the image as a blob
  var response = await fetch(imageSrc);
  var blob = await response.blob();

  // Remove background - returns a blob with transparent background
  var resultBlob = await imgly.removeBackground(blob, {
    progress: function(key, current, total) {
      console.log('[bg-removal] ' + key + ': ' + current + '/' + total);
    }
  });

  // Create canvases for compositing
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

  // Store transparent person (this IS the mask effectively)
  var personImg = new Image();
  personImg.src = URL.createObjectURL(resultBlob);
  await new Promise(function(r) { personImg.onload = r; });

  _personMaskCanvas = document.createElement('canvas');
  _personMaskCanvas.width = w;
  _personMaskCanvas.height = h;
  _personMaskCanvas.getContext('2d').drawImage(personImg, 0, 0);

  // Create "clean" version: person on solid light background
  var cleanCanvas = document.createElement('canvas');
  cleanCanvas.width = w;
  cleanCanvas.height = h;
  var ctx = cleanCanvas.getContext('2d');
  ctx.fillStyle = '#f0f0f0'; // Neutral gray background
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(personImg, 0, 0);

  var cleanBlob = await new Promise(function(r) { cleanCanvas.toBlob(r, 'image/jpeg', 0.9); });

  return {
    cleanBlob: cleanBlob,       // Person on neutral bg → send to VTO
    cleanDataUrl: cleanCanvas.toDataURL('image/jpeg', 0.9)
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

  // 1. Draw original background
  ctx.drawImage(_originalBgCanvas, 0, 0);

  // 2. Create a temporary canvas with VTO result
  var vtoCanvas = document.createElement('canvas');
  vtoCanvas.width = w;
  vtoCanvas.height = h;
  var vtoCtx = vtoCanvas.getContext('2d');
  vtoCtx.drawImage(vtoImg, 0, 0, w, h);

  // 3. Use the person mask to extract only the person area from VTO result
  //    The mask has transparent background, so we use it as an alpha channel
  var maskData = _personMaskCanvas.getContext('2d').getImageData(0, 0, w, h);
  var vtoData = vtoCtx.getImageData(0, 0, w, h);

  // Apply mask: where person mask has alpha > 0, use VTO pixels; else keep background
  for (var i = 0; i < maskData.data.length; i += 4) {
    var alpha = maskData.data[i + 3]; // Alpha channel of mask
    if (alpha > 10) {
      // Use VTO pixel (the person with garment)
      // Blend based on mask alpha for soft edges
      var blend = alpha / 255;
      vtoData.data[i]     = Math.round(vtoData.data[i] * blend + maskData.data[i] * (1 - blend));     // R
      vtoData.data[i + 1] = Math.round(vtoData.data[i + 1] * blend + maskData.data[i + 1] * (1 - blend)); // G
      vtoData.data[i + 2] = Math.round(vtoData.data[i + 2] * blend + maskData.data[i + 2] * (1 - blend)); // B
      vtoData.data[i + 3] = 255; // Full opacity
    } else {
      // Keep background (will be drawn from original)
      vtoData.data[i + 3] = 0; // Transparent → background shows through
    }
  }

  // 4. Draw VTO person (masked) on top of background
  var maskedVtoCanvas = document.createElement('canvas');
  maskedVtoCanvas.width = w;
  maskedVtoCanvas.height = h;
  maskedVtoCanvas.getContext('2d').putImageData(vtoData, 0, 0);

  ctx.drawImage(maskedVtoCanvas, 0, 0);

  return outputCanvas.toDataURL('image/jpeg', 0.9);
}