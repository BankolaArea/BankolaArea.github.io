/**
 * ============================================================================
 * PART B.QGS CLIENT-SIDE WEBGIS & COG RASTER ENGINE
 * ============================================================================
 * Leverages client-side WebAssembly, WebGL, and OpenLayers to render
 * QGIS project layers (.qgs) and AWS Sentinel-2 Cloud-Optimized GeoTIFFs (COGs)
 * directly in the web browser without any server-side rendering stack.
 */

// ---------------------------------------------------------------------------
// 1. PROJECT DATA & CONFIGURATION (Extracted directly from Part B.qgs)
// ---------------------------------------------------------------------------

const QGIS_PROJECT_INFO = {
  filename: "Part B.qgs",
  version: "3.44.15-Solothurn",
  user: "Administrator / Arpan Halder",
  saveDateTime: "2026-10-24 13:40:42",
  crs: "EPSG:4326 (WGS 84)",
  projectedCrs: "EPSG:32645 (WGS 84 / UTM zone 45N)",
  extent: [87.2757366, 23.6746642, 87.2940692, 23.6915430], // [xmin, ymin, xmax, ymax]
  center: [87.2865, 23.6895], // Lon, Lat
  defaultZoom: 15
};

// Part B OCP Mining Lease Boundary Coordinates (from Part-B-OCP.kml)
const PART_B_OCP_POLYGON = [
  [87.2845870925932, 23.68416998949326],
  [87.28650444077128, 23.68426505813315],
  [87.28873377130202, 23.68497986245143],
  [87.29097437253427, 23.68627544080558],
  [87.29190157515191, 23.68860687560328],
  [87.29235903969432, 23.69056561100825],
  [87.29139734932187, 23.69292773152466],
  [87.28957998369646, 23.69494905299791],
  [87.28479716397254, 23.69637769177361],
  [87.27944107630566, 23.69349280760841],
  [87.2845870925932, 23.68416998949326]
];

// Sentinel-2 L2A Cloud-Optimized GeoTIFFs (COGs) defined in Part B.qgs
// Tracked with both acquisition date AND exact file placement order
const SENTINEL_LAYERS_CONFIG = [
  {
    id: "s2_20261020",
    name: "S2 [2026-10-20] (14.1% cloud) - TCI",
    shortName: "2026-10-20 (14.1% cloud)",
    date: "2026-10-20",
    cloud: "14.1%",
    clean: false,
    fileOrderIndex: 0,
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/45/Q/WG/2026/10/S2B_45QWG_20261020_0_L2A/TCI.tif",
    defaultChecked: false
  },
  {
    id: "s2_20261015",
    name: "S2 [2026-10-15] (Cloud 1.7%) [Cleanest ⭐]",
    shortName: "2026-10-15 (1.7% cloud)",
    date: "2026-10-15",
    cloud: "1.7%",
    clean: true,
    fileOrderIndex: 1,
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/45/Q/WG/2026/10/S2C_45QWG_20261015_0_L2A/TCI.tif",
    defaultChecked: true
  },
  {
    id: "s2_20261005",
    name: "S2 [2026-10-05] (5.7% cloud) - TCI",
    shortName: "2026-10-05 (5.7% cloud)",
    date: "2026-10-05",
    cloud: "5.7%",
    clean: true,
    fileOrderIndex: 2,
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/45/Q/WG/2026/10/S2C_45QWG_20261005_0_L2A/TCI.tif",
    defaultChecked: false
  },
  {
    id: "s2_20260927",
    name: "S2 [2026-09-27] (26.5% cloud) - TCI",
    shortName: "2026-09-27 (26.5% cloud)",
    date: "2026-09-27",
    cloud: "26.5%",
    clean: false,
    fileOrderIndex: 3,
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/45/Q/WG/2026/9/S2A_45QWG_20260927_0_L2A/TCI.tif",
    defaultChecked: false
  },
  {
    id: "s2_20260915",
    name: "S2 [2026-09-15] (28.5% cloud) - TCI",
    shortName: "2026-09-15 (28.5% cloud)",
    date: "2026-09-15",
    cloud: "28.5%",
    clean: false,
    fileOrderIndex: 4,
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/45/Q/WG/2026/9/S2C_45QWG_20260915_0_L2A/TCI.tif",
    defaultChecked: false
  },
  {
    id: "s2_truecolor_20261005",
    name: "Sentinel-2 True Color (2026-10-05, Clean 5% clouds)",
    shortName: "2026-10-05 True Color",
    date: "2026-10-05",
    cloud: "5.0%",
    clean: true,
    fileOrderIndex: 5,
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/45/Q/WG/2026/10/S2C_45QWG_20261005_0_L2A/TCI.tif",
    defaultChecked: false
  }
];

// ---------------------------------------------------------------------------
// 2. COORDINATE PROJECTION REGISTRATION (UTM Zone 45N / EPSG:32645)
// ---------------------------------------------------------------------------

if (typeof proj4 !== 'undefined' && typeof ol !== 'undefined' && ol.proj && ol.proj.proj4) {
  // Define UTM Zone 45N (EPSG:32645) used by Sentinel-2 tile 45QWG
  proj4.defs("EPSG:32645", "+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs");
  ol.proj.proj4.register(proj4);
}

// ---------------------------------------------------------------------------
// 3. APPLICATION STATE
// ---------------------------------------------------------------------------

const state = {
  map: null,
  baseLayers: {},
  activeBaseKey: "google-earth",
  rasterLayers: {},
  activeRasterId: "s2_20261015",
  swipeSecondaryRasterId: "s2_20260915",
  isSwipeActive: false,
  swipePercent: 50,
  vectorLayer: null,
  drawInteraction: null,
  measureActive: false,
  rasterFilters: {
    brightness: 100,
    contrast: 115,
    saturation: 120,
    gamma: 100,
    preset: "natural"
  }
};

// ---------------------------------------------------------------------------
// 4. MAP INITIALIZATION (OpenLayers Engine)
// ---------------------------------------------------------------------------

function initWebGisMap() {
  const centerMercator = ol.proj.fromLonLat(QGIS_PROJECT_INFO.center);

  // BASE LAYERS
  state.baseLayers["google-earth"] = new ol.layer.Tile({
    title: "Google Earth Satellite",
    source: new ol.source.XYZ({
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      maxZoom: 20
    }),
    visible: true
  });

  state.baseLayers["google-traffic"] = new ol.layer.Tile({
    title: "Google Traffic",
    source: new ol.source.XYZ({
      url: "https://mt1.google.com/vt/lyrs=h@159000000,traffic|seconds_into_week:-1&style=3&x={x}&y={y}&z={z}",
      maxZoom: 20
    }),
    visible: false
  });

  state.baseLayers["esri-sat"] = new ol.layer.Tile({
    title: "Esri World Imagery",
    source: new ol.source.XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 19
    }),
    visible: false
  });

  state.baseLayers["carto-dark"] = new ol.layer.Tile({
    title: "CartoDB Dark Matter",
    source: new ol.source.XYZ({
      url: "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
      maxZoom: 19
    }),
    visible: false
  });

  state.baseLayers["osm"] = new ol.layer.Tile({
    title: "OpenStreetMap",
    source: new ol.source.OSM(),
    visible: false
  });

  // INITIALIZE SENTINEL-2 COG RASTER LAYERS
  initSentinelCogLayers();

  // INITIALIZE VECTOR BOUNDARY LAYER (Part-B-OCP.kml)
  initVectorBoundaryLayer();

  // ASSEMBLE MAP VIEW
  const mapExtentMercator = ol.proj.transformExtent(
    QGIS_PROJECT_INFO.extent,
    "EPSG:4326",
    "EPSG:3857"
  );

  state.map = new ol.Map({
    target: "map",
    layers: [
      state.baseLayers["google-earth"],
      state.baseLayers["google-traffic"],
      state.baseLayers["esri-sat"],
      state.baseLayers["carto-dark"],
      state.baseLayers["osm"],
      ...Object.values(state.rasterLayers),
      state.vectorLayer
    ],
    view: new ol.View({
      center: centerMercator,
      zoom: QGIS_PROJECT_INFO.defaultZoom,
      minZoom: 6,
      maxZoom: 19
    }),
    controls: ol.control.defaults.defaults({
      attribution: true,
      zoom: false,
      rotate: true
    }).extend([
      new ol.control.ScaleLine({ units: "metric", bar: true, steps: 4, text: true })
    ])
  });

  // SETUP EVENT LISTENERS
  setupMapEvents();
  setupSidebarUI();
  setupFilterControls();
  setupSwipeFeature();
  setupMeasureTool();
  setupDragAndDrop();
  setupMobileAndAdaptiveView();
  loadAndParseQgsProject();
  populatePitAnalyticsTable();

  // Apply default raster image filters
  applyRasterFilters();

  showToast("Part B.qgs loaded successfully with client-side WebGL engine!");
}

// ---------------------------------------------------------------------------
// 5. SENTINEL-2 COG RASTER LAYER CREATION
// ---------------------------------------------------------------------------

function initSentinelCogLayers() {
  SENTINEL_LAYERS_CONFIG.forEach(cfg => {
    // Primary WebGL GeoTIFF Source for direct byte-range COG reading
    let layer;
    try {
      const cogSource = new ol.source.GeoTIFF({
        sources: [
          {
            url: cfg.url,
            bands: [1, 2, 3] // True Color Bands Red, Green, Blue
          }
        ],
        convertToRGB: true,
        wrapX: true
      });

      layer = new ol.layer.WebGLTile({
        title: cfg.name,
        source: cogSource,
        visible: cfg.defaultChecked,
        opacity: 0.95
      });
    } catch (err) {
      console.warn("WebGLTile GeoTIFF fallback:", err);
      // Fallback raster tile source
      layer = new ol.layer.Tile({
        title: cfg.name,
        source: new ol.source.TileDebug(),
        visible: cfg.defaultChecked
      });
    }

    state.rasterLayers[cfg.id] = layer;
  });
}

// ---------------------------------------------------------------------------
// 6. VECTOR BOUNDARY LAYER (PART B OCP)
// ---------------------------------------------------------------------------

function initVectorBoundaryLayer() {
  const mercatorCoords = PART_B_OCP_POLYGON.map(pt => ol.proj.fromLonLat(pt));
  const polygonGeometry = new ol.geom.Polygon([mercatorCoords]);

  const feature = new (ol.Feature || (ol.feature && ol.feature.Feature))({
    geometry: polygonGeometry,
    name: "Part B OCP Mining Lease Boundary",
    area_ha: 118.42,
    state: "West Bengal, India"
  });

  const vectorSource = new ol.source.Vector({
    features: [feature]
  });

  state.vectorLayer = new ol.layer.Vector({
    source: vectorSource,
    style: createVectorStyle("#ff9800", 0.25),
    visible: true,
    zIndex: 99
  });
}

function createVectorStyle(borderColor, fillOpacity) {
  // Convert hex to rgba
  const hex = borderColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) || 255;
  const g = parseInt(hex.substring(2, 4), 16) || 152;
  const b = parseInt(hex.substring(4, 6), 16) || 0;

  return new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: `rgb(${r}, ${g}, ${b})`,
      width: 2.5,
      lineDash: [4, 4]
    }),
    fill: new ol.style.Fill({
      color: `rgba(${r}, ${g}, ${b}, ${fillOpacity})`
    }),
    image: new ol.style.Circle({
      radius: 6,
      fill: new ol.style.Fill({ color: "#ff9800" }),
      stroke: new ol.style.Stroke({ color: "#ffffff", width: 2 })
    })
  });
}

// ---------------------------------------------------------------------------
// 7. SIDEBAR & UI CONTROLS
// ---------------------------------------------------------------------------

function setupSidebarUI() {
  // Tab Switching
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add("active");
    });
  });

  // Strict Date Sorting with File Order Fallback
  state.layerSortMode = 'date-desc';
  renderRasterLayersList(state.layerSortMode);

  const btnToggleDateSort = document.getElementById("btnToggleDateSort");
  if (btnToggleDateSort) {
    btnToggleDateSort.addEventListener("click", () => {
      // Cycle: date-desc -> date-asc -> file-order -> back to date-desc
      if (state.layerSortMode === 'date-desc') {
        state.layerSortMode = 'date-asc';
      } else if (state.layerSortMode === 'date-asc') {
        state.layerSortMode = 'file-order';
      } else {
        state.layerSortMode = 'date-desc';
      }

      const label = document.getElementById("sortDateLabel");
      const icon = document.getElementById("sortDateIcon");

      if (state.layerSortMode === 'date-desc') {
        label.textContent = "Date: Newest First";
        icon.className = "fa-solid fa-arrow-down-short-wide";
        showToast("Sorted by Date (Newest First) • Fallback: File Order");
      } else if (state.layerSortMode === 'date-asc') {
        label.textContent = "Date: Oldest First";
        icon.className = "fa-solid fa-arrow-up-short-wide";
        showToast("Sorted by Date (Oldest First) • Fallback: File Order");
      } else {
        label.textContent = "Order Placed in File";
        icon.className = "fa-solid fa-list-ol";
        showToast("Sorted in the EXACT order placed in the QGS project file");
      }

      renderRasterLayersList(state.layerSortMode);
    });
  }

  // Vector Boundary Toggle
  const chkKmlBoundary = document.getElementById("chkKmlBoundary");
  chkKmlBoundary.addEventListener("change", (e) => {
    state.vectorLayer.setVisible(e.target.checked);
  });

  // Vector Style Customizer
  const kmlBorderColor = document.getElementById("kmlBorderColor");
  const kmlOpacity = document.getElementById("kmlOpacity");
  const kmlOpacityVal = document.getElementById("kmlOpacityVal");

  function updateVectorStyle() {
    const color = kmlBorderColor.value;
    const opacity = parseFloat(kmlOpacity.value);
    kmlOpacityVal.textContent = `${Math.round(opacity * 100)}%`;
    state.vectorLayer.setStyle(createVectorStyle(color, opacity));
  }

  kmlBorderColor.addEventListener("input", updateVectorStyle);
  kmlOpacity.addEventListener("input", updateVectorStyle);

  // Base Map Buttons
  const basemapBtns = document.querySelectorAll(".basemap-btn");
  basemapBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-base");
      switchBaseMap(key);
      basemapBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Navigation Header Buttons
  document.getElementById("btnFitExtent").addEventListener("click", fitToPartBExtent);
  document.getElementById("btnZoomToPit").addEventListener("click", fitToPartBExtent);

  document.getElementById("btnZoomIn").addEventListener("click", () => {
    const view = state.map.getView();
    view.animate({ zoom: view.getZoom() + 1, duration: 250 });
  });

  document.getElementById("btnZoomOut").addEventListener("click", () => {
    const view = state.map.getView();
    view.animate({ zoom: view.getZoom() - 1, duration: 250 });
  });

  document.getElementById("btnResetNorth").addEventListener("click", () => {
    const view = state.map.getView();
    view.animate({ rotation: 0, duration: 350 });
  });

  document.getElementById("btnToggleFullscreen").addEventListener("click", toggleFullscreen);
  const btnExportMap = document.getElementById("btnExportMap");
  if (btnExportMap) btnExportMap.addEventListener("click", exportMapSnapshot);
  document.getElementById("btnDownloadGeoJSON").addEventListener("click", exportGeoJson);

  // Close Legend
  const btnCloseLegend = document.getElementById("btnCloseLegend");
  if (btnCloseLegend) {
    btnCloseLegend.addEventListener("click", () => {
      const mapLegend = document.getElementById("mapLegend");
      if (mapLegend) mapLegend.style.display = "none";
    });
  }
}

// ---------------------------------------------------------------------------
// DATE IDENTIFICATION & STRICT ORDERING ENGINE
// ---------------------------------------------------------------------------

/**
 * Intelligently scans a layer for dates in name, metadata, or source URL.
 * Handles ISO (YYYY-MM-DD), Compact (YYYYMMDD), Slash (YYYY/MM/DD), or D-M-Y.
 * Returns { dateStr: string, timestamp: number } or null if JS cannot identify the date.
 */
function extractDateFromLayer(layer) {
  if (!layer) return null;

  // 1. Direct explicit date property
  if (layer.date && typeof layer.date === "string" && layer.date.trim() !== "") {
    const ts = new Date(layer.date).getTime();
    if (!isNaN(ts)) return { dateStr: layer.date, timestamp: ts };
  }

  const textToScan = `${layer.name || ''} ${layer.source || ''} ${layer.url || ''}`;

  // 2. Standard ISO date: YYYY-MM-DD, YYYY.MM.DD, or YYYY/MM/DD
  const isoMatch = textToScan.match(/\b(20\d{2})[-_/.](0[1-9]|1[0-2])[-_/.](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const dateStr = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const ts = new Date(dateStr).getTime();
    if (!isNaN(ts)) return { dateStr, timestamp: ts };
  }

  // 3. Compact Sentinel/Landsat timestamp: _YYYYMMDD_ (e.g. S2B_45QWG_20261020_0_L2A)
  const compactMatch = textToScan.match(/(?:_|\/|\b)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:_|\/|\b)/);
  if (compactMatch) {
    const dateStr = `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
    const ts = new Date(dateStr).getTime();
    if (!isNaN(ts)) return { dateStr, timestamp: ts };
  }

  // 4. Day-Month-Year: DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = textToScan.match(/\b(0[1-9]|[12]\d|3[01])[-_/.](0[1-9]|1[0-2])[-_/.](20\d{2})\b/);
  if (dmyMatch) {
    const dateStr = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    const ts = new Date(dateStr).getTime();
    if (!isNaN(ts)) return { dateStr, timestamp: ts };
  }

  // If JavaScript cannot identify the date:
  return null;
}

/**
 * Sorts layers strictly by Date if identified,
 * OR FALLS BACK TO THE EXACT ORDER AS PLACED IN THE FILE if date cannot be identified.
 */
function sortLayers(layers, sortMode = 'date-desc') {
  return [...layers].sort((a, b) => {
    // Mode 1: Strict File Order (exact order placed in project file)
    if (sortMode === 'file-order') {
      return (a.fileOrderIndex ?? 0) - (b.fileOrderIndex ?? 0);
    }

    const dateA = extractDateFromLayer(a);
    const dateB = extractDateFromLayer(b);

    // Case 1: Both layers have an identifiable date -> Sort chronologically
    if (dateA && dateB) {
      if (sortMode === 'date-desc') {
        const diff = dateB.timestamp - dateA.timestamp;
        if (diff !== 0) return diff;
      } else if (sortMode === 'date-asc') {
        const diff = dateA.timestamp - dateB.timestamp;
        if (diff !== 0) return diff;
      }
      // If dates are identical, keep order placed in file
      return (a.fileOrderIndex ?? 0) - (b.fileOrderIndex ?? 0);
    }

    // Case 2: One layer has a date, the other does NOT:
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;

    // Case 3: JS CANNOT IDENTIFY THE DATE:
    // STRICTLY PRESERVE THE ORDER PLACED IN THE FILE!
    return (a.fileOrderIndex ?? 0) - (b.fileOrderIndex ?? 0);
  });
}

// ---------------------------------------------------------------------------
// RENDER RASTER LAYERS LIST (WITH STRICT FILE ORDER FALLBACK)
// ---------------------------------------------------------------------------

function renderRasterLayersList(sortMode = 'date-desc') {
  const sortedLayers = sortLayers(SENTINEL_LAYERS_CONFIG, sortMode);

  const container = document.getElementById("rasterLayerList");
  if (!container) return;
  container.innerHTML = "";

  const swipeLeftSelect = document.getElementById("swipeLeftSelect");
  const swipeRightSelect = document.getElementById("swipeRightSelect");
  if (swipeLeftSelect && swipeRightSelect) {
    swipeLeftSelect.innerHTML = "";
    swipeRightSelect.innerHTML = "";
  }

  // Update total count badge
  const countEl = document.getElementById("s2LayerCount");
  if (countEl) countEl.textContent = `${sortedLayers.length} scenes`;

  sortedLayers.forEach((cfg) => {
    const card = document.createElement("div");
    card.className = `raster-layer-card ${cfg.id === state.activeRasterId ? "active-scene" : ""}`;
    card.id = `card_${cfg.id}`;

    const badgeClass = cfg.clean ? "badge-cloud-clean" : "badge-cloud-medium";
    const dateInfo = extractDateFromLayer(cfg);

    // Clear indicator: Date badge if identified, or "Order in File" if cannot be identified
    const dateBadgeHtml = dateInfo
      ? `<span class="badge-date-pill" title="Identified Date: ${dateInfo.dateStr}"><i class="fa-regular fa-calendar"></i> ${dateInfo.dateStr}</span>`
      : `<span class="badge-file-order" title="Date could not be identified by JS - placed in exact file order"><i class="fa-solid fa-file-lines"></i> Order in File: #${(cfg.fileOrderIndex ?? 0) + 1}</span>`;

    card.innerHTML = `
      <div class="layer-top-row">
        <label class="layer-title-group" for="radio_${cfg.id}">
          <input type="radio" name="activeRasterRadio" id="radio_${cfg.id}" value="${cfg.id}" ${cfg.id === state.activeRasterId ? "checked" : ""}>
          <span class="layer-title-text">${cfg.name}</span>
        </label>
        <span class="badge-cloud ${badgeClass}"><i class="fa-solid fa-cloud"></i> ${cfg.cloud || "N/A"}</span>
      </div>
      <div class="layer-meta-row">
        ${dateBadgeHtml}
        <span class="file-pos-tag" title="Exact placement order in QGIS project file">QGS File #${(cfg.fileOrderIndex ?? 0) + 1}</span>
      </div>
      <div class="layer-opacity-row">
        <span>Opacity:</span>
        <input type="range" class="raster-opacity-slider" data-layer="${cfg.id}" min="0" max="1" step="0.05" value="0.95" />
        <span id="val_opacity_${cfg.id}">95%</span>
      </div>
    `;

    container.appendChild(card);

    // Populate Swipe Selects
    if (swipeLeftSelect && swipeRightSelect) {
      const optLeft = document.createElement("option");
      optLeft.value = cfg.id;
      optLeft.textContent = dateInfo ? `[${dateInfo.dateStr}] ${cfg.shortName}` : `[File #${(cfg.fileOrderIndex ?? 0) + 1}] ${cfg.shortName}`;
      if (cfg.id === state.activeRasterId) optLeft.selected = true;
      swipeLeftSelect.appendChild(optLeft);

      const optRight = document.createElement("option");
      optRight.value = cfg.id;
      optRight.textContent = dateInfo ? `[${dateInfo.dateStr}] ${cfg.shortName}` : `[File #${(cfg.fileOrderIndex ?? 0) + 1}] ${cfg.shortName}`;
      if (cfg.id === state.swipeSecondaryRasterId) optRight.selected = true;
      swipeRightSelect.appendChild(optRight);
    }

    // Click handler for radio selection
    const radio = card.querySelector(`input[name="activeRasterRadio"]`);
    radio.addEventListener("change", () => {
      switchActiveRasterScene(cfg.id);
    });

    // Opacity handler
    const slider = card.querySelector(".raster-opacity-slider");
    const valLabel = card.querySelector(`#val_opacity_${cfg.id}`);
    slider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      valLabel.textContent = `${Math.round(val * 100)}%`;
      if (state.rasterLayers[cfg.id]) {
        state.rasterLayers[cfg.id].setOpacity(val);
      }
    });
  });
}

function switchBaseMap(activeKey) {
  state.activeBaseKey = activeKey;
  Object.keys(state.baseLayers).forEach(key => {
    state.baseLayers[key].setVisible(key === activeKey);
  });
  showToast(`Switched Base Map to ${state.baseLayers[activeKey].get("title")}`);
}

function switchActiveRasterScene(layerId) {
  state.activeRasterId = layerId;
  const cfg = SENTINEL_LAYERS_CONFIG.find(c => c.id === layerId);

  // Update UI cards
  document.querySelectorAll(".raster-layer-card").forEach(c => c.classList.remove("active-scene"));
  const activeCard = document.getElementById(`card_${layerId}`);
  if (activeCard) activeCard.classList.add("active-scene");

  // Update header and mobile scene label
  if (cfg) {
    const sceneNameEl = document.getElementById("currentSceneName");
    if (sceneNameEl) sceneNameEl.textContent = cfg.name;
    const mobileTag = document.getElementById("mobileSceneTag");
    if (mobileTag) mobileTag.textContent = `${cfg.shortName} ⭐`;
  }

  // Update layer visibility if not in swipe mode
  if (!state.isSwipeActive) {
    Object.keys(state.rasterLayers).forEach(id => {
      state.rasterLayers[id].setVisible(id === layerId);
    });
  }

  showToast(`Active COG Scene: ${cfg ? cfg.name : layerId}`);
}

function fitToPartBExtent() {
  const mercatorExtent = ol.proj.transformExtent(
    [87.2757366, 23.6746642, 87.2940692, 23.6963776],
    "EPSG:4326",
    "EPSG:3857"
  );
  state.map.getView().fit(mercatorExtent, {
    padding: [60, 60, 60, 60],
    duration: 800
  });
  showToast("Zoomed to Part B OCP boundary extent");
}

// ---------------------------------------------------------------------------
// 8. REAL-TIME GPU RASTER PROCESSING FILTERS
// ---------------------------------------------------------------------------

function setupFilterControls() {
  const rngBrightness = document.getElementById("rngBrightness");
  const rngContrast = document.getElementById("rngContrast");
  const rngSaturation = document.getElementById("rngSaturation");
  const rngGamma = document.getElementById("rngGamma");

  const lblBrightness = document.getElementById("lblBrightness");
  const lblContrast = document.getElementById("lblContrast");
  const lblSaturation = document.getElementById("lblSaturation");
  const lblGamma = document.getElementById("lblGamma");

  function update() {
    state.rasterFilters.brightness = parseInt(rngBrightness.value);
    state.rasterFilters.contrast = parseInt(rngContrast.value);
    state.rasterFilters.saturation = parseInt(rngSaturation.value);
    state.rasterFilters.gamma = parseInt(rngGamma.value);

    lblBrightness.textContent = `${state.rasterFilters.brightness}%`;
    lblContrast.textContent = `${state.rasterFilters.contrast}%`;
    lblSaturation.textContent = `${state.rasterFilters.saturation}%`;
    lblGamma.textContent = `${(state.rasterFilters.gamma / 100).toFixed(1)}x`;

    applyRasterFilters();
  }

  rngBrightness.addEventListener("input", update);
  rngContrast.addEventListener("input", update);
  rngSaturation.addEventListener("input", update);
  rngGamma.addEventListener("input", update);

  // Reset button
  document.getElementById("btnResetFilters").addEventListener("click", () => {
    applyPreset("natural");
  });

  // Presets
  const presetBtns = document.querySelectorAll(".btn-preset");
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyPreset(btn.getAttribute("data-preset"));
    });
  });
}

function applyPreset(preset) {
  state.rasterFilters.preset = preset;
  const rngBrightness = document.getElementById("rngBrightness");
  const rngContrast = document.getElementById("rngContrast");
  const rngSaturation = document.getElementById("rngSaturation");
  const rngGamma = document.getElementById("rngGamma");

  switch (preset) {
    case "natural":
      rngBrightness.value = 100;
      rngContrast.value = 115;
      rngSaturation.value = 120;
      rngGamma.value = 100;
      break;
    case "high-contrast":
      rngBrightness.value = 115;
      rngContrast.value = 160;
      rngSaturation.value = 135;
      rngGamma.value = 110;
      break;
    case "vegetation":
      rngBrightness.value = 105;
      rngContrast.value = 130;
      rngSaturation.value = 180;
      rngGamma.value = 100;
      break;
    case "grayscale":
      rngBrightness.value = 100;
      rngContrast.value = 140;
      rngSaturation.value = 0;
      rngGamma.value = 100;
      break;
  }

  // Trigger input event
  rngBrightness.dispatchEvent(new Event("input"));
  showToast(`Applied Raster Filter Preset: ${preset}`);
}

function applyRasterFilters() {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  const f = state.rasterFilters;
  const brightness = f.brightness / 100;
  const contrast = f.contrast / 100;
  const saturation = f.saturation / 100;

  // Apply CSS filter to WebGL canvas layer element
  const canvasElements = mapElement.querySelectorAll("canvas");
  canvasElements.forEach(canvas => {
    canvas.style.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
  });
}

// ---------------------------------------------------------------------------
// 9. SPLIT-SCREEN MULTI-DATE SWIPE COMPARISON
// ---------------------------------------------------------------------------

function setupSwipeFeature() {
  const btnToggleSwipe = document.getElementById("btnToggleSwipe");
  const btnActivateSwipe = document.getElementById("btnActivateSwipe");
  const swipeDivider = document.getElementById("swipeDivider");
  const mapViewport = document.getElementById("mapViewport");

  function toggleSwipeMode() {
    state.isSwipeActive = !state.isSwipeActive;
    btnToggleSwipe.classList.toggle("active", state.isSwipeActive);

    if (state.isSwipeActive) {
      swipeDivider.style.display = "block";
      updateSwipeLayers();
      showToast("Swipe comparison mode enabled. Drag the center slider!");
    } else {
      swipeDivider.style.display = "none";
      // Restore normal layer visibility
      switchActiveRasterScene(state.activeRasterId);
      // Remove any clipping
      const rightLayer = state.rasterLayers[state.swipeSecondaryRasterId];
      if (rightLayer) {
        const el = rightLayer.getElement ? rightLayer.getElement() : null;
        if (el) el.style.clipPath = "";
      }
      showToast("Swipe comparison mode disabled");
    }
  }

  btnToggleSwipe.addEventListener("click", toggleSwipeMode);
  btnActivateSwipe.addEventListener("click", () => {
    if (!state.isSwipeActive) toggleSwipeMode();
    else updateSwipeLayers();
  });

  // Swipe selection change
  document.getElementById("swipeLeftSelect").addEventListener("change", (e) => {
    state.activeRasterId = e.target.value;
    updateSwipeLayers();
  });

  document.getElementById("swipeRightSelect").addEventListener("change", (e) => {
    state.swipeSecondaryRasterId = e.target.value;
    updateSwipeLayers();
  });

  // Draggable Divider Logic
  let isDragging = false;

  swipeDivider.addEventListener("mousedown", (e) => {
    isDragging = true;
    document.body.style.cursor = "ew-resize";
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = "default";
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const rect = mapViewport.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percent = Math.max(5, Math.min(95, (offsetX / rect.width) * 100));

    state.swipePercent = percent;
    swipeDivider.style.left = `${percent}%`;

    applySwipeClipping();
  });

  // Touch support for mobile/tablets
  swipeDivider.addEventListener("touchstart", () => { isDragging = true; });
  window.addEventListener("touchend", () => { isDragging = false; });
  window.addEventListener("touchmove", (e) => {
    if (!isDragging || !e.touches[0]) return;
    const rect = mapViewport.getBoundingClientRect();
    const offsetX = e.touches[0].clientX - rect.left;
    const percent = Math.max(5, Math.min(95, (offsetX / rect.width) * 100));
    state.swipePercent = percent;
    swipeDivider.style.left = `${percent}%`;
    applySwipeClipping();
  });
}

function updateSwipeLayers() {
  const leftCfg = SENTINEL_LAYERS_CONFIG.find(c => c.id === state.activeRasterId);
  const rightCfg = SENTINEL_LAYERS_CONFIG.find(c => c.id === state.swipeSecondaryRasterId);

  document.getElementById("lblSwipeLeft").textContent = leftCfg ? leftCfg.shortName : "Left Layer";
  document.getElementById("lblSwipeRight").textContent = rightCfg ? rightCfg.shortName : "Right Layer";

  // Make both active
  Object.keys(state.rasterLayers).forEach(id => {
    const isVisible = (id === state.activeRasterId || id === state.swipeSecondaryRasterId);
    state.rasterLayers[id].setVisible(isVisible);
  });

  applySwipeClipping();
}

function applySwipeClipping() {
  // Use CSS clip-path on the right-hand layer element
  const rightLayer = state.rasterLayers[state.swipeSecondaryRasterId];
  if (!rightLayer) return;

  const rightEl = rightLayer.getElement ? rightLayer.getElement() : null;
  const pct = state.swipePercent;

  if (rightEl) {
    rightEl.style.clipPath = `polygon(${pct}% 0, 100% 0, 100% 100%, ${pct}% 100%)`;
  }

  // Also trigger OpenLayers render to keep canvas in sync
  state.map.render();
}

// ---------------------------------------------------------------------------
// 10. MEASUREMENT TOOL (DISTANCE & POLYGON AREA)
// ---------------------------------------------------------------------------

function setupMeasureTool() {
  const btnMeasure = document.getElementById("btnMeasure");
  const measureTooltip = document.getElementById("measureTooltip");

  let measureSource = new ol.source.Vector();
  let measureVector = new ol.layer.Vector({
    source: measureSource,
    style: new ol.style.Style({
      fill: new ol.style.Fill({ color: "rgba(56, 189, 248, 0.25)" }),
      stroke: new ol.style.Stroke({ color: "#38bdf8", width: 2, lineDash: [5, 5] }),
      image: new ol.style.Circle({
        radius: 5,
        fill: new ol.style.Fill({ color: "#06b6d4" }),
        stroke: new ol.style.Stroke({ color: "#ffffff", width: 2 })
      })
    }),
    zIndex: 100
  });
  state.map.addLayer(measureVector);

  let draw;

  btnMeasure.addEventListener("click", () => {
    state.measureActive = !state.measureActive;
    btnMeasure.classList.toggle("active", state.measureActive);

    if (state.measureActive) {
      measureSource.clear();
      measureTooltip.style.display = "block";
      measureTooltip.textContent = "Click on map to start measuring distance";

      draw = new ol.interaction.Draw({
        source: measureSource,
        type: "LineString"
      });

      draw.on("drawstart", (evt) => {
        const geom = evt.feature.getGeometry();
        geom.on("change", (e) => {
          const length = ol.sphere.getLength(e.target);
          const formatted = length > 1000
            ? `${(length / 1000).toFixed(2)} km`
            : `${Math.round(length)} m`;
          measureTooltip.textContent = `Distance: ${formatted}`;
        });
      });

      draw.on("drawend", () => {
        showToast("Measurement complete. Click Measure button again to clear.");
      });

      state.map.addInteraction(draw);
      state.drawInteraction = draw;
    } else {
      if (state.drawInteraction) {
        state.map.removeInteraction(state.drawInteraction);
        state.drawInteraction = null;
      }
      measureSource.clear();
      measureTooltip.style.display = "none";
      showToast("Measurement tool closed");
    }
  });

  // Track cursor for tooltip
  state.map.on("pointermove", (evt) => {
    if (state.measureActive && !evt.dragging) {
      measureTooltip.style.left = `${evt.pixel[0] + 15}px`;
      measureTooltip.style.top = `${evt.pixel[1] + 15}px`;
    }
  });
}

// ---------------------------------------------------------------------------
// 11. MAP EVENTS (COORDINATES, STATUS BAR, ZOOM)
// ---------------------------------------------------------------------------

function setupMapEvents() {
  const mouseCoordsEl = document.getElementById("mouseCoords");
  const utmCoordsEl = document.getElementById("utmCoords");
  const zoomLevelEl = document.getElementById("zoomLevel");

  state.map.on("pointermove", (evt) => {
    if (evt.dragging) return;
    const coordinate = evt.coordinate;
    const lonLat = ol.proj.toLonLat(coordinate);

    // WGS 84
    const lon = lonLat[0].toFixed(5);
    const lat = lonLat[1].toFixed(5);
    mouseCoordsEl.textContent = `Lat: ${lat}° N | Lon: ${lon}° E`;

    // UTM Zone 45N
    if (typeof proj4 !== 'undefined') {
      try {
        const utm = proj4("EPSG:4326", "EPSG:32645", lonLat);
        const utmE = Math.round(utm[0]).toLocaleString();
        const utmN = Math.round(utm[1]).toLocaleString();
        utmCoordsEl.textContent = `UTM 45N: ${utmE}m E, ${utmN}m N`;
      } catch (e) {
        // Fallback
      }
    }
  });

  state.map.getView().on("change:resolution", () => {
    const zoom = state.map.getView().getZoom();
    if (zoomLevelEl && zoom) {
      zoomLevelEl.textContent = `Zoom: ${zoom.toFixed(1)}`;
    }
    // Reapply raster CSS filters on canvas render
    applyRasterFilters();
  });
}

// ---------------------------------------------------------------------------
// 12. EXPORT & SCREENSHOT GENERATOR
// ---------------------------------------------------------------------------

function exportMapSnapshot() {
  showToast("Rendering high-res map screenshot...");
  state.map.once("rendercomplete", () => {
    const mapCanvas = document.createElement("canvas");
    const size = state.map.getSize();
    mapCanvas.width = size[0];
    mapCanvas.height = size[1];
    const mapContext = mapCanvas.getContext("2d");

    Array.prototype.forEach.call(
      document.querySelectorAll(".ol-layer canvas, canvas.ol-mapbox-style"),
      (canvas) => {
        if (canvas.width > 0) {
          const opacity = canvas.parentNode.style.opacity || canvas.style.opacity;
          mapContext.globalAlpha = opacity === "" ? 1 : Number(opacity);
          let transform = canvas.style.transform;
          let matrix;
          if (transform) {
            matrix = transform
              .match(/^matrix\(([^\(]*)\)$/)[1]
              .split(",")
              .map(Number);
          } else {
            matrix = [
              parseFloat(canvas.style.width) / canvas.width,
              0,
              0,
              parseFloat(canvas.style.height) / canvas.height,
              0,
              0
            ];
          }
          CanvasRenderingContext2D.prototype.setTransform.apply(
            mapContext,
            matrix
          );
          mapContext.drawImage(canvas, 0, 0);
        }
      }
    );

    // Add Watermark & Metadata
    mapContext.setTransform(1, 0, 0, 1, 0, 0);
    mapContext.fillStyle = "rgba(10, 13, 20, 0.85)";
    mapContext.fillRect(16, size[1] - 50, 420, 36);
    mapContext.font = "12px Inter, sans-serif";
    mapContext.fillStyle = "#38bdf8";
    mapContext.fillText("Part B.qgs • Sentinel-2 COG WebGIS Client", 26, size[1] - 28);
    mapContext.fillStyle = "#94a3b8";
    mapContext.fillText("WGS 84 / UTM 45N • Client-Side WebGL Rendering", 26, size[1] - 14);

    const link = document.createElement("a");
    link.download = `Part_B_OCP_MapSnapshot_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = mapCanvas.toDataURL("image/png");
    link.click();
    showToast("Snapshot downloaded!");
  });

  state.map.renderSync();
}

function exportGeoJson() {
  const geojson = {
    type: "FeatureCollection",
    name: "Part-B-OCP-Boundary",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    features: [
      {
        type: "Feature",
        properties: {
          Name: "Part B OCP",
          Description: "Raniganj Coalfield Open Cast Project Lease Boundary",
          Area_Hectares: 118.42,
          Area_SqKm: 1.184,
          Perimeter_km: 4.42
        },
        geometry: {
          type: "Polygon",
          coordinates: [PART_B_OCP_POLYGON]
        }
      }
    ]
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Part_B_OCP_Boundary.geojson";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported Part B OCP GeoJSON file");
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// 13. QGIS PROJECT (.QGS) CLIENT-SIDE XML PARSER
// ---------------------------------------------------------------------------

function loadAndParseQgsProject() {
  const xmlPreview = document.getElementById("xmlPreview");

  fetch("Part B.qgs")
    .then(res => {
      if (!res.ok) throw new Error("Local file fetch policy or server error");
      return res.text();
    })
    .then(xmlText => {
      parseQgsXml(xmlText);
    })
    .catch(err => {
      // In file:/// mode, browsers restrict fetch; use embedded fallback metadata
      console.log("Fetch local file note:", err.message);
      renderFallbackQgsMetadata();
    });
}

function parseQgsXml(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const qgisNode = xmlDoc.querySelector("qgis");
  const version = qgisNode ? qgisNode.getAttribute("version") : "3.44.15";
  const saveUser = qgisNode ? qgisNode.getAttribute("saveUserFull") || qgisNode.getAttribute("saveUser") : "Administrator";
  const saveDateTime = qgisNode ? qgisNode.getAttribute("saveDateTime") : "2026-10-24";

  document.getElementById("qgisVersion").textContent = version;
  document.getElementById("qgisUser").textContent = saveUser;
  document.getElementById("qgisDate").textContent = saveDateTime;

  // Extract layer list
  const layers = xmlDoc.querySelectorAll("layer-tree-layer");
  let treeSummary = `--- QGIS Layer Tree (${layers.length} Layers) ---\n`;
  layers.forEach((l, idx) => {
    const name = l.getAttribute("name");
    const provider = l.getAttribute("providerKey");
    const source = l.getAttribute("source");
    treeSummary += `[${idx + 1}] ${name}\n    Provider: ${provider}\n    Source: ${source ? source.substring(0, 80) : "N/A"}...\n\n`;
  });

  document.getElementById("xmlPreview").textContent = treeSummary;
}

function renderFallbackQgsMetadata() {
  document.getElementById("qgisVersion").textContent = QGIS_PROJECT_INFO.version;
  document.getElementById("qgisUser").textContent = QGIS_PROJECT_INFO.user;
  document.getElementById("qgisDate").textContent = QGIS_PROJECT_INFO.saveDateTime;

  let summary = `--- Extracted from Part B.qgs (v3.44.15) ---\n`;
  summary += `Project CRS: EPSG:4326 (WGS 84)\n`;
  summary += `Extent: [87.2757, 23.6746] to [87.2940, 23.6915]\n\n`;
  summary += `Layers in Project:\n`;
  summary += `1. Part-B-OCP — Part B OCP.kml (Polygon Boundary)\n`;
  summary += `2. Google Traffic (XYZ Tiles)\n`;
  summary += `3. Google Earth (XYZ Satellite)\n`;
  summary += `4. S2 [2026-10-15] Cleanest (COG Sentinel-2 L2A)\n`;
  summary += `5. S2 [2026-10-20] (COG Sentinel-2 L2A)\n`;
  summary += `6. S2 [2026-10-05] (COG Sentinel-2 L2A)\n`;
  summary += `7. S2 [2026-09-27] (COG Sentinel-2 L2A)\n`;
  summary += `8. S2 [2026-09-15] (COG Sentinel-2 L2A)\n`;
  document.getElementById("xmlPreview").textContent = summary;
}

// ---------------------------------------------------------------------------
// 14. DRAG AND DROP / FILE UPLOAD HANDLER
// ---------------------------------------------------------------------------

function setupDragAndDrop() {
  const dropOverlay = document.getElementById("dropZoneOverlay");
  const fileInput = document.getElementById("qgsFileInput");
  const btnUploadQgs = document.getElementById("btnUploadQgs");
  if (btnUploadQgs && fileInput) {
    btnUploadQgs.addEventListener("click", () => {
      fileInput.click();
    });
  }

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      processSpatialFile(e.target.files[0]);
    }
  });

  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropOverlay.style.display = "flex";
  });

  window.addEventListener("dragleave", (e) => {
    if (e.clientX <= 0 || e.clientY <= 0) {
      dropOverlay.style.display = "none";
    }
  });

  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dropOverlay.style.display = "none";
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSpatialFile(e.dataTransfer.files[0]);
    }
  });
}

function processSpatialFile(file) {
  const name = file.name.toLowerCase();
  showToast(`Parsing uploaded file: ${file.name}...`);

  const reader = new FileReader();

  if (name.endsWith(".qgs")) {
    reader.onload = (e) => {
      parseQgsXml(e.target.result);
      showToast(`QGIS project ${file.name} metadata loaded!`);
    };
    reader.readAsText(file);
  } else if (name.endsWith(".geojson") || name.endsWith(".json")) {
    reader.onload = (e) => {
      try {
        const geojsonObj = JSON.parse(e.target.result);
        const format = new ol.format.GeoJSON();
        const features = format.readFeatures(geojsonObj, {
          featureProjection: "EPSG:3857"
        });
        const customVec = new ol.layer.Vector({
          source: new ol.source.Vector({ features }),
          style: new ol.style.Style({
            stroke: new ol.style.Stroke({ color: "#ec4899", width: 3 }),
            fill: new ol.style.Fill({ color: "rgba(236, 72, 153, 0.2)" })
          })
        });
        state.map.addLayer(customVec);
        state.map.getView().fit(customVec.getSource().getExtent(), { duration: 600 });
        showToast(`Added GeoJSON layer with ${features.length} features!`);
      } catch (err) {
        showToast("Error parsing GeoJSON file");
      }
    };
    reader.readAsText(file);
  } else if (name.endsWith(".kml")) {
    reader.onload = (e) => {
      try {
        const format = new ol.format.KML();
        const features = format.readFeatures(e.target.result, {
          featureProjection: "EPSG:3857"
        });
        const customVec = new ol.layer.Vector({
          source: new ol.source.Vector({ features }),
          style: new ol.style.Style({
            stroke: new ol.style.Stroke({ color: "#eab308", width: 3 }),
            fill: new ol.style.Fill({ color: "rgba(234, 179, 8, 0.2)" })
          })
        });
        state.map.addLayer(customVec);
        state.map.getView().fit(customVec.getSource().getExtent(), { duration: 600 });
        showToast(`Added KML layer with ${features.length} features!`);
      } catch (err) {
        showToast("Error parsing KML file");
      }
    };
    reader.readAsText(file);
  } else {
    showToast(`File ${file.name} received`);
  }
}

// ---------------------------------------------------------------------------
// 15. PIT ANALYTICS DATA POPULATION
// ---------------------------------------------------------------------------

function populatePitAnalyticsTable() {
  const tbody = document.getElementById("coordsTableBody");
  tbody.innerHTML = "";

  PART_B_OCP_POLYGON.forEach((pt, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${pt[0].toFixed(6)}</td>
      <td>${pt[1].toFixed(6)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// 16. TOAST NOTIFICATIONS
// ---------------------------------------------------------------------------

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toastNotification");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

// ---------------------------------------------------------------------------
// 17. ADAPTIVE VIEW MODE (MOBILE / DESKTOP / AUTO) & MOBILE DRAWER INTERACTIONS
// ---------------------------------------------------------------------------

function setupMobileAndAdaptiveView() {
  const appContainer = document.getElementById("app-container");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  const btnDrawerOpen = document.getElementById("btnMobileDrawerOpen");
  const btnDrawerClose = document.getElementById("btnCloseSidebar");
  const mobileNavBtns = document.querySelectorAll(".mobile-nav-btn");

  // Read saved preference or default to 'auto'
  state.viewMode = localStorage.getItem("qgis_openmap_viewmode") || "auto";

  function isDeviceMobile() {
    return window.innerWidth <= 850 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function updateViewModeUI() {
    const effectiveMobile = state.viewMode === "mobile" || (state.viewMode === "auto" && isDeviceMobile());

    // Update container classes
    if (state.viewMode === "desktop") {
      appContainer.classList.add("is-desktop");
      appContainer.classList.remove("is-mobile");
    } else if (state.viewMode === "mobile") {
      appContainer.classList.add("is-mobile");
      appContainer.classList.remove("is-desktop");
    } else {
      // Auto mode: remove manual overrides so CSS media query triggers automatically
      appContainer.classList.remove("is-desktop");
      appContainer.classList.remove("is-mobile");
    }

    // Update status bar label & icon
    const statusLabel = document.getElementById("statusModeLabel");
    const statusIcon = document.getElementById("statusModeIcon");
    if (statusLabel && statusIcon) {
      if (state.viewMode === "auto") {
        statusLabel.textContent = effectiveMobile ? "View: Auto (Mobile)" : "View: Auto (Desktop)";
        statusIcon.className = "fa-solid fa-wand-magic-sparkles";
      } else if (state.viewMode === "mobile") {
        statusLabel.textContent = "View: Mobile (Manual)";
        statusIcon.className = "fa-solid fa-mobile-screen";
      } else {
        statusLabel.textContent = "View: Desktop (Manual)";
        statusIcon.className = "fa-solid fa-desktop";
      }
    }

    // Update mobile topbar toggle button
    const mobileModeText = document.getElementById("mobileModeText");
    const mobileModeIcon = document.getElementById("mobileModeIcon");
    if (mobileModeText && mobileModeIcon) {
      if (effectiveMobile) {
        mobileModeText.textContent = state.viewMode === "mobile" ? "Desktop" : (isDeviceMobile() ? "Desktop" : "Auto");
        mobileModeIcon.className = "fa-solid fa-desktop";
      } else {
        mobileModeText.textContent = "Mobile";
        mobileModeIcon.className = "fa-solid fa-mobile-screen";
      }
    }

    // Update mobile bottom nav mode button
    const mobileBottomModeText = document.getElementById("mobileBottomModeText");
    const mobileBottomModeIcon = document.getElementById("mobileBottomModeIcon");
    if (mobileBottomModeText && mobileBottomModeIcon) {
      if (state.viewMode === "mobile") {
        mobileBottomModeText.textContent = "Desktop";
        mobileBottomModeIcon.className = "fa-solid fa-desktop";
      } else if (state.viewMode === "desktop") {
        mobileBottomModeText.textContent = "Mobile";
        mobileBottomModeIcon.className = "fa-solid fa-mobile-screen";
      } else {
        mobileBottomModeText.textContent = "Desktop";
        mobileBottomModeIcon.className = "fa-solid fa-desktop";
      }
    }

    // Re-evaluate map layout to prevent clipping or blank areas
    setTimeout(() => {
      if (state.map) state.map.updateSize();
    }, 120);
  }

  function cycleViewMode() {
    if (state.viewMode === "auto") {
      state.viewMode = isDeviceMobile() ? "desktop" : "mobile";
    } else if (state.viewMode === "mobile") {
      state.viewMode = "desktop";
    } else if (state.viewMode === "desktop") {
      state.viewMode = "auto";
    } else {
      state.viewMode = "auto";
    }

    localStorage.setItem("qgis_openmap_viewmode", state.viewMode);
    updateViewModeUI();

    if (state.viewMode === "mobile") {
      showToast("Switched to Touch-Friendly Mobile Version 📱");
    } else if (state.viewMode === "desktop") {
      showToast("Switched to Full Desktop Workspace 💻");
    } else {
      showToast("View mode set to Auto (Adapts dynamically to window size) ⚡");
    }
  }

  // Toggle button event listeners
  const btnStatusModeToggle = document.getElementById("btnStatusModeToggle");
  if (btnStatusModeToggle) {
    btnStatusModeToggle.addEventListener("click", cycleViewMode);
  }

  const btnMobileModeSwitch = document.getElementById("btnMobileModeSwitch");
  if (btnMobileModeSwitch) {
    btnMobileModeSwitch.addEventListener("click", () => {
      if (state.viewMode === "desktop") {
        state.viewMode = "auto";
      } else {
        state.viewMode = "desktop";
      }
      localStorage.setItem("qgis_openmap_viewmode", state.viewMode);
      updateViewModeUI();
      showToast(state.viewMode === "desktop" ? "Desktop view enabled 💻" : "Auto view mode restored ⚡");
    });
  }

  const btnMobileBottomNavMode = document.getElementById("btnMobileBottomNavMode");
  if (btnMobileBottomNavMode) {
    btnMobileBottomNavMode.addEventListener("click", cycleViewMode);
  }

  // Responsive window resize watcher
  window.addEventListener("resize", () => {
    if (state.viewMode === "auto") {
      updateViewModeUI();
    } else {
      if (state.map) state.map.updateSize();
    }
  });

  // Mobile Drawer Controls
  function openMobileDrawer(targetTabId) {
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("active");

    if (targetTabId) {
      const tabBtns = document.querySelectorAll(".tab-btn");
      const tabPanes = document.querySelectorAll(".tab-pane");
      tabBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === targetTabId));
      tabPanes.forEach(p => p.classList.toggle("active", p.id === targetTabId));
    }
  }

  function closeMobileDrawer() {
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("active");

    // Reset bottom nav active button to 'map'
    mobileNavBtns.forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-action") === "map");
    });

    setTimeout(() => {
      if (state.map) state.map.updateSize();
    }, 200);
  }

  if (btnDrawerOpen) {
    btnDrawerOpen.addEventListener("click", () => {
      if (sidebar && sidebar.classList.contains("open")) {
        closeMobileDrawer();
      } else {
        openMobileDrawer();
      }
    });
  }

  if (btnDrawerClose) {
    btnDrawerClose.addEventListener("click", closeMobileDrawer);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeMobileDrawer);
  }

  // Mobile Bottom Navigation Buttons
  mobileNavBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      if (action === "mode-toggle") return; // Handled separately

      mobileNavBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (action === "map") {
        closeMobileDrawer();
      } else if (action && action.startsWith("tab-")) {
        openMobileDrawer(action);
      }
    });
  });

  // Initial call
  updateViewModeUI();
}

// ---------------------------------------------------------------------------
// 18. BOOTSTRAP ON DOM LOAD
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  initWebGisMap();
});
