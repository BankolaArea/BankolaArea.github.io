/**
 * 4-Chamber Fuel Tanker Volume Calculator
 * Certified Piecewise Linear Dipstick Interpolation System
 * NKKB Fuel Meter - Bankola Area
 */

// Certified calibration data (0 to 5,000 Ltr in 200 L intervals)
const CALIBRATION_DATA = [
  { volume: 0.0, chambers: [0.0, 0.0, 0.0, 0.0] },
  { volume: 200.0, chambers: [9.4, 9.3, 10.2, 10.0] },
  { volume: 400.0, chambers: [16.3, 16.3, 17.2, 17.2] },
  { volume: 600.0, chambers: [22.4, 22.3, 23.4, 23.6] },
  { volume: 800.0, chambers: [28.2, 28.2, 29.5, 29.5] },
  { volume: 1000.0, chambers: [33.8, 33.9, 35.4, 34.8] },
  { volume: 1200.0, chambers: [39.6, 39.5, 41.0, 40.4] },
  { volume: 1400.0, chambers: [44.8, 45.1, 46.5, 45.6] },
  { volume: 1600.0, chambers: [50.2, 50.2, 52.1, 50.9] },
  { volume: 1800.0, chambers: [55.4, 55.4, 57.3, 56.1] },
  { volume: 2000.0, chambers: [60.9, 60.8, 62.8, 61.0] },
  { volume: 2200.0, chambers: [65.9, 66.0, 68.3, 65.9] },
  { volume: 2400.0, chambers: [71.1, 71.3, 73.6, 70.8] },
  { volume: 2600.0, chambers: [76.3, 76.7, 78.7, 76.0] },
  { volume: 2800.0, chambers: [81.7, 81.9, 84.1, 81.0] },
  { volume: 3000.0, chambers: [86.8, 87.1, 89.4, 85.9] },
  { volume: 3200.0, chambers: [91.9, 92.3, 94.7, 90.7] },
  { volume: 3400.0, chambers: [97.2, 97.5, 99.9, 95.7] },
  { volume: 3600.0, chambers: [102.4, 102.8, 105.2, 100.8] },
  { volume: 3800.0, chambers: [107.5, 108.1, 110.6, 105.8] },
  { volume: 4000.0, chambers: [112.8, 113.6, 115.8, 110.8] },
  { volume: 4200.0, chambers: [118.1, 118.8, 121.3, 115.9] },
  { volume: 4400.0, chambers: [123.4, 124.3, 126.5, 121.1] },
  { volume: 4600.0, chambers: [128.7, 129.8, 132.0, 126.3] },
  { volume: 4800.0, chambers: [134.0, 135.4, 137.5, 131.6] },
  { volume: 5000.0, chambers: [139.5, 141.0, 143.1, 137.0] }
];

const CHAMBER_NAMES = ['1st Chamber', '2nd Chamber', '3rd Chamber', '4th Chamber'];
const CHAMBER_CAPACITY = 5000.0;
const TOTAL_CAPACITY = 20000.0;
const DEFAULT_SAMPLES = [94.9, 90.3, 88.0, 84.1];
const STORAGE_KEY = 'nkkb_fuelmeter_last_dips';

// Max dipstick reading for each chamber
const MAX_DIPS = [139.5, 141.0, 143.1, 137.0];

/**
 * Calculates volume using piecewise linear interpolation
 */
function calculateChamberVolume(chamberIndex, rawInput) {
  const maxDip = MAX_DIPS[chamberIndex];

  if (rawInput === null || rawInput === undefined || rawInput === '' || isNaN(rawInput)) {
    return {
      isValid: false,
      volume: null,
      fillPct: 0,
      segment: '-',
      statusText: 'Pending Dip',
      statusClass: 'badge-empty',
      activeRowIndex: -1
    };
  }

  const dip = Number(rawInput);

  // Negative validation
  if (dip < 0) {
    return {
      isValid: false,
      volume: null,
      fillPct: 0,
      segment: 'Invalid (< 0 cm)',
      statusText: 'Error: Negative',
      statusClass: 'badge-error',
      activeRowIndex: -1
    };
  }

  // Overflow validation
  if (dip > maxDip) {
    return {
      isValid: false,
      volume: null,
      fillPct: 1,
      segment: `Over Max (> ${maxDip.toFixed(1)} cm)`,
      statusText: 'Error: Overflow',
      statusClass: 'badge-error',
      activeRowIndex: -1
    };
  }

  // Exact maximum capacity
  if (dip === maxDip) {
    const lastRow = CALIBRATION_DATA.length - 1;
    const prevRow = lastRow - 1;
    const cm1 = CALIBRATION_DATA[prevRow].chambers[chamberIndex];
    const deltaCm = maxDip - cm1;
    const rate = deltaCm > 0 ? (200 / deltaCm).toFixed(1) : '-';
    const seg = `${cm1.toFixed(1)} - ${maxDip.toFixed(1)} cm (${CALIBRATION_DATA[prevRow].volume.toLocaleString()} - 5,000 L) @ ${rate} L/cm`;
    return {
      isValid: true,
      volume: CHAMBER_CAPACITY,
      fillPct: 1.0,
      segment: seg,
      statusText: 'Full Chamber',
      statusClass: 'badge-full',
      activeRowIndex: prevRow
    };
  }

  // Find bounding interval k where CALIBRATION_DATA[k] <= dip < CALIBRATION_DATA[k+1]
  let k = 0;
  for (let i = 0; i < CALIBRATION_DATA.length; i++) {
    if (CALIBRATION_DATA[i].chambers[chamberIndex] <= dip) {
      k = i;
    } else {
      break;
    }
  }

  const cm1 = CALIBRATION_DATA[k].chambers[chamberIndex];
  const cm2 = CALIBRATION_DATA[k + 1].chambers[chamberIndex];
  const v1 = CALIBRATION_DATA[k].volume;
  const v2 = CALIBRATION_DATA[k + 1].volume;

  // Linear interpolation: V = V1 + (dip - cm1) * (V2 - V1) / (cm2 - cm1)
  const deltaCm = cm2 - cm1;
  const rate = deltaCm > 0 ? (200 / deltaCm).toFixed(1) : '-';
  const vol = v1 + (dip - cm1) * (v2 - v1) / deltaCm;
  const roundedVol = Math.round(vol * 10) / 10;
  const fillPct = roundedVol / CHAMBER_CAPACITY;

  let statusText = 'Active Fill';
  let statusClass = 'badge-active';
  if (roundedVol === 0) {
    statusText = 'Empty Chamber';
    statusClass = 'badge-empty';
  } else if (roundedVol >= CHAMBER_CAPACITY) {
    statusText = 'Full Chamber';
    statusClass = 'badge-full';
  }

  const seg = `${cm1.toFixed(1)} - ${cm2.toFixed(1)} cm (${v1.toLocaleString()} - ${v2.toLocaleString()} L) @ ${rate} L/cm`;

  return {
    isValid: true,
    volume: roundedVol,
    fillPct: fillPct,
    segment: seg,
    statusText: statusText,
    statusClass: statusClass,
    activeRowIndex: k
  };
}

/**
 * Main application controller
 */
document.addEventListener('DOMContentLoaded', () => {
  renderChamberRows();
  renderCalibrationTable();
  renderMobileChamberCards();
  setupEventListeners();
  setupMobileCardListeners();
  ViewModeController.init();

  // Check persistent browser storage for last entered values
  const restored = loadFromStorage();
  if (restored) {
    showToast('Restored last entered dipstick values.');
  } else {
    // Start with blank/zero inputs if no previous values exist
    loadValues(['', '', '', '']);
  }
});

/**
 * Storage helpers for browser persistent memory (localStorage)
 */
function saveToStorage() {
  try {
    const dips = [];
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`dip-input-${i}`);
      dips.push(el ? el.value.trim() : '');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dips));
  } catch (err) {
    console.warn('Storage unavailable:', err);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 4) {
      const hasAnyValue = parsed.some(v => v !== '' && v !== null && !isNaN(v));
      if (hasAnyValue) {
        loadValues(parsed);
        return true;
      }
    }
  } catch (err) {
    console.warn('Failed to read from storage:', err);
  }
  return false;
}

/**
 * Render the interactive calculation table rows
 */
function renderChamberRows() {
  const tbody = document.getElementById('chamber-rows');
  tbody.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    const tr = document.createElement('tr');
    tr.id = `chamber-row-${i}`;
    tr.innerHTML = `
      <td><strong>${CHAMBER_NAMES[i]}</strong></td>
      <td>${MAX_DIPS[i].toFixed(1)} cm</td>
      <td>
        <div class="dip-stepper-wrap">
          <button type="button" class="btn-step" data-action="dec" data-target="${i}" title="Decrease 0.1 cm (Shift for 1.0 cm)">&minus;</button>
          <div class="dip-input-wrap">
            <input 
              type="number" 
              id="dip-input-${i}" 
              class="dip-input" 
              min="0" 
              max="${MAX_DIPS[i]}" 
              step="0.1" 
              placeholder="0.0"
              data-chamber="${i}"
            >
            <span class="dip-unit">cm</span>
          </div>
          <button type="button" class="btn-step" data-action="inc" data-target="${i}" title="Increase 0.1 cm (Shift for 1.0 cm)">+</button>
        </div>
      </td>
      <td class="vol-cell" id="vol-cell-${i}">-</td>
      <td>${CHAMBER_CAPACITY.toLocaleString()} L</td>
      <td class="fill-cell" id="fill-cell-${i}">0.0%</td>
      <td class="segment-cell" id="seg-cell-${i}">-</td>
    `;
    tbody.appendChild(tr);
  }
}

/**
 * Render the fixed certified calibration chart table with 4 separate chamber segment rates
 */
function renderCalibrationTable() {
  const tbody = document.getElementById('calib-tbody');
  tbody.innerHTML = '';

  for (let r = 0; r < CALIBRATION_DATA.length; r++) {
    const row = CALIBRATION_DATA[r];
    const tr = document.createElement('tr');
    tr.id = `calib-row-${r}`;

    const rates = [];
    for (let c = 0; c < 4; c++) {
      if (r === 0) {
        rates.push({ text: '-', isZero: true });
      } else {
        const prev = CALIBRATION_DATA[r - 1];
        const deltaCm = row.chambers[c] - prev.chambers[c];
        if (deltaCm > 0) {
          const rate = 200 / deltaCm;
          rates.push({ text: rate.toFixed(1), isZero: false });
        } else {
          rates.push({ text: '-', isZero: true });
        }
      }
    }

    tr.innerHTML = `
      <td><strong>${row.volume.toLocaleString()} L</strong></td>
      <td class="col-divider">${row.chambers[0].toFixed(1)}</td>
      <td>${row.chambers[1].toFixed(1)}</td>
      <td>${row.chambers[2].toFixed(1)}</td>
      <td>${row.chambers[3].toFixed(1)}</td>
      <td class="col-divider ${rates[0].isZero ? 'rate-empty' : 'rate-val'}">${rates[0].text}</td>
      <td class="${rates[1].isZero ? 'rate-empty' : 'rate-val'}">${rates[1].text}</td>
      <td class="${rates[2].isZero ? 'rate-empty' : 'rate-val'}">${rates[2].text}</td>
      <td class="${rates[3].isZero ? 'rate-empty' : 'rate-val'}">${rates[3].text}</td>
    `;
    tbody.appendChild(tr);
  }
}

/**
 * Recalculate all 4 chambers and update KPIs, tanker visual, and active segment rows
 */
function recalculateAll() {
  let totalVolume = 0;
  let activeChambersCount = 0;
  let sumDips = 0;
  let enteredDipsCount = 0;
  const activeSegments = new Set();

  for (let i = 0; i < 4; i++) {
    const inputEl = document.getElementById(`dip-input-${i}`);
    const rawVal = inputEl.value.trim();
    const result = calculateChamberVolume(i, rawVal === '' ? null : Number(rawVal));

    // Cells
    const volCell = document.getElementById(`vol-cell-${i}`);
    const fillCell = document.getElementById(`fill-cell-${i}`);
    const segCell = document.getElementById(`seg-cell-${i}`);

    // Visual tanker elements
    const liquidEl = document.getElementById(`liquid-${i}`);
    const liquidLabel = document.getElementById(`liquid-label-${i}`);
    const markerEl = document.getElementById(`marker-${i}`);

    if (result.isValid && result.volume !== null) {
      volCell.textContent = `${result.volume.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
      volCell.style.color = '#38bdf8';
      fillCell.textContent = `${(result.fillPct * 100).toFixed(1)}%`;
      segCell.textContent = result.segment;

      totalVolume += result.volume;
      activeChambersCount++;

      // Update liquid graphics
      const heightPercent = Math.min(Math.max(result.fillPct * 100, 0), 100);
      liquidEl.style.height = `${heightPercent}%`;
      liquidLabel.textContent = `${result.volume.toFixed(0)} L`;
      markerEl.textContent = `${Number(rawVal).toFixed(1)} cm`;

      if (result.fillPct >= 1) {
        liquidEl.style.background = 'var(--fuel-liquid-full)';
      } else {
        liquidEl.style.background = 'var(--fuel-liquid)';
      }

      if (result.activeRowIndex >= 0) {
        activeSegments.add(result.activeRowIndex);
      }
    } else {
      // Pending or invalid
      const isError = result.segment.startsWith('Invalid') || result.segment.startsWith('Over');
      volCell.textContent = isError ? result.segment : '-';
      volCell.style.color = isError ? 'var(--status-error)' : '#38bdf8';
      fillCell.textContent = '0.0%';
      segCell.textContent = result.segment;

      liquidEl.style.height = result.statusClass === 'badge-error' ? '100%' : '0%';
      liquidLabel.textContent = result.statusClass === 'badge-error' ? 'ERR' : '0 L';
      markerEl.textContent = rawVal === '' ? '—' : `${Number(rawVal).toFixed(1)} cm`;
      if (result.statusClass === 'badge-error') {
        liquidEl.style.background = 'var(--fuel-liquid-error)';
      }
    }

    if (result.isValid && result.volume !== null && rawVal !== '' && !isNaN(rawVal)) {
      sumDips += Number(rawVal);
      enteredDipsCount++;
    }
  }

  // Update Footer summary row
  const avgDip = enteredDipsCount > 0 ? (sumDips / enteredDipsCount).toFixed(1) : '—';
  document.getElementById('foot-avg-dip').innerHTML = `<strong>Avg: ${avgDip}${avgDip !== '—' ? ' cm' : ''}</strong>`;
  document.getElementById('foot-total-vol').innerHTML = `<strong>${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L</strong>`;
  const overallFillPct = (totalVolume / TOTAL_CAPACITY) * 100;
  document.getElementById('foot-fill-pct').innerHTML = `<strong>${overallFillPct.toFixed(1)}%</strong>`;

  // Update Top KPIs
  document.getElementById('kpi-total-vol').innerHTML = `${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span class="unit">L</span>`;
  document.getElementById('kpi-active-count').textContent = `Across ${activeChambersCount} active chambers`;

  const ullage = Math.max(TOTAL_CAPACITY - totalVolume, 0);
  document.getElementById('kpi-ullage').innerHTML = `${ullage.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span class="unit">L</span>`;
  document.getElementById('kpi-ullage-text').textContent = `Room for ${ullage.toLocaleString(undefined, { maximumFractionDigits: 0 })} L`;

  document.getElementById('kpi-fill-ratio').innerHTML = `${overallFillPct.toFixed(1)} <span class="unit">%</span>`;
  document.getElementById('kpi-fill-bar').style.width = `${Math.min(overallFillPct, 100)}%`;

  // Tanker overall status badge
  const tankerBadge = document.getElementById('tanker-overall-status');
  if (totalVolume === 0) {
    tankerBadge.textContent = 'Tanker Empty';
    tankerBadge.className = 'badge badge-empty';
  } else if (totalVolume >= TOTAL_CAPACITY) {
    tankerBadge.textContent = 'Tanker Full (100%)';
    tankerBadge.className = 'badge badge-full';
  } else {
    tankerBadge.textContent = `Operating (${overallFillPct.toFixed(1)}% Loaded)`;
    tankerBadge.className = 'badge badge-active';
  }

  // Highlight calibration table rows
  for (let r = 0; r < CALIBRATION_DATA.length; r++) {
    const rowEl = document.getElementById(`calib-row-${r}`);
    if (rowEl) {
      if (activeSegments.has(r)) {
        rowEl.classList.add('highlight-segment');
      } else {
        rowEl.classList.remove('highlight-segment');
      }
    }
  }

  // Automatically save current inputs to persistent browser storage
  saveToStorage();

  // Keep mobile chamber cards in sync after every recalculation
  syncMobileCards();
}

/**
 * Load array of dip readings into the inputs
 */
function loadValues(arr) {
  for (let i = 0; i < 4; i++) {
    const input = document.getElementById(`dip-input-${i}`);
    if (input) {
      const val = arr && arr[i] !== undefined && arr[i] !== null ? arr[i] : '';
      input.value = (val !== '' && !isNaN(val)) ? Number(val).toFixed(1) : '';
    }
  }
  recalculateAll();
}

/**
 * Setup UI event listeners
 */
function setupEventListeners() {
  // Live input recalculations
  for (let i = 0; i < 4; i++) {
    const input = document.getElementById(`dip-input-${i}`);
    input.addEventListener('input', recalculateAll);
    input.addEventListener('change', recalculateAll);
  }

  // Stepper buttons (+/- 0.1 cm, Shift for 1.0 cm)
  document.querySelectorAll('.btn-step').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.currentTarget.dataset.target);
      const action = e.currentTarget.dataset.action;
      const input = document.getElementById(`dip-input-${idx}`);
      let current = parseFloat(input.value);
      if (isNaN(current)) current = 0.0;
      const step = e.shiftKey ? 1.0 : 0.1;
      let next = action === 'inc' ? current + step : current - step;
      next = Math.max(0, Math.min(next, MAX_DIPS[idx]));
      input.value = (Math.round(next * 10) / 10).toFixed(1);
      recalculateAll();
    });
  });

  // Preset buttons
  document.getElementById('btn-sample').addEventListener('click', () => {
    loadValues(DEFAULT_SAMPLES);
    showToast('Loaded certified sample dip values (12,310 L).');
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    loadValues(['', '', '', '']);
    showToast('Reset all dip values.');
  });

  document.getElementById('btn-full').addEventListener('click', () => {
    loadValues(MAX_DIPS);
    showToast('Loaded 100% full capacity dips (20,000 L).');
  });

  document.getElementById('btn-copy-report').addEventListener('click', copySummaryReport);

  // Collapsible calibration accordion
  const calibToggle = document.getElementById('calibration-toggle');
  const calibBody = document.getElementById('calibration-body');
  const arrow = document.getElementById('accordion-arrow');

  calibToggle.addEventListener('click', () => {
    calibBody.classList.toggle('open');
    arrow.classList.toggle('open');
  });
}

/**
 * Generate and copy formatted summary report to clipboard
 */
function copySummaryReport() {
  const timestamp = new Date().toLocaleString();
  let text = `=================================================\n`;
  text += `   FUEL TANKER MEASUREMENT & VOLUME REPORT      \n`;
  text += `   Bankola Area - NKKB Fuel Meter               \n`;
  text += `   Date & Time: ${timestamp}\n`;
  text += `=================================================\n\n`;

  let totalVol = 0;
  for (let i = 0; i < 4; i++) {
    const input = document.getElementById(`dip-input-${i}`);
    const raw = input.value.trim();
    const res = calculateChamberVolume(i, raw === '' ? null : Number(raw));
    const dipStr = raw === '' ? 'Pending' : `${Number(raw).toFixed(1)} cm`;
    const volStr = res.volume !== null ? `${res.volume.toFixed(1)} L` : 'N/A';
    const fillStr = res.volume !== null ? `${(res.fillPct * 100).toFixed(1)}%` : '0%';

    text += `[${CHAMBER_NAMES[i]}]\n`;
    text += `  - Dipstick Reading: ${dipStr} (Max: ${MAX_DIPS[i].toFixed(1)} cm)\n`;
    text += `  - Volume:           ${volStr} / 5,000 L (${fillStr})\n`;
    text += `  - Segment:          ${res.segment}\n\n`;

    if (res.volume) totalVol += res.volume;
  }

  const ullage = Math.max(TOTAL_CAPACITY - totalVol, 0);
  const fillRatio = ((totalVol / TOTAL_CAPACITY) * 100).toFixed(1);

  text += `-------------------------------------------------\n`;
  text += `TOTAL VOLUME:      ${totalVol.toFixed(1)} Liters\n`;
  text += `TANKER CAPACITY:   ${TOTAL_CAPACITY.toLocaleString()} Liters\n`;
  text += `AVAILABLE ULLAGE:  ${ullage.toFixed(1)} Liters\n`;
  text += `OVERALL FILL:      ${fillRatio}%\n`;
  text += `=================================================\n`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('Summary report copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy to clipboard.');
  });
}

/**
 * Minimal toast notice
 */
function showToast(msg) {
  let toast = document.querySelector('.toast-notice');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

/* ==========================================================================
   MOBILE CHAMBER CARDS
   ========================================================================== */

/**
 * Render the 4 mobile chamber cards (each replaces one table row on mobile).
 * Inputs are separate from desktop table inputs; synced bi-directionally.
 */
function renderMobileChamberCards() {
  const container = document.getElementById('mobile-chamber-cards');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    const card = document.createElement('div');
    card.className = 'mob-chamber-card';
    card.id = `mob-card-${i}`;
    card.innerHTML = `
      <div class="mob-card-header">
        <span class="mob-chamber-name">${CHAMBER_NAMES[i]}</span>
        <span id="mob-status-${i}" class="badge badge-empty">Pending Dip</span>
      </div>
      <div class="mob-card-maxdip">Max dipstick: ${MAX_DIPS[i].toFixed(1)} cm &nbsp;|&nbsp; Capacity: 5,000 L</div>
      <div class="dip-stepper-wrap mob-stepper">
        <button type="button" class="btn-step mob-step" data-action="dec" data-target="${i}" title="Decrease 0.1 cm (Shift for 1.0 cm)">&minus;</button>
        <div class="dip-input-wrap">
          <input
            type="number"
            id="mob-dip-input-${i}"
            class="dip-input"
            min="0"
            max="${MAX_DIPS[i]}"
            step="0.1"
            placeholder="0.0"
            data-chamber="${i}"
          >
          <span class="dip-unit">cm</span>
        </div>
        <button type="button" class="btn-step mob-step" data-action="inc" data-target="${i}" title="Increase 0.1 cm (Shift for 1.0 cm)">+</button>
      </div>
      <div class="mob-card-result">
        <span class="mob-vol" id="mob-vol-${i}">— L</span>
        <span class="mob-fill" id="mob-fill-${i}">0.0%</span>
      </div>
      <div class="mob-card-minibar">
        <div class="mob-card-minibar-fill" id="mob-bar-${i}" style="width: 0%;"></div>
      </div>
      <details class="mob-segment-details">
        <summary>Calibration Segment Reference</summary>
        <span class="mob-segment-text" id="mob-seg-${i}">—</span>
      </details>
    `;
    container.appendChild(card);
  }
}

/**
 * Wire up event listeners for the mobile card inputs and stepper buttons.
 * Changes in mobile inputs are mirrored to the desktop inputs, then recalculated.
 */
function setupMobileCardListeners() {
  for (let i = 0; i < 4; i++) {
    const mobInput = document.getElementById(`mob-dip-input-${i}`);
    if (!mobInput) continue;
    mobInput.addEventListener('input', () => { syncToDesktop(i); recalculateAll(); });
    mobInput.addEventListener('change', () => { syncToDesktop(i); recalculateAll(); });
  }

  document.querySelectorAll('.mob-step').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.currentTarget.dataset.target);
      const action = e.currentTarget.dataset.action;
      const mobInput = document.getElementById(`mob-dip-input-${idx}`);
      let current = parseFloat(mobInput.value);
      if (isNaN(current)) current = 0.0;
      const step = e.shiftKey ? 1.0 : 0.1;
      let next = action === 'inc' ? current + step : current - step;
      next = Math.max(0, Math.min(next, MAX_DIPS[idx]));
      mobInput.value = (Math.round(next * 10) / 10).toFixed(1);
      syncToDesktop(idx);
      recalculateAll();
    });
  });
}

/** Push a mobile input value into the matching desktop input */
function syncToDesktop(idx) {
  const mob = document.getElementById(`mob-dip-input-${idx}`);
  const desk = document.getElementById(`dip-input-${idx}`);
  if (mob && desk) desk.value = mob.value;
}

/**
 * Update every mobile card's displayed result and sync its input value.
 * Called at the tail of recalculateAll() so mobile cards always match desktop.
 */
function syncMobileCards() {
  for (let i = 0; i < 4; i++) {
    const deskInput = document.getElementById(`dip-input-${i}`);
    const mobInput  = document.getElementById(`mob-dip-input-${i}`);
    if (!deskInput || !mobInput) continue;

    // Sync value only when the mobile input isn't currently focused
    if (mobInput !== document.activeElement) {
      mobInput.value = deskInput.value;
    }

    const rawVal = deskInput.value.trim();
    const result = calculateChamberVolume(i, rawVal === '' ? null : Number(rawVal));

    const volEl    = document.getElementById(`mob-vol-${i}`);
    const fillEl   = document.getElementById(`mob-fill-${i}`);
    const barEl    = document.getElementById(`mob-bar-${i}`);
    const segEl    = document.getElementById(`mob-seg-${i}`);
    const statusEl = document.getElementById(`mob-status-${i}`);

    if (result.isValid && result.volume !== null) {
      const pct = (result.fillPct * 100).toFixed(1);
      volEl.textContent  = `${result.volume.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
      volEl.style.color  = '#38bdf8';
      fillEl.textContent = `${pct}%`;
      barEl.style.width  = `${Math.min(result.fillPct * 100, 100)}%`;
      barEl.style.background = result.fillPct >= 1
        ? '#10b981'
        : 'linear-gradient(90deg, #0284c7, #38bdf8)';
      segEl.textContent    = result.segment;
      statusEl.textContent = result.statusText;
      statusEl.className   = `badge ${result.statusClass}`;
    } else {
      const isError = result.segment.startsWith('Invalid') || result.segment.startsWith('Over');
      volEl.textContent  = isError ? result.segment : '—';
      volEl.style.color  = isError ? 'var(--status-error)' : '#38bdf8';
      fillEl.textContent = '0.0%';
      barEl.style.width  = '0%';
      segEl.textContent    = result.segment;
      statusEl.textContent = result.statusText;
      statusEl.className   = `badge ${result.statusClass}`;
    }
  }
}

/* ==========================================================================
   VIEW MODE CONTROLLER
   Auto-detects portrait/landscape via aspect ratio.
   3-way manual toggle: Auto → Lock Mobile → Lock Desktop → Auto
   Preference persisted in localStorage under key 'nkkb_view_mode'.
   ========================================================================== */

const ViewModeController = {
  LOCK_KEY: 'nkkb_view_mode', // stored value: 'mobile' | 'desktop' | (absent = auto)
  currentLock: null,          // null = auto-detect, 'mobile' or 'desktop' = locked

  init() {
    // Restore saved lock preference
    try {
      const saved = localStorage.getItem(this.LOCK_KEY);
      if (saved === 'mobile' || saved === 'desktop') this.currentLock = saved;
    } catch (e) {}

    this.applyMode();
    this.updateToggleButton();

    // Re-evaluate auto mode on resize (ignored when locked)
    window.addEventListener('resize', () => {
      if (!this.currentLock) {
        this.applyMode();
        this.updateToggleButton();
      }
    });

    const btn = document.getElementById('btn-toggle-view');
    if (btn) btn.addEventListener('click', () => this.cycle());
  },

  /** Returns 'mobile' when portrait (aspect < 1), 'desktop' otherwise */
  getAutoDetected() {
    return window.innerWidth / window.innerHeight < 1.0 ? 'mobile' : 'desktop';
  },

  /** The mode currently in effect (respects lock or falls back to auto) */
  getEffectiveMode() {
    return this.currentLock || this.getAutoDetected();
  },

  /** 3-way cycle: auto → lock-mobile → lock-desktop → auto */
  cycle() {
    if (!this.currentLock) {
      this.currentLock = 'mobile';
    } else if (this.currentLock === 'mobile') {
      this.currentLock = 'desktop';
    } else {
      this.currentLock = null; // back to auto
    }

    try {
      if (this.currentLock) {
        localStorage.setItem(this.LOCK_KEY, this.currentLock);
      } else {
        localStorage.removeItem(this.LOCK_KEY);
      }
    } catch (e) {}

    this.applyMode();
    this.updateToggleButton();

    const label = this.currentLock
      ? `Switched to ${this.currentLock === 'mobile' ? 'Mobile' : 'Desktop'} view (locked).`
      : `Auto view mode — ${this.getAutoDetected()} detected.`;
    showToast(label);
  },

  /** Add/remove body classes to trigger the CSS mode rules */
  applyMode() {
    const mode = this.getEffectiveMode();
    document.body.classList.toggle('mode-mobile',  mode === 'mobile');
    document.body.classList.toggle('mode-desktop', mode === 'desktop');
  },

  /** Update the toggle button label to reflect current state */
  updateToggleButton() {
    const btn = document.getElementById('btn-toggle-view');
    if (!btn) return;

    const mode   = this.getEffectiveMode();
    const isAuto = !this.currentLock;
    const stateLabel = isAuto ? 'Auto' : 'Locked';

    const mobileIcon  = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
    const desktopIcon = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>`;

    btn.innerHTML = `
      ${mode === 'mobile' ? mobileIcon : desktopIcon}
      ${mode === 'mobile' ? 'Mobile' : 'Desktop'}
      <span class="view-toggle-state">${stateLabel}</span>
    `;

    const nextAction = !this.currentLock
      ? 'click to lock Mobile'
      : this.currentLock === 'mobile'
        ? 'click to lock Desktop'
        : 'click to return to Auto';
    btn.title = `Layout: ${mode} (${isAuto ? 'auto-detected' : 'locked'}) — ${nextAction}`;
  }
};

