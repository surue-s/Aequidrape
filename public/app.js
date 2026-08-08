const garmentSelect = document.getElementById("garment-select");
const form = document.getElementById("assessment-form");
const statusEl = document.getElementById("status");
const emptyEl = document.getElementById("result-empty");
const resultCard = document.getElementById("result-card");
const resultGarmentName = document.getElementById("result-garment-name");
const resultConfidence = document.getElementById("result-confidence");
const resultSummary = document.getElementById("result-summary");
const resultCompatibility = document.getElementById("result-compatibility");
const resultRisks = document.getElementById("result-risks");
const resultQuestions = document.getElementById("result-questions");

function checkedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function setStatus(message, tone = "neutral") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function clearList(listEl) {
  listEl.innerHTML = "";
}

function fillList(listEl, items, fallback) {
  clearList(listEl);
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = fallback;
    listEl.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    listEl.appendChild(li);
  });
}

async function loadGarments() {
  const response = await fetch("/api/garments");
  const data = await response.json();

  garmentSelect.innerHTML = "";
  data.garments.forEach((garment) => {
    const option = document.createElement("option");
    option.value = garment.id;
    option.textContent = `${garment.name} — ${garment.closure_type}`;
    garmentSelect.appendChild(option);
  });
}

async function runAssessment(event) {
  event.preventDefault();

  const profile = {
    posture: document.querySelector('input[name="posture"]:checked')?.value,
    dexterity: document.querySelector('input[name="dexterity"]:checked')?.value,
    sensory: checkedValues("sensory"),
    mobility_aids: checkedValues("mobility_aids"),
    fit_concerns: checkedValues("fit_concerns"),
  };

  setStatus("Running assessment…");

  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile,
      garmentId: garmentSelect.value,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "Something went wrong.", "error");
    return;
  }

  emptyEl.hidden = true;
  resultCard.hidden = false;
  resultGarmentName.textContent = data.garment.name;
  resultConfidence.textContent = `Confidence: ${data.insight.confidence}`;
  resultConfidence.className = `confidence-pill confidence-${data.insight.confidence}`;
  resultSummary.textContent = data.insight.summary;
  fillList(resultCompatibility, data.insight.compatibility, "No strong compatibility matches were found.");
  fillList(resultRisks, data.insight.risks, "No major risks identified.");
  fillList(resultQuestions, data.insight.questions_for_seller, "No extra seller questions were generated.");

  setStatus(`Assessment complete for ${data.garment.name}.`, "success");
}

form.addEventListener("submit", runAssessment);
form.addEventListener("reset", () => {
  setTimeout(() => {
    setStatus("Ready for a profile.");
    resultCard.hidden = true;
    emptyEl.hidden = false;
  }, 0);
});

loadGarments().catch(() => {
  setStatus("Could not load garment catalog.", "error");
});
