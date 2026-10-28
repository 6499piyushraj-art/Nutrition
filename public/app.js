"use strict";

const STORAGE_KEY = "mynutri-ai.v1";
const DEFAULTS = {
  targets: {
    caloriesKcal: 2400, proteinG: 80, carbsG: 300, fatG: 75, omega3G: 1.6, omega6G: 16,
    calciumMg: 1300, phosphorusMg: 1250, magnesiumMg: 410, potassiumMg: 3000, sodiumMg: 1500, chlorideMg: 2300,
    zincMg: 11, ironMg: 11, iodineMcg: 150, copperMcg: 890, manganeseMg: 2.2, seleniumMcg: 55,
    fluorideMg: 3, chromiumMcg: 35, molybdenumMcg: 43, vitaminAMcg: 900, vitaminDIu: 900,
    vitaminEMg: 15, vitaminKMcg: 75, vitaminCMg: 75, vitaminB1Mg: 1.2, vitaminB2Mg: 1.3,
    vitaminB3Mg: 16, vitaminB5Mg: 5, vitaminB6Mg: 1.3, vitaminB7Mcg: 30, folateMcg: 400, vitaminB12Mcg: 2.4
  },
  logs: []
};
const NUTRIENTS = [
  { key: "caloriesKcal", name: "Energy", unit: "kcal", target: "caloriesKcal", category: "Energy & macros", description: "Estimated food energy." },
  { key: "proteinG", name: "Protein", unit: "g", target: "proteinG", category: "Energy & macros", description: "Protein supports normal tissue maintenance and growth." },
  { key: "carbsG", name: "Carbohydrates", unit: "g", target: "carbsG", category: "Energy & macros", description: "A major source of energy." },
  { key: "fatG", name: "Total fat", unit: "g", target: "fatG", category: "Energy & macros", description: "Dietary fat supports energy and normal body functions." },
  { key: "fiberG", name: "Dietary fibre", unit: "g", target: null, category: "Energy & macros", description: "Estimate when enough food detail is available." },
  { key: "sugarG", name: "Total sugars", unit: "g", target: null, category: "Energy & macros", description: "Depends on ingredients and preparation." },
  { key: "omega3G", name: "Omega-3", unit: "g", target: "omega3G", category: "Essential fats", description: "A family of essential fatty acids." },
  { key: "omega6G", name: "Omega-6", unit: "g", target: "omega6G", category: "Essential fats", description: "A family of essential fatty acids." },
  { key: "calciumMg", name: "Calcium", unit: "mg", target: "calciumMg", category: "Minerals", description: "Supports bones and teeth." },
  { key: "phosphorusMg", name: "Phosphorus", unit: "mg", target: "phosphorusMg", category: "Minerals", description: "A mineral found in bones and many foods." },
  { key: "magnesiumMg", name: "Magnesium", unit: "mg", target: "magnesiumMg", category: "Minerals", description: "Involved in many body functions." },
  { key: "potassiumMg", name: "Potassium", unit: "mg", target: "potassiumMg", category: "Minerals", description: "Helps nerves and muscles function." },
  { key: "sodiumMg", name: "Sodium", unit: "mg", target: "sodiumMg", category: "Minerals", description: "Varies with salt and packaged foods." },
  { key: "chlorideMg", name: "Chloride", unit: "mg", target: "chlorideMg", category: "Minerals", description: "The 2.3 g reference target is represented as 2300 mg." },
  { key: "zincMg", name: "Zinc", unit: "mg", target: "zincMg", category: "Minerals", description: "Supports normal immune function." },
  { key: "ironMg", name: "Iron", unit: "mg", target: "ironMg", category: "Minerals", description: "Supports oxygen transport in blood." },
  { key: "iodineMcg", name: "Iodine", unit: "µg", target: "iodineMcg", category: "Minerals", description: "Food estimates vary; iodized salt content is a key uncertainty." },
  { key: "copperMcg", name: "Copper", unit: "µg", target: "copperMcg", category: "Minerals", description: "A trace mineral." },
  { key: "manganeseMg", name: "Manganese", unit: "mg", target: "manganeseMg", category: "Minerals", description: "A trace mineral in many plant foods." },
  { key: "seleniumMcg", name: "Selenium", unit: "µg", target: "seleniumMcg", category: "Minerals", description: "A trace mineral whose content depends on food and soil." },
  { key: "fluorideMg", name: "Fluoride", unit: "mg", target: "fluorideMg", category: "Minerals", description: "Often not estimable from a meal photo." },
  { key: "chromiumMcg", name: "Chromium", unit: "µg", target: "chromiumMcg", category: "Minerals", description: "Trace mineral; food composition data can be limited." },
  { key: "molybdenumMcg", name: "Molybdenum", unit: "µg", target: "molybdenumMcg", category: "Minerals", description: "Trace mineral; food composition data can be limited." },
  { key: "vitaminAMcg", name: "Vitamin A", unit: "µg", target: "vitaminAMcg", category: "Vitamins", description: "Estimate may be expressed as activity equivalents." },
  { key: "vitaminDIu", name: "Vitamin D", unit: "IU", target: "vitaminDIu", category: "Vitamins", description: "Supports calcium absorption; often difficult to estimate from photos." },
  { key: "vitaminEMg", name: "Vitamin E", unit: "mg", target: "vitaminEMg", category: "Vitamins", description: "A fat-soluble vitamin." },
  { key: "vitaminKMcg", name: "Vitamin K", unit: "µg", target: "vitaminKMcg", category: "Vitamins", description: "A fat-soluble vitamin." },
  { key: "vitaminCMg", name: "Vitamin C", unit: "mg", target: "vitaminCMg", category: "Vitamins", description: "Helps the body absorb iron from plant foods." },
  { key: "vitaminB1Mg", name: "Vitamin B1 (Thiamine)", unit: "mg", target: "vitaminB1Mg", category: "Vitamins", description: "A B vitamin involved in energy metabolism." },
  { key: "vitaminB2Mg", name: "Vitamin B2 (Riboflavin)", unit: "mg", target: "vitaminB2Mg", category: "Vitamins", description: "A B vitamin involved in energy metabolism." },
  { key: "vitaminB3Mg", name: "Vitamin B3 (Niacin)", unit: "mg", target: "vitaminB3Mg", category: "Vitamins", description: "A B vitamin involved in energy metabolism." },
  { key: "vitaminB5Mg", name: "Vitamin B5 (Pantothenic acid)", unit: "mg", target: "vitaminB5Mg", category: "Vitamins", description: "A B vitamin involved in metabolism." },
  { key: "vitaminB6Mg", name: "Vitamin B6", unit: "mg", target: "vitaminB6Mg", category: "Vitamins", description: "A B vitamin involved in protein metabolism." },
  { key: "vitaminB7Mcg", name: "Vitamin B7 (Biotin)", unit: "µg", target: "vitaminB7Mcg", category: "Vitamins", description: "A B vitamin." },
  { key: "folateMcg", name: "Vitamin B9 (Folate)", unit: "µg", target: "folateMcg", category: "Vitamins", description: "Folate content varies by food and preparation." },
  { key: "vitaminB12Mcg", name: "Vitamin B12", unit: "µg", target: "vitaminB12Mcg", category: "Vitamins", description: "Supports normal nerve and blood cell function." }
];
const MACROS = [
  { key: "caloriesKcal", label: "Energy", unit: "kcal", target: "caloriesKcal", css: "" },
  { key: "proteinG", label: "Protein", unit: "g", target: "proteinG", css: "fill-protein" },
  { key: "carbsG", label: "Carbohydrates", unit: "g", target: "carbsG", css: "fill-carbs" },
  { key: "fatG", label: "Fat", unit: "g", target: "fatG", css: "fill-fat" }
];
const FIELD_IDS = NUTRIENTS.map(function (nutrient) { return nutrient.key; });
let state = loadState();
let selectedPhoto = null;
let pendingAnalysis = null;
let toastTimer = null;
let autoAnalyzeTimer = null;
let lastAttemptedSignature = "";
let analysisInProgress = false;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return structuredClone(DEFAULTS);
    const targetEntries = Object.entries(DEFAULTS.targets).map(function (entry) {
      const value = Number(saved.targets && saved.targets[entry[0]]);
      return [entry[0], Number.isFinite(value) && value > 0 ? value : entry[1]];
    });
    return {
      targets: Object.fromEntries(targetEntries),
      logs: Array.isArray(saved.logs) ? saved.logs.filter(isValidLog).slice(0, 5000) : []
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function isValidLog(log) {
  return Boolean(log && typeof log === "object" && typeof log.id === "string" &&
    typeof log.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(log.date) &&
    typeof log.name === "string" && log.nutrition && typeof log.nutrition === "object" &&
    ["caloriesKcal", "proteinG", "carbsG", "fatG"].every(function (key) {
      return typeof log.nutrition[key] === "number" && Number.isFinite(log.nutrition[key]) && log.nutrition[key] >= 0;
    }));
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    showToast("Could not save locally. Your browser storage may be full or disabled.");
  }
}

function localDate(date) {
  const d = date || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmt(value, digits) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits == null ? 1 : digits }).format(num);
}

function totalFor(entries, key) {
  const values = entries.map(function (entry) { return entry.nutrition && entry.nutrition[key]; })
    .filter(function (v) { return typeof v === "number" && Number.isFinite(v); });
  if (!values.length) return null;
  return values.reduce(function (sum, v) { return sum + v; }, 0);
}

function entriesForDate(date) {
  return state.logs.filter(function (entry) { return entry.date === date; })
    .sort(function (a, b) { return String(a.createdAt || "").localeCompare(String(b.createdAt || "")); });
}

function mealIcon(meal) {
  const map = { Breakfast: "☀", Lunch: "◉", Dinner: "☾", Snack: "✳" };
  return map[meal] || "✳";
}

function safeNumberInput(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value == null || !Number.isFinite(Number(value)) ? "" : String(value);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(function () { toast.classList.remove("show"); }, 3200);
}

function showConfirm(title, message, acceptText) {
  const dialog = document.getElementById("confirm-dialog");
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-message").textContent = message;
  document.getElementById("confirm-accept").textContent = acceptText || "Confirm";
  dialog.showModal();
  return new Promise(function (resolve) {
    dialog.addEventListener("close", function onClose() {
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue === "confirm");
    });
  });
}

function setView(name) {
  const allowed = ["dashboard", "log", "nutrients", "history", "settings"];
  if (!allowed.includes(name)) name = "dashboard";
  document.querySelectorAll(".view").forEach(function (view) {
    view.classList.toggle("active", view.id === "view-" + name);
  });
  document.querySelectorAll("[data-view]").forEach(function (button) {
    if (button.classList.contains("nav-item")) button.classList.toggle("active", button.dataset.view === name);
  });
  const titles = { dashboard: "Dashboard", log: "Log food", nutrients: "Nutrient analysis", history: "History", settings: "Settings" };
  document.getElementById("current-page-title").textContent = titles[name];
  document.getElementById("sidebar").classList.remove("open");
  if (name === "settings") renderSettings();
  if (name === "history") renderHistory();
  if (name === "nutrients") renderMicronutrients(document.getElementById("nutrients-date").value || localDate());
  if (name === "dashboard") renderDashboard(document.getElementById("dashboard-date").value || localDate());
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateProgress(id, total, target) {
  const el = document.getElementById(id);
  const percent = target > 0 && total != null ? Math.max(0, Math.min(100, total / target * 100)) : 0;
  if (el) el.style.width = percent + "%";
}

function renderDashboard(date) {
  const entries = entriesForDate(date);
  const cal = totalFor(entries, "caloriesKcal");
  const protein = totalFor(entries, "proteinG");
  const carbs = totalFor(entries, "carbsG");
  const fat = totalFor(entries, "fatG");
  document.getElementById("total-calories").textContent = fmt(cal == null ? 0 : cal, 0);
  document.getElementById("total-protein").textContent = fmt(protein == null ? 0 : protein, 1);
  document.getElementById("total-carbs").textContent = fmt(carbs == null ? 0 : carbs, 1);
  document.getElementById("total-fat").textContent = fmt(fat == null ? 0 : fat, 1);
  document.getElementById("calorie-target-label").textContent = "/ " + fmt(state.targets.caloriesKcal, 0);
  document.getElementById("protein-target-label").textContent = "/ " + fmt(state.targets.proteinG, 0);
  document.getElementById("carbs-target-label").textContent = "/ " + fmt(state.targets.carbsG, 0);
  document.getElementById("fat-target-label").textContent = "/ " + fmt(state.targets.fatG, 0);
  updateProgress("calorie-progress", cal, state.targets.caloriesKcal);
  updateProgress("protein-progress", protein, state.targets.proteinG);
  updateProgress("carbs-progress", carbs, state.targets.carbsG);
  updateProgress("fat-progress", fat, state.targets.fatG);
  const remaining = Math.max(0, state.targets.caloriesKcal - (cal || 0));
  document.getElementById("calorie-remaining").textContent = entries.length ? fmt(remaining, 0) + " kcal to reference target" : "Add a meal to begin your log";
  document.getElementById("timeline-caption").textContent = entries.length + (entries.length === 1 ? " meal logged" : " meals logged") + " · " + date;
  renderTimeline(entries);
  renderTargetSummary(entries);
}

function renderTimeline(entries) {
  const host = document.getElementById("timeline-list");
  if (!entries.length) {
    host.innerHTML = '<div class="empty-state"><span class="empty-icon">＋</span><strong>No meals logged yet</strong><p>Start with a meal description or photo.</p><button class="button button-outline" data-view="log" type="button">Add first meal</button></div>';
    return;
  }
  host.innerHTML = entries.slice().reverse().slice(0, 6).map(function (entry) {
    const mealClass = String(entry.meal || "").toLowerCase();
    return '<article class="timeline-entry"><span class="meal-icon ' + escapeHtml(mealClass) + '">' + escapeHtml(mealIcon(entry.meal)) + '</span>' +
      '<div class="meal-copy"><strong>' + escapeHtml(entry.name) + '</strong><small>' + escapeHtml(entry.meal || "Meal") + ' · ' + escapeHtml(entry.serving || "Serving not specified") + '</small></div>' +
      '<div class="meal-calories">' + fmt(entry.nutrition.caloriesKcal, 0) + '<small>kcal</small></div></article>';
  }).join("");
}

function renderTargetSummary(entries) {
  const host = document.getElementById("target-summary");
  host.innerHTML = MACROS.map(function (metric) {
    const total = totalFor(entries, metric.key) || 0;
    const target = Number(state.targets[metric.target]) || 1;
    const width = Math.min(100, Math.max(0, total / target * 100));
    return '<div class="target-row"><div class="target-row-top"><span>' + escapeHtml(metric.label) + '</span><span>' + fmt(total, metric.key === "caloriesKcal" ? 0 : 1) + ' / ' + fmt(target, 0) + ' ' + escapeHtml(metric.unit) + '</span></div><div class="target-track"><span style="width:' + width + '%"></span></div></div>';
  }).join("");
}

function renderMicronutrients(date) {
  const entries = entriesForDate(date);
  const host = document.getElementById("micronutrient-grid");
  host.innerHTML = NUTRIENTS.map(function (nutrient) {
    const total = totalFor(entries, nutrient.key);
    const target = nutrient.target ? Number(state.targets[nutrient.target]) : null;
    const known = total !== null;
    const progress = known && target ? Math.min(100, Math.max(0, total / target * 100)) : 0;
    return '<article class="micro-card"><div class="micro-card-top"><strong>' + escapeHtml(nutrient.name) + '</strong><span class="micro-unit">' + escapeHtml(nutrient.unit) + '</span></div>' +
      '<div class="micro-value">' + (known ? fmt(total, 1) : '<span class="nutrient-missing">Not estimated</span>') +
      (known && target ? ' <small>/ ' + fmt(target, 1) + '</small>' : '') + '</div>' +
      (known && target ? '<div class="target-track"><span style="width:' + progress + '%"></span></div>' : '') +
      '<p>' + escapeHtml(nutrient.description) + '</p></article>';
  }).join("");
}

function renderHistory() {
  const dateFilter = document.getElementById("history-date").value;
  let logs = state.logs.slice().sort(function (a, b) {
    return String(b.date).localeCompare(String(a.date)) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  if (dateFilter) logs = logs.filter(function (entry) { return entry.date === dateFilter; });
  document.getElementById("history-count").textContent = logs.length + (logs.length === 1 ? " meal" : " meals");
  const host = document.getElementById("history-list");
  if (!logs.length) {
    host.innerHTML = '<div class="history-empty"><strong>No saved meals for this selection.</strong><p class="small">Try another date or log a new meal.</p><button class="button button-outline" data-view="log" type="button">Log food</button></div>';
    return;
  }
  let previousDate = "";
  host.innerHTML = logs.map(function (entry) {
    let heading = "";
    if (entry.date !== previousDate) {
      heading = '<div class="history-day">' + escapeHtml(entry.date) + '</div>';
      previousDate = entry.date;
    }
    const hasMicros = NUTRIENTS.filter(function (nutrient) {
      return entry.nutrition[nutrient.key] !== undefined && entry.nutrition[nutrient.key] !== null;
    }).length;
    return heading + '<article class="history-entry"><span class="meal-icon ' + escapeHtml(String(entry.meal || "").toLowerCase()) + '">' + escapeHtml(mealIcon(entry.meal)) + '</span>' +
      '<div class="meal-copy"><strong>' + escapeHtml(entry.name) + '</strong><div class="entry-meta">' + escapeHtml(entry.meal || "Meal") + ' · ' + escapeHtml(entry.serving || "Serving not specified") + ' · ' + hasMicros + ' micronutrients estimated</div></div>' +
      '<span class="entry-energy">' + fmt(entry.nutrition.caloriesKcal, 0) + ' kcal</span><button class="entry-delete" type="button" data-delete-id="' + escapeHtml(entry.id) + '" aria-label="Delete ' + escapeHtml(entry.name) + '" title="Delete meal">×</button></article>';
  }).join("");
}

function renderTargetFields() {
  const host = document.getElementById("target-fields");
  if (!host) return;
  const groups = ["Energy & macros", "Essential fats", "Minerals", "Vitamins"];
  host.innerHTML = groups.map(function (group) {
    const fields = NUTRIENTS.filter(function (n) { return n.target && n.category === group; });
    if (!fields.length) return "";
    return '<section class="target-group"><h3>' + escapeHtml(group) + '</h3><div class="settings-grid">' +
      fields.map(function (n) {
        return '<div><label for="target-' + escapeHtml(n.key) + '">' + escapeHtml(n.name) + ' (' + escapeHtml(n.unit) + ')</label>' +
          '<input id="target-' + escapeHtml(n.key) + '" type="number" min="0.1" max="10000000" step="any" required value="' +
          escapeHtml(state.targets[n.key]) + '"></div>';
      }).join("") + '</div></section>';
  }).join("");
}

function renderSettings() {
  renderTargetFields();
  updateEnergyNote();
}

function updateEnergyNote() {
  const p = Number(document.getElementById("target-proteinG")?.value);
  const c = Number(document.getElementById("target-carbsG")?.value);
  const f = Number(document.getElementById("target-fatG")?.value);
  const kcal = Number(document.getElementById("target-caloriesKcal")?.value);
  const note = document.getElementById("target-energy-note");
  if (![p, c, f, kcal].every(Number.isFinite) || p < 0 || c < 0 || f < 0 || kcal <= 0) {
    note.hidden = true;
    return;
  }
  const macroKcal = 4 * p + 4 * c + 9 * f;
  const difference = Math.abs(macroKcal - kcal);
  if (difference > Math.max(100, kcal * 0.05)) {
    note.textContent = "Note: your macro targets add up to about " + fmt(macroKcal, 0) + " kcal (4 kcal/g protein and carbs; 9 kcal/g fat), while the energy target is " + fmt(kcal, 0) + " kcal. They are not automatically changed.";
    note.hidden = false;
  } else {
    note.hidden = true;
  }
}

function renderReviewFields() {
  const host = document.getElementById("review-nutrient-grid");
  if (!host) return;
  const required = new Set(["caloriesKcal", "proteinG", "carbsG", "fatG"]);
  host.innerHTML = NUTRIENTS.map(function (nutrient) {
    return '<div class="nutrient-input"><label for="field-' + escapeHtml(nutrient.key) + '">' +
      escapeHtml(nutrient.name) + ' <small>' + escapeHtml(nutrient.unit) + '</small></label>' +
      '<input id="field-' + escapeHtml(nutrient.key) + '" type="number" min="0" max="10000000" step="any"' +
      (required.has(nutrient.key) ? ' required' : '') + '></div>';
  }).join("");
}

function fillReview(result) {
  renderReviewFields();
  pendingAnalysis = result;
  const nutrition = result.nutrition || {};
  document.getElementById("review-food-name").value = result.foodName || "";
  document.getElementById("review-serving").value = result.servingDescription || "";
  FIELD_IDS.forEach(function (key) {
    safeNumberInput("field-" + key, nutrition[key] === undefined ? "" : nutrition[key]);
  });
  const confidence = document.getElementById("confidence-pill");
  confidence.textContent = (result.confidence || "low") + " confidence";
  confidence.className = "confidence-pill " + (result.confidence || "low");
  document.getElementById("review-notes").textContent = result.notes || "Nutrition values are estimates.";
  const assumptions = [];
  if (Array.isArray(result.items) && result.items.length) {
    assumptions.push("Foods detected: " + result.items.map(function (item) { return item.name + " (" + item.amount + ")"; }).join("; "));
  }
  if (Array.isArray(result.assumptions)) assumptions.push.apply(assumptions, result.assumptions);
  if (Array.isArray(result.missingDetails) && result.missingDetails.length) assumptions.push("For a better estimate: " + result.missingDetails.join("; "));
  document.getElementById("review-assumptions").textContent = assumptions.join(" · ");
  const panel = document.getElementById("review-panel");
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearReview() {
  pendingAnalysis = null;
  document.getElementById("review-panel").hidden = true;
  document.getElementById("save-form").reset();
}

function setFormError(message) {
  document.getElementById("analyze-error").textContent = message || "";
}

function setAnalyzing(active) {
  const button = document.getElementById("analyze-button");
  button.disabled = active;
  button.innerHTML = active ? '<span class="spinner" aria-hidden="true"></span> Asking Gemini…' : '<span>✳</span> Analyze with Gemini <span class="button-arrow">→</span>';
}

function currentAnalysisSignature() {
  const description = document.getElementById("food-description").value.trim();
  const photo = selectedPhoto ? [selectedPhoto.name, selectedPhoto.size, selectedPhoto.lastModified, selectedPhoto.type].join(":") : "";
  return description + "|" + photo;
}

function scheduleAutoAnalysis(delay) {
  window.clearTimeout(autoAnalyzeTimer);
  const signature = currentAnalysisSignature();
  const description = document.getElementById("food-description").value.trim();
  if (!description && !selectedPhoto) return;
  if (signature === lastAttemptedSignature) return;
  autoAnalyzeTimer = window.setTimeout(function () {
    if (currentAnalysisSignature() !== signature) {
      scheduleAutoAnalysis(700);
      return;
    }
    if (analysisInProgress) {
      scheduleAutoAnalysis(700);
      return;
    }
    analyzeMeal(null, { automatic: true });
  }, Number.isFinite(delay) ? delay : 1800);
}

async function analyzeMeal(event, options) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (analysisInProgress) return;
  setFormError("");
  const description = document.getElementById("food-description").value.trim();
  const signature = currentAnalysisSignature();
  if (!description && !selectedPhoto) {
    setFormError("Describe the food or select a photo before analyzing.");
    return;
  }
  if (options && options.automatic && signature === lastAttemptedSignature) return;
  lastAttemptedSignature = signature;
  analysisInProgress = true;
  setAnalyzing(true);
  clearReview();
  try {
    const body = { description: description };
    if (selectedPhoto) {
      if (selectedPhoto.size > 5 * 1024 * 1024) throw new Error("Please choose an image smaller than 5 MB.");
      body.image = {
        mimeType: selectedPhoto.type,
        data: await fileToBase64(selectedPhoto)
      };
    }
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(function () { return {}; });
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    if (!response.ok) throw new Error(result.error || "Analysis failed. Please try again.");
    if (currentAnalysisSignature() !== signature) return;
    fillReview(result);
  } catch (err) {
    if (currentAnalysisSignature() === signature) {
      setFormError(err.message || "Could not analyze the meal.");
    }
  } finally {
    analysisInProgress = false;
    setAnalyzing(false);
    if (currentAnalysisSignature() !== signature) scheduleAutoAnalysis(500);
  }
}

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      if (comma < 0) return reject(new Error("Could not read the selected photo."));
      resolve(value.slice(comma + 1));
    };
    reader.onerror = function () { reject(new Error("Could not read the selected photo.")); };
    reader.readAsDataURL(file);
  });
}

function setPhoto(file) {
  const preview = document.getElementById("photo-preview");
  if (!file) {
    selectedPhoto = null;
    preview.hidden = true;
    document.getElementById("photo-preview-image").removeAttribute("src");
    document.getElementById("food-photo").value = "";
    scheduleAutoAnalysis(500);
    return;
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    showToast("Choose a JPG, PNG, or WebP image.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("Choose a photo smaller than 5 MB.");
    return;
  }
  selectedPhoto = file;
  document.getElementById("photo-file-name").textContent = file.name;
  preview.hidden = false;
  const reader = new FileReader();
  reader.onload = function () {
    if (selectedPhoto !== file) return;
    const dataUrl = String(reader.result || "");
    if (!dataUrl.startsWith("data:image/")) {
      showToast("Could not preview that image. Please choose another photo.");
      return;
    }
    document.getElementById("photo-preview-image").src = dataUrl;
  };
  reader.onerror = function () {
    if (selectedPhoto === file) showToast("Could not preview that photo. Try another image.");
  };
  reader.readAsDataURL(file);
  scheduleAutoAnalysis(900);
}

function saveMeal(event) {
  event.preventDefault();
  if (!pendingAnalysis) {
    showToast("Analyze a meal before saving.");
    return;
  }
  const nutrition = {};
  for (const key of FIELD_IDS) {
    const input = document.getElementById("field-" + key);
    if (!input || input.value.trim() === "") {
      if (["caloriesKcal", "proteinG", "carbsG", "fatG"].includes(key)) {
        showToast("Please fill in energy, protein, carbohydrates, and fat.");
        input && input.focus();
        return;
      }
      continue;
    }
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 0) {
      showToast("Nutrition values must be valid non-negative numbers.");
      input.focus();
      return;
    }
    nutrition[key] = value;
  }
  const name = document.getElementById("review-food-name").value.trim();
  const serving = document.getElementById("review-serving").value.trim();
  if (!name || !serving) {
    showToast("Add a food name and serving size before saving.");
    return;
  }
  const entry = {
    id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(36).slice(2),
    date: document.getElementById("entry-date").value || localDate(),
    meal: document.getElementById("entry-meal").value,
    name: name.slice(0, 120),
    serving: serving.slice(0, 120),
    nutrition: nutrition,
    confidence: pendingAnalysis.confidence || "low",
    notes: String(pendingAnalysis.notes || "").slice(0, 600),
    createdAt: new Date().toISOString()
  };
  state.logs.push(entry);
  saveState();
  clearReview();
  document.getElementById("food-description").value = "";
  setPhoto(null);
  const date = localDate();
  document.getElementById("dashboard-date").value = entry.date;
  document.getElementById("history-date").value = "";
  document.getElementById("nutrients-date").value = entry.date;
  renderDashboard(entry.date);
  renderMicronutrients(entry.date);
  renderHistory();
  showToast("Meal saved to your local food log.");
  setView("dashboard");
}

function exportJson() {
  const data = JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, targets: state.targets, logs: state.logs }, null, 2);
  downloadFile(data, "mynutri-data-" + localDate() + ".json", "application/json");
}

function csvCell(value) {
  const text = String(value == null ? "" : value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function exportCsv() {
  const columns = ["date", "meal", "name", "serving"].concat(FIELD_IDS);
  const rows = [columns.join(",")];
  state.logs.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).forEach(function (entry) {
    const cells = [entry.date, entry.meal, entry.name, entry.serving];
    FIELD_IDS.forEach(function (key) {
      cells.push(entry.nutrition[key] == null ? "" : entry.nutrition[key]);
    });
    rows.push(cells.map(csvCell).join(","));
  });
  downloadFile(rows.join("\r\n"), "mynutri-meals-" + localDate() + ".csv", "text/csv;charset=utf-8");
}

function downloadFile(content, fileName, type) {
  const blob = new Blob([content], { type: type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function saveTargets(event) {
  event.preventDefault();
  const next = {};
  for (const key of Object.keys(DEFAULTS.targets)) {
    const input = document.getElementById("target-" + key);
    const value = Number(input && input.value);
    if (!input || !Number.isFinite(value) || value <= 0) {
      showToast("All daily reference targets must be positive numbers.");
      input && input.focus();
      return;
    }
    next[key] = value;
  }
  state.targets = next;
  saveState();
  renderDashboard(document.getElementById("dashboard-date").value || localDate());
  renderMicronutrients(document.getElementById("nutrients-date").value || localDate());
  updateEnergyNote();
  document.getElementById("target-save-status").textContent = "Targets saved on this device.";
  showToast("Your reference targets were updated.");
}

async function deleteEntry(id) {
  const entry = state.logs.find(function (item) { return item.id === id; });
  if (!entry) return;
  const ok = await showConfirm("Delete this meal?", "Remove “" + entry.name + "” from this browser's food history?", "Delete meal");
  if (!ok) return;
  state.logs = state.logs.filter(function (item) { return item.id !== id; });
  saveState();
  renderAll();
  showToast("Meal removed.");
}

async function clearLocalData() {
  const ok = await showConfirm("Clear all local data?", "This removes every saved meal and resets your reference targets in this browser. Export a backup first if you need one.", "Clear all data");
  if (!ok) return;
  state = structuredClone(DEFAULTS);
  saveState();
  renderAll();
  renderSettings();
  showToast("Local data has been cleared.");
}

function renderAll() {
  const currentDate = document.getElementById("dashboard-date").value || localDate();
  renderDashboard(currentDate);
  renderMicronutrients(document.getElementById("nutrients-date").value || currentDate);
  renderHistory();
  renderSettings();
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach(function (button) {
    button.addEventListener("click", function () { setView(button.dataset.view); });
  });
  document.getElementById("menu-toggle").addEventListener("click", function () {
    document.getElementById("sidebar").classList.toggle("open");
  });
  document.getElementById("logout-button").addEventListener("click", function () {
    window.location.assign("/api/logout");
  });
  document.getElementById("dashboard-date").addEventListener("change", function (event) {
    renderDashboard(event.target.value || localDate());
  });
  document.getElementById("nutrients-date").addEventListener("change", function (event) {
    renderMicronutrients(event.target.value || localDate());
  });
  document.getElementById("history-date").addEventListener("change", renderHistory);
  document.getElementById("analyze-form").addEventListener("submit", analyzeMeal);
  document.getElementById("save-form").addEventListener("submit", saveMeal);
  document.getElementById("discard-review").addEventListener("click", function () {
    clearReview();
    showToast("Review discarded; nothing was saved.");
  });
  document.getElementById("choose-photo").addEventListener("click", function () {
    document.getElementById("food-photo").click();
  });
  document.getElementById("food-photo").addEventListener("change", function (event) {
    setPhoto(event.target.files && event.target.files[0]);
  });
  document.getElementById("remove-photo").addEventListener("click", function () { setPhoto(null); });
  document.getElementById("upload-zone").addEventListener("dragover", function (event) {
    event.preventDefault();
    event.currentTarget.classList.add("drag-over");
  });
  document.getElementById("upload-zone").addEventListener("dragleave", function (event) {
    event.currentTarget.classList.remove("drag-over");
  });
  document.getElementById("upload-zone").addEventListener("drop", function (event) {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) setPhoto(file);
  });
  document.querySelectorAll("[data-example]").forEach(function (button) {
    button.addEventListener("click", function () {
      document.getElementById("food-description").value = button.dataset.example;
      document.getElementById("food-description").focus();
      scheduleAutoAnalysis(350);
    });
  });
  document.getElementById("targets-form").addEventListener("submit", saveTargets);
  document.getElementById("target-fields").addEventListener("input", updateEnergyNote);
  document.getElementById("food-description").addEventListener("input", function () {
    scheduleAutoAnalysis(1800);
  });
  document.getElementById("export-json-button").addEventListener("click", exportJson);
  document.getElementById("export-csv-button").addEventListener("click", exportCsv);
  document.getElementById("import-json-button").addEventListener("click", function () {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", importJson);
  document.getElementById("clear-data-button").addEventListener("click", clearLocalData);
  document.addEventListener("click", function (event) {
    const deleteButton = event.target.closest("[data-delete-id]");
    if (deleteButton) deleteEntry(deleteButton.dataset.deleteId);
  });
}

async function importJson(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error("Import files must be smaller than 10 MB.");
    const parsed = JSON.parse(await file.text());
    if (!parsed || !parsed.targets || !Array.isArray(parsed.logs)) throw new Error("This file does not look like a MyNutri AI export.");
    const targets = {};
    for (const pair of Object.entries(DEFAULTS.targets)) {
      const value = Number(parsed.targets[pair[0]]);
      targets[pair[0]] = Number.isFinite(value) && value > 0 ? value : pair[1];
    }
    const logs = parsed.logs.filter(isValidLog).map(function (entry) {
      const nutrition = {};
      FIELD_IDS.forEach(function (key) {
        const value = entry.nutrition[key];
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) nutrition[key] = value;
      });
      return {
        id: entry.id, date: entry.date, meal: ["Breakfast", "Lunch", "Dinner", "Snack"].includes(entry.meal) ? entry.meal : "Snack",
        name: String(entry.name).slice(0, 120), serving: String(entry.serving || "").slice(0, 120),
        nutrition: nutrition, confidence: String(entry.confidence || "low"), notes: String(entry.notes || "").slice(0, 600),
        createdAt: String(entry.createdAt || "")
      };
    });
    const ok = await showConfirm("Import local data?", "This will replace the current local meals and targets with " + logs.length + " valid meal entries from the selected file.", "Import data");
    if (!ok) return;
    state = { targets: targets, logs: logs.slice(-5000) };
    saveState();
    renderAll();
    showToast("Data imported.");
  } catch (error) {
    showToast(error.message || "Could not import that file.");
  }
}

async function checkStatus() {
  const pill = document.querySelector(".status-pill");
  if (!pill) return;
  try {
    const response = await fetch("/api/status");
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    const status = await response.json();
    if (!response.ok || !status.geminiConfigured) {
      pill.innerHTML = "<span></span> Gemini needs setup";
      pill.classList.add("status-warning");
      showToast("Add GEMINI_API_KEY in Render's private Environment settings to enable AI analysis.");
    } else {
      pill.innerHTML = "<span></span> Gemini connected";
      pill.classList.remove("status-warning");
    }
  } catch {
    pill.innerHTML = "<span></span> Gemini status unavailable";
    pill.classList.add("status-warning");
  }
}

function init() {
  const today = localDate();
  document.getElementById("dashboard-date").value = today;
  document.getElementById("entry-date").value = today;
  document.getElementById("history-date").value = "";
  document.getElementById("nutrients-date").value = today;
  document.getElementById("sidebar-date").textContent = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date());
  bindEvents();
  renderAll();
  checkStatus();
}

document.addEventListener("DOMContentLoaded", init);
