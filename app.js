/********************************************************
* Firebase initialization
********************************************************/
const firebaseConfig = {
apiKey: "AIzaSyAJDJV-RqYJQqdtn1p3cpWoS1ahh8dFVWM",
authDomain: "diet-tracker-202e4.firebaseapp.com",
projectId: "diet-tracker-202e4",
storageBucket: "diet-tracker-202e4.appspot.com",
messagingSenderId: "731628330288",
appId: "1:731628330288:web:7d0d7e4816f862bcbd7cf5",
measurementId: "G-4PXHP7GQRL"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
/********************************************************
* DOM elements
********************************************************/
const themeToggleBtn = document.getElementById("themeToggleBtn");
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
// Table & Trends
const tableBody = document.querySelector("#nutrientTable tbody");
const averagesSection = document.getElementById("averagesSection");
// For daily charts
const dailyChartsContainer = document.getElementById("dailyChartsContainer");
// Nutrient Modal + inputs
const nutrientModalBackdrop = document.getElementById("nutrientModalBackdrop");
const nutrientModal = document.getElementById("nutrientModal");
const openNutrientModalBtn = document.getElementById("openNutrientModalBtn");
const closeNutrientModalBtn = document.getElementById("closeNutrientModalBtn");
const dateInput = document.getElementById('dateInput');
const caloriesInput = document.getElementById('caloriesInput');
const burnedInput = document.getElementById('burnedInput');
const carbsInput = document.getElementById('carbsInput');
const sugarInput = document.getElementById('sugarInput');
const proteinInput = document.getElementById('proteinInput');
const fiberInput = document.getElementById('fiberInput');
const fatInput = document.getElementById('fatInput');
const sodiumInput = document.getElementById('sodiumInput');
const caloriesIndicator = document.getElementById('caloriesIndicator');
const burnedIndicator = document.getElementById('burnedIndicator');
const carbsIndicator = document.getElementById('carbsIndicator');
const sugarIndicator = document.getElementById('sugarIndicator');
const proteinIndicator = document.getElementById('proteinIndicator');
const fiberIndicator = document.getElementById('fiberIndicator');
const fatIndicator = document.getElementById('fatIndicator');
const sodiumIndicator = document.getElementById('sodiumIndicator');
const saveBtn = document.getElementById('save-btn');
// Target Modal
const targetModalBackdrop = document.getElementById("targetModalBackdrop");
const targetTable = document.getElementById("targetTable");
const saveTargetsBtn = document.getElementById("saveTargetsBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
/********************************************************
* Global state
********************************************************/
let currentUser = null;
let editDocId = null;
let currentDocs = [];
let selectedRange = "all";
let userTargets = {
calories: 2000,
carbs: 200,
sugar: 25,
protein: 160,
fiber: 38,
fat: 50,
sodium: 1500,
deficit: 500
};
const nutrientNames = ["calories", "carbs", "sugar", "protein", "fiber", "fat", "sodium", "deficit"];
let sortColumn = "date";
let sortDirection = "desc";
/********************************************************
* Helper: parse numeric string
********************************************************/
function toNumber(str) {
return Number(str.replace(/[^\d.]/g, "")) || 0;
}
/********************************************************
* Trend helper functions with improvements
********************************************************/
// Linear regression slope calculation (x = days since first record)
function linearRegressionSlope(docs, extractor) {
if (docs.length < 2) return 0;
const sortedDocs = docs.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
const baseTime = new Date(sortedDocs[0].date).getTime();
const xs = [];
const ys = [];
sortedDocs.forEach(doc => {
const days = (new Date(doc.date).getTime() - baseTime) / (1000 * 60 * 60 * 24);
xs.push(days);
ys.push(extractor(doc));
});
const n = xs.length;
const sumX = xs.reduce((a, b) => a + b, 0);
const sumY = ys.reduce((a, b) => a + b, 0);
let sumXY = 0,
sumXX = 0;
for (let i = 0; i < n; i++) {
sumXY += xs[i] * ys[i];
sumXX += xs[i] * xs[i];
}
const numerator = n * sumXY - sumX * sumY;
const denominator = n * sumXX - sumX * sumX;
if (denominator === 0) return 0;
return numerator / denominator;
}
// Updated computeTrend for any nutrient (except deficit)
function computeTrend(nutrient, docs) {
const sortedDocs = docs.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
if (sortedDocs.length < 2) return {
avgTrend: "neutral",
medTrend: "neutral"
};
// Use linear regression for average trend
const slope = linearRegressionSlope(sortedDocs, d => d[nutrient] || 0);
const avgTrend = slope > 0 ? "up" : (slope < 0 ? "down" : "neutral");
// Compute median trend using split-half comparison
const mid = Math.floor(sortedDocs.length / 2);
const firstHalf = sortedDocs.slice(0, mid);
const secondHalf = sortedDocs.slice(mid);
const median = arr => {
const s = arr.slice().sort((a, b) => a - b);
const len = s.length;
return len % 2 === 1 ? s[Math.floor(len / 2)] : (s[len / 2 - 1] + s[len / 2]) / 2;
};
const med1 = median(firstHalf.map(d => d[nutrient] || 0));
const med2 = median(secondHalf.map(d => d[nutrient] || 0));
const medTrend = med2 > med1 ? "up" : (med2 < med1 ? "down" : "neutral");
return {
avgTrend,
medTrend
};
}
// Updated computeTrendForDeficit using regression on computed deficits
function computeTrendForDeficit(docs) {
const sortedDocs = docs.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
if (sortedDocs.length < 2) return {
avgTrend: "neutral",
medTrend: "neutral"
};
const slope = linearRegressionSlope(sortedDocs, d => computeDailyDeficit(d));
const avgTrend = slope > 0 ? "up" : (slope < 0 ? "down" : "neutral");
const mid = Math.floor(sortedDocs.length / 2);
const firstHalf = sortedDocs.slice(0, mid);
const secondHalf = sortedDocs.slice(mid);
const median = arr => {
const s = arr.slice().sort((a, b) => a - b);
const len = s.length;
return len % 2 === 1 ? s[Math.floor(len / 2)] : (s[len / 2 - 1] + s[len / 2]) / 2;
};
const med1 = median(firstHalf.map(d => computeDailyDeficit(d)));
const med2 = median(secondHalf.map(d => computeDailyDeficit(d)));
const medTrend = med2 > med1 ? "up" : (med2 < med1 ? "down" : "neutral");
return {
avgTrend,
medTrend
};
}

function getTrendArrow(trend) {
if (trend === "up") return "⬆️";
if (trend === "down") return "⬇️";
return "";
}
// New helper to format deficits:
// If the value is negative (surplus), we prefix it with a plus sign;
// if positive (true deficit), just show the number.
function formatDeficit(value) {
const rounded = Math.round(Math.abs(value));
return value < 0 ? `+${rounded}` : `${rounded}`;
}
/********************************************************
* Auth logic
********************************************************/
loginBtn.onclick = async function() {
const email = emailEl.value;
const password = passwordEl.value;
if (!email || !password) return alert("Fill in both fields");
try {
const userCred = await auth.signInWithEmailAndPassword(email, password);
currentUser = userCred.user;
} catch (err) {
// If sign-in fails, create a new user
const userCred = await auth.createUserWithEmailAndPassword(email, password);
currentUser = userCred.user;
// Initialize doc
await db.collection("users").doc(currentUser.uid).set({
theme: 'dark',
targets: userTargets
});
}
};
logoutBtn.onclick = () => {
auth.signOut();
currentUser = null;
};
auth.onAuthStateChanged(async (user) => {
if (user) {
currentUser = user;
loginContainer.classList.add('hidden');
appContainer.classList.remove('hidden');
await loadUserData();
fetchDataAndRender();
} else {
loginContainer.classList.remove('hidden');
appContainer.classList.add('hidden');
}
});
async function loadUserData() {
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme) {
    applyTheme(storedTheme);
  }
  const userDoc = await db.collection("users").doc(currentUser.uid).get();
  let theme = storedTheme || "dark";
  if (userDoc.exists) {
    const data = userDoc.data();
    if (!storedTheme && data.theme) theme = data.theme;
    if (data.targets) userTargets = data.targets;
  } else {
    await db.collection("users").doc(currentUser.uid).set({
      theme,
      targets: userTargets
    }, {
      merge: true
    });
  }
  applyTheme(theme);
  localStorage.setItem("theme", theme);
}
/********************************************************
* Theme toggling
********************************************************/
themeToggleBtn.onclick = async function() {
  if (!currentUser) return;
  const newTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
  localStorage.setItem("theme", newTheme);
  applyTheme(newTheme);
  await db.collection("users").doc(currentUser.uid).set({
    theme: newTheme
  }, {
    merge: true
  });
};

function applyTheme(mode) {
if (mode === "dark") {
document.body.classList.remove("light-mode");
document.body.classList.add("dark-mode");
themeToggleBtn.textContent = "Toggle Light Mode";
} else {
document.body.classList.remove("dark-mode");
document.body.classList.add("light-mode");
themeToggleBtn.textContent = "Toggle Dark Mode";
}
}
/********************************************************
* Nutrient Modal logic
********************************************************/
openNutrientModalBtn.addEventListener("click", () => {
editDocId = null;
clearForm();
openNutrientModal();
});
closeNutrientModalBtn.addEventListener("click", () => {
closeNutrientModal();
});

function openNutrientModal() {
nutrientModalBackdrop.style.display = 'flex';
}

function closeNutrientModal() {
nutrientModalBackdrop.style.display = 'none';
}
saveBtn.onclick = async function() {
if (!dateInput.value) return alert("Please select a date");
const burnedVal = burnedInput.value === "" ? 2000 : toNumber(burnedInput.value);
const payload = {
uid: currentUser.uid,
date: dateInput.value,
calories: toNumber(caloriesInput.value),
caloriesBurned: burnedVal,
carbs: toNumber(carbsInput.value),
sugar: toNumber(sugarInput.value),
protein: toNumber(proteinInput.value),
fiber: toNumber(fiberInput.value),
fat: toNumber(fatInput.value),
sodium: toNumber(sodiumInput.value)
};
try {
if (editDocId) {
await db.collection("dailyNutrients").doc(editDocId).update(payload);
editDocId = null;
} else {
await db.collection("dailyNutrients").add(payload);
}
} catch (error) {
alert("Failed to save data: " + error.message);
}
clearForm();
closeNutrientModal();
fetchDataAndRender();
};

function clearForm() {
dateInput.value = "";
caloriesInput.value = "";
burnedInput.value = "";
carbsInput.value = "";
sugarInput.value = "";
proteinInput.value = "";
fiberInput.value = "";
fatInput.value = "";
sodiumInput.value = "";
}
/********************************************************
* Live labels for numeric fields
********************************************************/
function addLiveLabel(inputEl, labelEl, labelSuffix) {
inputEl.addEventListener("input", () => {
const val = inputEl.value;
labelEl.textContent = val ? `~${val} ${labelSuffix}` : "";
});
}
addLiveLabel(caloriesInput, caloriesIndicator, "calories consumed");
addLiveLabel(burnedInput, burnedIndicator, "calories burned");
addLiveLabel(carbsInput, carbsIndicator, "grams of carbs");
addLiveLabel(sugarInput, sugarIndicator, "grams of sugar");
addLiveLabel(proteinInput, proteinIndicator, "grams of protein");
addLiveLabel(fiberInput, fiberIndicator, "grams of fiber");
addLiveLabel(fatInput, fatIndicator, "grams of fat");
addLiveLabel(sodiumInput, sodiumIndicator, "milligrams of sodium");
/********************************************************
* Data fetch / Sorting / Filtering
********************************************************/
function computeDailyDeficit(doc) {
const calsBurned = doc.caloriesBurned !== undefined ? doc.caloriesBurned : (userTargets.calories || 2000);
return calsBurned - (doc.calories || 0);
}
const nutrientUnits = {
calories: "cals",
carbs: "g",
sugar: "g",
protein: "g",
fiber: "g",
fat: "g",
sodium: "mg",
deficit: "cal"
};
const nutrientEmojis = {
calories: "🪳",
carbs: "🍞",
sugar: "🍭",
protein: "🍖",
fiber: "🌱",
fat: "🧈",
sodium: "🥢",
deficit: "🔥"
};

function getDeficitArrow(value) {
return value < 0 ? "⬆️" : "⬇️";
}
async function fetchDataAndRender() {
const snapshot = await db.collection("dailyNutrients")
.where("uid", "==", currentUser.uid)
.get();
currentDocs = snapshot.docs.map(doc => ({
...doc.data(),
id: doc.id
}));
const filtered = filterDocsByRange(currentDocs, selectedRange);
doSort(filtered);
renderAll(filtered);
}

function filterDocsByRange(docs, range) {
if (range === "prev") {
const sortedDesc = [...docs].sort((a, b) => new Date(b.date) - new Date(a.date));
return sortedDesc.slice(1);
}
if (range === "all") return docs;
const num = parseInt(range, 10);
if (isNaN(num)) return docs;
const sortedDesc = [...docs].sort((a, b) => new Date(b.date) - new Date(a.date));
return sortedDesc.slice(0, num);
}

function doSort(docs) {
if (sortColumn === "date" && sortDirection === "desc") {
docs.sort((a, b) => new Date(b.date) - new Date(a.date));
return;
}
docs.sort((a, b) => {
let valA, valB;
if (sortColumn === "deficit") {
const defA = computeDailyDeficit(a);
const defB = computeDailyDeficit(b);
const transA = defA < 0 ? (2000000 + Math.abs(defA)) : Math.abs(defA);
const transB = defB < 0 ? (2000000 + Math.abs(defB)) : Math.abs(defB);
valA = transA;
valB = transB;
} else if (sortColumn === "date") {
valA = new Date(a.date);
valB = new Date(b.date);
} else {
valA = a[sortColumn] || 0;
valB = b[sortColumn] || 0;
}
if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
return 0;
});
}

function renderAll(docs) {
renderTable(docs);
renderAveragesSection(docs);
renderDailyPieCharts(docs);
}
/********************************************************
* Render existing entries (table)
********************************************************/
function renderTable(docs) {
tableBody.innerHTML = "";
docs.forEach(doc => {
const tr = document.createElement("tr");
const dateObj = new Date(doc.date + "T00:00:00");
const dateString = `${dateObj.toLocaleDateString("en-US", { weekday: "short" })} ${dateObj.getMonth() + 1}/${dateObj.getDate()}/${String(dateObj.getFullYear()).slice(2)}`;
const dailyDeficit = computeDailyDeficit(doc);
const arrow = getDeficitArrow(dailyDeficit);
const absDef = Math.round(Math.abs(dailyDeficit));
let resultWord = "deficit";
if (dailyDeficit < 0) resultWord = "surplus";
tr.innerHTML = `
<td>${dateString}</td>
<td class="col-calories">${Math.round(doc.calories)} ${nutrientUnits.calories}</td>
<td class="col-burned">${Math.round(doc.caloriesBurned)} cals</td>
<td class="col-deficit">${arrow} ${absDef}-calorie ${resultWord}</td>
<td class="col-carbs">${Math.round(doc.carbs)} ${nutrientUnits.carbs}</td>
<td class="col-sugar">${Math.round(doc.sugar)} ${nutrientUnits.sugar}</td>
<td class="col-protein">${Math.round(doc.protein)} ${nutrientUnits.protein}</td>
<td class="col-fiber">${Math.round(doc.fiber)} ${nutrientUnits.fiber}</td>
<td class="col-fat">${Math.round(doc.fat)} ${nutrientUnits.fat}</td>
<td class="col-sodium">${Math.round(doc.sodium)} ${nutrientUnits.sodium}</td>
<td><button data-id="${doc.id}">Edit</button></td>
`;
tr.querySelector("button").addEventListener("click", () => {
loadEditForm(doc);
openNutrientModal();
});
tableBody.appendChild(tr);
});
}

function loadEditForm(doc) {
editDocId = doc.id;
dateInput.value = doc.date;
caloriesInput.value = doc.calories;
burnedInput.value = doc.caloriesBurned !== undefined ? doc.caloriesBurned : "";
carbsInput.value = doc.carbs;
sugarInput.value = doc.sugar;
proteinInput.value = doc.protein;
fiberInput.value = doc.fiber;
fatInput.value = doc.fat;
sodiumInput.value = doc.sodium;
}
// Export CSV functionality
const exportCSVBtn = document.getElementById("exportCSVBtn");
exportCSVBtn.addEventListener("click", exportCSV);

function exportCSV() {
if (!currentDocs || !currentDocs.length) {
return alert("No entries to export.");
}
// Define fields to process (note: 'deficit' is computed)
const exportFields = ["calories", "caloriesBurned", "deficit", "carbs", "sugar", "protein", "fiber", "fat", "sodium"];
// Compute sums and arrays for averages and medians
let sums = {};
let arrays = {};
exportFields.forEach(field => {
sums[field] = 0;
arrays[field] = [];
});
currentDocs.forEach(doc => {
exportFields.forEach(field => {
let value = field === "deficit" ? computeDailyDeficit(doc) : doc[field] || 0;
sums[field] += value;
arrays[field].push(value);
});
});
const count = currentDocs.length;
let averages = {};
let medians = {};
exportFields.forEach(field => {
averages[field] = sums[field] / count;
let sorted = arrays[field].slice().sort((a, b) => a - b);
let median = sorted.length % 2 === 1 ?
sorted[Math.floor(sorted.length / 2)] :
(sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
medians[field] = median;
});
// Function to format deficit/surplus values
function formatDeficit(value) {
return value < 0 ? value : `+${value}`;
}
// Build CSV rows.
const avgRow = [
"Averages",
averages.calories.toFixed(2),
averages.caloriesBurned.toFixed(2),
formatDeficit(averages.deficit.toFixed(2)),
averages.carbs.toFixed(2),
averages.sugar.toFixed(2),
averages.protein.toFixed(2),
averages.fiber.toFixed(2),
averages.fat.toFixed(2),
averages.sodium.toFixed(2)
];
const medRow = [
"Medians",
medians.calories.toFixed(2),
medians.caloriesBurned.toFixed(2),
formatDeficit(medians.deficit.toFixed(2)),
medians.carbs.toFixed(2),
medians.sugar.toFixed(2),
medians.protein.toFixed(2),
medians.fiber.toFixed(2),
medians.fat.toFixed(2),
medians.sodium.toFixed(2)
];
const headerRow = [
"Date",
"Calories Consumed",
"Calories Burned",
"Caloric Balance (Deficit(-)/Surplus(+))",
"Carbs",
"Sugar",
"Protein",
"Fiber",
"Fat",
"Sodium"
];
const dataRows = currentDocs.map(doc => [
doc.date,
doc.calories || 0,
doc.caloriesBurned || 0,
formatDeficit(computeDailyDeficit(doc)), // Apply formatting
doc.carbs || 0,
doc.sugar || 0,
doc.protein || 0,
doc.fiber || 0,
doc.fat || 0,
doc.sodium || 0
]);
const rows = [avgRow, medRow, headerRow, ...dataRows];
const csvContent = rows.map(r => r.join(",")).join("\n");
// Create a Blob and trigger the download
const blob = new Blob([csvContent], {
type: "text/csv;charset=utf-8;"
});
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "nutrition_entries.csv";
a.style.display = "none";
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
}
/********************************************************
* Render averages section with trend indicators at bottom
* (Modified to use buttons that mimic the Add New Day button,
*  and updated deficit formatting)
********************************************************/
function renderAveragesSection(docs) {
if (!docs.length) {
averagesSection.innerHTML = "<h2>Trends</h2><p>No data yet</p>";
return;
}
// Calculate sums, averages, and medians
const sums = {};
const allValues = {};
nutrientNames.forEach(k => {
sums[k] = 0;
allValues[k] = [];
});
docs.forEach(d => {
["calories", "carbs", "sugar", "protein", "fiber", "fat", "sodium"].forEach(k => {
sums[k] += d[k] || 0;
allValues[k].push(d[k] || 0);
});
const dd = computeDailyDeficit(d);
sums.deficit += dd;
allValues.deficit.push(dd);
});
const count = docs.length || 1;
const averages = {};
const medians = {};
nutrientNames.forEach(k => {
averages[k] = sums[k] / count;
const sortedVals = allValues[k].slice().sort((a, b) => a - b);
if (sortedVals.length) {
if (sortedVals.length % 2 === 1) {
medians[k] = sortedVals[Math.floor(sortedVals.length / 2)];
} else {
const mid1 = sortedVals[sortedVals.length / 2 - 1];
const mid2 = sortedVals[sortedVals.length / 2];
medians[k] = (mid1 + mid2) / 2;
}
} else {
medians[k] = 0;
}
});
// Structure: header, then range buttons, then the cards
let html = `
<div class="trends-header">
<h2>Trends</h2>
</div>
<div class="range-buttons" style="margin-top: 0.5rem;">
<button class="range-btn" data-range="prev">Day Before Most Recent</button>
<button class="range-btn" data-range="all">All Time</button>
<button class="range-btn" data-range="3">Last 3 Days</button>
<button class="range-btn" data-range="7">Last 7 Days</button>
<button class="range-btn" data-range="30">Last 30 Days</button>
</div>
<span class="update-targets-link" id="updateTargetsLink">Update Target Goals?</span>
<div class="cards-container">
`;
const customOrder = ["calories", "deficit", "carbs", "sugar", "protein", "fiber", "fat", "sodium"];
customOrder.forEach(item => {
const avgVal = Math.round(averages[item] || 0);
const medVal = Math.round(medians[item] || 0);
const limitVal = userTargets[item] || 0;
let trendInfo;
if (item === "deficit") {
trendInfo = computeTrendForDeficit(docs);
} else {
trendInfo = computeTrend(item, docs);
}
let trendArrowHTML = "";
if (trendInfo.avgTrend && trendInfo.medTrend && trendInfo.avgTrend !== "neutral" && trendInfo.medTrend !== "neutral") {
if (trendInfo.avgTrend === trendInfo.medTrend) {
trendArrowHTML = getTrendArrow(trendInfo.avgTrend);
} else {
trendArrowHTML = `Avg ${getTrendArrow(trendInfo.avgTrend)} / Med ${getTrendArrow(trendInfo.medTrend)}`;
}
}
const cardClass = `col-${item}`;
if (item === "deficit") {
html += `
<div class="nutrient-card ${cardClass}">
<h4>${nutrientEmojis[item] || ""} ${item.toUpperCase()}</h4>
<p class="nutrient-stats">Avg: <strong>${formatDeficit(averages[item] || 0)} ${nutrientUnits[item]}</strong> / ${limitVal} ${nutrientUnits[item]}</p>
<p class="nutrient-stats">Median: <strong>${formatDeficit(medians[item] || 0)} ${nutrientUnits[item]}</strong> / ${limitVal} ${nutrientUnits[item]}</p>
<div class="trend-indicator">${trendArrowHTML}</div>
</div>
`;
} else {
html += `
<div class="nutrient-card ${cardClass}">
<h4>${nutrientEmojis[item] || ""} ${item.toUpperCase()}</h4>
<p class="nutrient-stats">Avg: <strong>${avgVal} ${nutrientUnits[item]}</strong> / ${limitVal} ${nutrientUnits[item]}</p>
<p class="nutrient-stats">Median: <strong>${medVal} ${nutrientUnits[item]}</strong> / ${limitVal} ${nutrientUnits[item]}</p>
<div class="trend-indicator">${trendArrowHTML}</div>
</div>
`;
}
});
html += `</div>`;
html += `
<canvas id="macroChart"></canvas>
<p class="recommended-text">
<b>Recommended Macro Ratio for Lean Muscle Growth:</b><br>
Protein: 35–40% | Carbs: 35–40% | Fat: 20–25%
</p>
`;
averagesSection.innerHTML = html;
// Add event listeners to each range button
document.querySelectorAll('.range-btn').forEach(btn => {
if (btn.getAttribute('data-range') === selectedRange) {
btn.classList.add('active');
}
btn.addEventListener('click', function() {
selectedRange = this.getAttribute('data-range');
document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
this.classList.add('active');
fetchDataAndRender();
});
});
document.getElementById("updateTargetsLink").addEventListener("click", openTargetModal);
renderPieChart(averages);
}
// Single "average" pie chart
function renderPieChart(averages) {
const proteinCals = (averages.protein || 0) * 4;
const carbCals = (averages.carbs || 0) * 4;
const fatCals = (averages.fat || 0) * 9;
const existingChart = Chart.getChart("macroChart");
if (existingChart) existingChart.destroy();
new Chart(document.getElementById("macroChart"), {
type: 'pie',
data: {
labels: ['Protein', 'Carbs', 'Fat'],
datasets: [{
data: [proteinCals, carbCals, fatCals],
backgroundColor: ['#6666FF', '#3ECC3E', '#FF66B2']
}]
},
options: {
responsive: true,
plugins: {
title: {
display: true,
text: 'Average Macro Breakdown (by Calorie)'
},
datalabels: {
color: '#fff',
formatter: (value, ctx) => {
const total = ctx.dataset.data.reduce((acc, val) => acc + val, 0);
const percent = total ? (value / total * 100).toFixed(1) + '%' : '0%';
const labelName = ctx.chart.data.labels[ctx.dataIndex];
return labelName + ': ' + percent;
}
}
}
},
plugins: [ChartDataLabels]
});
}
/********************************************************
* Daily Macro Pie Charts (one per day)
********************************************************/
function renderDailyPieCharts(docs) {
dailyChartsContainer.innerHTML = "";
docs.forEach(doc => {
const block = document.createElement("div");
block.classList.add("daily-chart-block");
const dateObj = new Date(doc.date + "T00:00:00");
const dayLabel = dateObj.toLocaleDateString("en-US", {
weekday: "short"
}) + " " + (dateObj.getMonth() + 1) + "/" + dateObj.getDate() + "/" + String(dateObj.getFullYear()).slice(2);
const heading = document.createElement("h4");
heading.textContent = `Daily Macro Breakdown (${dayLabel})`;
block.appendChild(heading);
const dayCanvas = document.createElement("canvas");
dayCanvas.classList.add("daily-chart-canvas");
block.appendChild(dayCanvas);
dailyChartsContainer.appendChild(block);
const dailyProteinCals = (doc.protein || 0) * 4;
const dailyCarbsCals = (doc.carbs || 0) * 4;
const dailyFatCals = (doc.fat || 0) * 9;
new Chart(dayCanvas, {
type: 'pie',
data: {
labels: ['Protein', 'Carbs', 'Fat'],
datasets: [{
data: [dailyProteinCals, dailyCarbsCals, dailyFatCals],
backgroundColor: ['#6666FF', '#3ECC3E', '#FF66B2']
}]
},
options: {
responsive: false,
plugins: {
title: {
display: false
},
datalabels: {
color: '#fff',
formatter: (value, ctx) => {
const total = ctx.dataset.data.reduce((acc, val) => acc + val, 0);
const percent = total ? (value / total * 100).toFixed(1) + '%' : '0%';
const labelName = ctx.chart.data.labels[ctx.dataIndex];
return labelName + ': ' + percent;
}
}
}
},
plugins: [ChartDataLabels]
});
});
}
/********************************************************
* Target Modal
********************************************************/
function openTargetModal() {
buildTargetTable();
targetModalBackdrop.style.display = 'flex';
}

function closeTargetModal() {
targetModalBackdrop.style.display = 'none';
}

function buildTargetTable() {
let html = "";
nutrientNames.forEach(n => {
html += `
<tr>
<td>${n.toUpperCase()}</td>
<td><input type="number" id="target_${n}" value="${userTargets[n] || 0}" /></td>
</tr>
`;
});
targetTable.innerHTML = html;
}
saveTargetsBtn.onclick = async function() {
nutrientNames.forEach(n => {
const el = document.getElementById("target_" + n);
userTargets[n] = Number(el.value) || 0;
});
await db.collection("users").doc(currentUser.uid).set({
targets: userTargets
}, {
merge: true
});
closeTargetModal();
fetchDataAndRender();
};
closeModalBtn.onclick = closeTargetModal;
/********************************************************
* Table Sorting (by any column)
********************************************************/
const thEls = document.querySelectorAll('#nutrientTable thead th[data-sortcol]');
thEls.forEach(th => {
const indicator = document.createElement('div');
indicator.classList.add('sort-indicator');
th.appendChild(indicator);
th.addEventListener('click', () => {
const col = th.getAttribute('data-sortcol');
if (sortColumn !== col) {
sortColumn = col;
sortDirection = 'asc';
} else {
if (sortDirection === 'asc') {
sortDirection = 'desc';
} else if (sortDirection === 'desc') {
sortColumn = 'date';
sortDirection = 'desc';
}
}
thEls.forEach(th2 => {
const indEl = th2.querySelector('.sort-indicator');
if (indEl) indEl.textContent = '';
});
if (!(sortColumn === 'date' && sortDirection === 'desc')) {
const label = (sortDirection === 'asc') ? 'ascending' : 'descending';
const myIndEl = th.querySelector('.sort-indicator');
if (myIndEl) myIndEl.textContent = label;
}
fetchDataAndRender();
});
});
