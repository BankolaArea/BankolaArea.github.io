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

/**
 * 📍 MAP STARTUP LOCATION & PROJECT CRS
 * Edit center [lon, lat], defaultZoom, and extent to change where the map opens.
 */
const QGIS_PROJECT_INFO = {
  filename: "Part B.qgs",
  version: "3.44.15-Solothurn",
  user: "Administrator / Arpan Halder",
  saveDateTime: "2026-10-24 13:40:42",
  crs: "EPSG:4326 (WGS 84)",
  projectedCrs: "EPSG:32645 (WGS 84 / UTM zone 45N)",
  extent: [87.2757366, 23.6746642, 87.2940692, 23.6915430], // [xmin, ymin, xmax, ymax]
  center: [87.2865, 23.6895], // Starting [Longitude, Latitude]
  defaultZoom: 15             // Initial Zoom Level (e.g. 14 for overview, 15-16 for pit detail)
};

/**
 * 📐 PART B OCP MINING LEASE BOUNDARY VERTICES (WGS84 Lon/Lat)
 * Extracted from Part-B-OCP.kml. Replace this array with any new polygon coordinates.
 * NOTE: The last point should match the first point to close the polygon ring.
 */
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

/**
/**
 * 🛰️ SENTINEL-2 CLOUD-OPTIMIZED GEOTIFFS (COGs)
 * Dynamically populated directly from "Part B.qgs" on startup.
 * The array below serves as initial default/fallback if offline or file:/// restricted.
 */
let SENTINEL_LAYERS_CONFIG = [
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
// 3. APPLICATION STATE & DEVELOPER QUICK CONFIGURATION
// ---------------------------------------------------------------------------
// 💡 DEVELOPER TIP: Change any default setting below to instantly customize the app!

const state = {
  map: null,
  baseLayers: {},

  // =========================================================================
  // 🗺️ 1. DEFAULT BASE MAP
  // Change to any of the following keys:
  //   "osm"            : OpenStreetMap Standard (Vector/Roads)
  //   "google-earth"   : Google Earth Satellite (High-res photographic)
  //   "google-traffic" : Google Traffic & Hybrid Roads
  //   "esri-sat"       : Esri World Imagery Satellite
  // =========================================================================
  activeBaseKey: "osm",

  // =========================================================================
  // 🛰️ 2. DEFAULT ACTIVE SATELLITE RASTER SCENE (Sentinel-2 COG)
  // Set to "latest" to AUTOMATICALLY select the most recent acquisition date!
  // Options:
  //   "latest"      : (Recommended) Automatically picks the newest scene by date
  //   "s2_20261020" : Specific scene ID from SENTINEL_LAYERS_CONFIG
  // =========================================================================
  activeRasterId: "latest",
  defaultRasterOpacity: 1.0, // Default raster opacity/visibility (1.0 = 100% fully opaque/visible)


  // =========================================================================
  // 📅 3. MULTI-DATE TIMELINE COMPARISON SETTINGS
  // Navigate scenes chronologically using floating Up/Down buttons or ArrowUp/ArrowDown keys
  // =========================================================================
  dateBannerDuration: 3500, // Duration (ms) the top date banner stays visible on change


  // =========================================================================
  // 📐 4. PART-B-OCP LEASEHOLD BOUNDARY DEFAULTS
  // =========================================================================
  boundaryVisible: true,     // true = boundary visible on map load, false = hidden by default
  boundaryColor: "#ff9800",  // Border & point color hex (e.g. #ff9800 orange, #00e5ff cyan, #10b981 emerald, #ef4444 red)
  boundaryOpacity: 0.15,     // Polygon fill opacity: 0.0 (transparent) to 1.0 (completely solid)

  // =========================================================================
  // 🎛️ 5. DEFAULT GPU RASTER IMAGE ENHANCEMENT FILTERS (WebGL)
  // =========================================================================
  rasterFilters: {
    brightness: 100,  // Brightness: 30 to 250 (%)
    contrast: 115,    // Contrast: 50 to 250 (%)
    saturation: 120,  // Saturation: 0 to 300 (%)
    gamma: 100,       // Exposure/Gamma: 50 to 200 (%)
    preset: "natural" // Preset: "natural" | "high-contrast" | "vegetation" | "grayscale"
  },

  // =========================================================================
  // 📱 6. DEFAULT VIEW MODE (MOBILE / DESKTOP / AUTO)
  // Options:
  //   "auto"    : Automatically detects mobile (< 850px) vs desktop screen (Recommended)
  //   "mobile"  : Forces touch-friendly mobile drawer & bottom navigation
  //   "desktop" : Forces full side-by-side desktop workspace
  // =========================================================================
  defaultViewMode: "auto",

  // Runtime objects (managed internally by OpenLayers)
  rasterLayers: {},
  vectorLayer: null,
  customKmlLayers: {},
  drawInteraction: null,
  measureActive: false
};

// ---------------------------------------------------------------------------
// 4. MAP INITIALIZATION (OpenLayers Engine)
// ---------------------------------------------------------------------------

function initWebGisMap() {
  const centerMercator = ol.proj.fromLonLat(QGIS_PROJECT_INFO.center);

  // BASE LAYERS (Visibility dynamically matches state.activeBaseKey)
  state.baseLayers["google-earth"] = new ol.layer.Tile({
    title: "Google Earth Satellite",
    source: new ol.source.XYZ({
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      maxZoom: 20
    }),
    visible: state.activeBaseKey === "google-earth"
  });

  state.baseLayers["google-traffic"] = new ol.layer.Tile({
    title: "Google Traffic",
    source: new ol.source.XYZ({
      url: "https://mt1.google.com/vt/lyrs=h@159000000,traffic|seconds_into_week:-1&style=3&x={x}&y={y}&z={z}",
      maxZoom: 20
    }),
    visible: state.activeBaseKey === "google-traffic"
  });

  state.baseLayers["esri-sat"] = new ol.layer.Tile({
    title: "Esri World Imagery",
    source: new ol.source.XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 19
    }),
    visible: state.activeBaseKey === "esri-sat"
  });

  state.baseLayers["osm"] = new ol.layer.Tile({
    title: "OpenStreetMap",
    source: new ol.source.OSM(),
    visible: state.activeBaseKey === "osm"
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
  setupDateStepperFeature();
  setupMeasureTool();
  setupDragAndDrop();
  setupMobileAndAdaptiveView();
  populatePitAnalyticsTable();
  initCustomKmlManager();

  // Apply default raster image filters
  applyRasterFilters();

  showToast("Part B.qgs loaded successfully with client-side WebGL engine!");
}

// ---------------------------------------------------------------------------
// 5. SENTINEL-2 COG RASTER LAYER CREATION
// ---------------------------------------------------------------------------

/**
 * Automatically discovers the latest Sentinel-2 acquisition by date.
 */
function getLatestRasterId() {
  if (!SENTINEL_LAYERS_CONFIG || SENTINEL_LAYERS_CONFIG.length === 0) return null;
  const sorted = [...SENTINEL_LAYERS_CONFIG].sort((a, b) => {
    const timeA = new Date(a.date).getTime() || 0;
    const timeB = new Date(b.date).getTime() || 0;
    return timeB - timeA; // Descending: newest first
  });
  return sorted[0].id;
}

function initSentinelCogLayers() {
  // If activeRasterId is "latest" (or missing), dynamically pick the newest scene by date
  if (!state.activeRasterId || state.activeRasterId === "latest") {
    state.activeRasterId = getLatestRasterId();
  }

  SENTINEL_LAYERS_CONFIG.forEach(cfg => {
    const isDefaultActive = (cfg.id === state.activeRasterId);
    cfg.defaultChecked = isDefaultActive;

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

      const defaultOpacity = (state.defaultRasterOpacity !== undefined ? state.defaultRasterOpacity : 1.0);
      layer = new ol.layer.WebGLTile({
        title: cfg.name,
        source: cogSource,
        visible: isDefaultActive,
        opacity: defaultOpacity
      });
    } catch (err) {
      console.warn("WebGLTile GeoTIFF fallback:", err);
      // Fallback raster tile source
      layer = new ol.layer.Tile({
        title: cfg.name,
        source: new ol.source.TileDebug(),
        visible: isDefaultActive,
        opacity: (state.defaultRasterOpacity !== undefined ? state.defaultRasterOpacity : 1.0)
      });
    }

    state.rasterLayers[cfg.id] = layer;
  });

  // Automatically update the header and mobile scene tags with the active scene
  const initialCfg = SENTINEL_LAYERS_CONFIG.find(c => c.id === state.activeRasterId);
  if (initialCfg) {
    const sceneNameEl = document.getElementById("currentSceneName");
    if (sceneNameEl) sceneNameEl.textContent = initialCfg.name;
    const mobileTag = document.getElementById("mobileSceneTag");
    if (mobileTag) mobileTag.textContent = `${initialCfg.shortName} ⭐`;
  }
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

  // Read developer defaults from state
  const bColor = state.boundaryColor || "#ff9800";
  const bOpacity = typeof state.boundaryOpacity === "number" ? state.boundaryOpacity : 0.25;
  const bVis = state.boundaryVisible !== undefined ? state.boundaryVisible : true;

  state.vectorLayer = new ol.layer.Vector({
    source: vectorSource,
    style: createVectorStyle(bColor, bOpacity),
    visible: bVis,
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

/**
 * Fits the map view to the extent of a vector layer or source.
 */
function zoomToVectorLayer(layerOrSource) {
  if (!state.map) return;
  const source = layerOrSource.getSource ? layerOrSource.getSource() : layerOrSource;
  if (!source) return;
  const extent = source.getExtent();
  if (extent && !ol.extent.isEmpty(extent) && isFinite(extent[0])) {
    state.map.getView().fit(extent, {
      duration: 650,
      padding: [50, 50, 50, 50],
      maxZoom: 18
    });
  }
}

// ---------------------------------------------------------------------------
// 6B. PERSISTENT CUSTOM KML MANAGER (IndexedDB)
// ---------------------------------------------------------------------------

const KML_DB_NAME = "OpenMap_KML_Storage";
const KML_DB_VERSION = 1;
const KML_STORE_NAME = "custom_kmls";

const KML_COLOR_PALETTE = [
  "#00e5ff", // Bright Cyan
  "#a855f7", // Vibrant Purple
  "#10b981", // Emerald Green
  "#ec4899", // Neon Pink
  "#38bdf8", // Sky Blue
  "#eab308", // Vivid Amber
  "#f97316", // Warm Orange
  "#14b8a6"  // Deep Teal
];

let kmlColorCycleIdx = 0;
function getNextKmlColor() {
  const color = KML_COLOR_PALETTE[kmlColorCycleIdx % KML_COLOR_PALETTE.length];
  kmlColorCycleIdx++;
  return color;
}

/**
 * Opens or initializes the IndexedDB database.
 */
function openKmlDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this browser."));
      return;
    }
    const request = indexedDB.open(KML_DB_NAME, KML_DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(KML_STORE_NAME)) {
        db.createObjectStore(KML_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Retrieves all stored KML records from IndexedDB.
 */
async function dbGetAllCustomKmls() {
  try {
    const db = await openKmlDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(KML_STORE_NAME, "readonly");
      const store = tx.objectStore(KML_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Could not retrieve custom KMLs from IndexedDB:", err);
    return [];
  }
}

/**
 * Saves a new custom KML record to IndexedDB.
 */
async function dbSaveCustomKml(record) {
  try {
    const db = await openKmlDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(KML_STORE_NAME, "readwrite");
      const store = tx.objectStore(KML_STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to save KML record to IndexedDB:", err);
    throw err;
  }
}

/**
 * Updates an existing custom KML record in IndexedDB (visibility, color, opacity).
 */
async function dbUpdateCustomKml(id, updates) {
  try {
    const db = await openKmlDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(KML_STORE_NAME, "readwrite");
      const store = tx.objectStore(KML_STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) {
          resolve(null);
          return;
        }
        Object.assign(item, updates);
        const putReq = store.put(item);
        putReq.onsuccess = () => resolve(item);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.error("Failed to update KML record in IndexedDB:", err);
  }
}

/**
 * Deletes a single KML record from IndexedDB.
 */
async function dbDeleteCustomKml(id) {
  try {
    const db = await openKmlDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(KML_STORE_NAME, "readwrite");
      const store = tx.objectStore(KML_STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to delete KML from IndexedDB:", err);
  }
}

/**
 * Clears all custom KML records from IndexedDB.
 */
async function dbClearAllCustomKmls() {
  try {
    const db = await openKmlDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(KML_STORE_NAME, "readwrite");
      const store = tx.objectStore(KML_STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to clear KML store in IndexedDB:", err);
  }
}

/**
 * Creates OpenLayers vector style for KML features (supports Polygon, LineString, Point).
 */
function createCustomKmlStyle(hexColor, fillOpacity) {
  const hex = (hexColor || "#00e5ff").replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 229;
  const b = parseInt(hex.substring(4, 6), 16) || 255;
  const op = typeof fillOpacity === "number" ? fillOpacity : 0.2;

  return new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: `rgb(${r}, ${g}, ${b})`,
      width: 2.5
    }),
    fill: new ol.style.Fill({
      color: `rgba(${r}, ${g}, ${b}, ${op})`
    }),
    image: new ol.style.Circle({
      radius: 6,
      fill: new ol.style.Fill({ color: `rgb(${r}, ${g}, ${b})` }),
      stroke: new ol.style.Stroke({ color: "#ffffff", width: 2 })
    })
  });
}

/**
 * Initializes the Custom KML Manager, restores saved KMLs from IndexedDB,
 * and attaches UI event listeners.
 */
async function initCustomKmlManager() {
  state.customKmlLayers = state.customKmlLayers || {};

  // Setup Button Triggers
  const btnLoadCustomKml = document.getElementById("btnLoadCustomKml");
  const btnLoadKmlHeader = document.getElementById("btnLoadKmlHeader");
  const btnClearAllKmlHeader = document.getElementById("btnClearAllKmlHeader");
  const customKmlFileInput = document.getElementById("customKmlFileInput");

  const openFilePicker = () => {
    if (customKmlFileInput) customKmlFileInput.click();
  };

  if (btnLoadCustomKml) btnLoadCustomKml.addEventListener("click", openFilePicker);
  if (btnLoadKmlHeader) btnLoadKmlHeader.addEventListener("click", openFilePicker);

  if (customKmlFileInput) {
    customKmlFileInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      let successCount = 0;
      for (const file of files) {
        const record = await processAndSaveKmlFile(file);
        if (record) successCount++;
      }

      customKmlFileInput.value = "";
      if (successCount > 0) {
        showToast(`Loaded & persisted ${successCount} KML ${successCount === 1 ? "layer" : "layers"} in browser IndexedDB!`);
      }
    });
  }

  if (btnClearAllKmlHeader) {
    btnClearAllKmlHeader.addEventListener("click", clearAllCustomKmlLayers);
  }

  // Restore existing KML layers from IndexedDB
  await restoreCustomKmlsFromDB();
}

/**
 * Reads a single KML file, validates features, saves to IndexedDB,
 * and adds it to the OpenLayers map.
 */
async function processAndSaveKmlFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const kmlText = e.target.result;
        const kmlFormat = new ol.format.KML({ extractStyles: false });
        const features = kmlFormat.readFeatures(kmlText, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857"
        });

        if (!features || features.length === 0) {
          showToast(`Warning: No valid vector geometries found in "${file.name}"`);
          resolve(null);
          return;
        }

        const id = "kml_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
        const assignedColor = getNextKmlColor();
        const cleanName = file.name.replace(/\.[^/.]+$/, "");

        const record = {
          id: id,
          name: cleanName,
          filename: file.name,
          kmlText: kmlText,
          color: assignedColor,
          opacity: 0.20,
          visible: true,
          featureCount: features.length,
          createdAt: Date.now()
        };

        // Persist to browser IndexedDB
        await dbSaveCustomKml(record);

        // Add to map and render UI card
        addCustomKmlToMap(record, features, true);
        renderCustomKmlCard(record);
        updateVectorLayerCountBadge();

        resolve(record);
      } catch (err) {
        console.error("Error parsing uploaded KML:", err);
        showToast(`Error parsing KML: ${file.name}`);
        resolve(null);
      }
    };
    reader.onerror = () => {
      showToast(`Error reading file: ${file.name}`);
      resolve(null);
    };
    reader.readAsText(file);
  });
}

/**
 * Adds a parsed KML layer to the OpenLayers map instance and state.
 */
function addCustomKmlToMap(record, preParsedFeatures = null, zoomToLayer = false) {
  let features = preParsedFeatures;
  if (!features) {
    try {
      const kmlFormat = new ol.format.KML({ extractStyles: false });
      features = kmlFormat.readFeatures(record.kmlText, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857"
      });
    } catch (err) {
      console.error("Error re-parsing KML:", err);
      features = [];
    }
  }

  const source = new ol.source.Vector({ features: features });
  const layer = new ol.layer.Vector({
    source: source,
    style: createCustomKmlStyle(record.color, record.opacity),
    visible: record.visible !== false,
    zIndex: 98 // Just below default Part-B at 99
  });

  state.customKmlLayers[record.id] = {
    record: record,
    layer: layer,
    source: source
  };

  if (state.map) {
    state.map.addLayer(layer);
    if (zoomToLayer) {
      zoomToVectorLayer(source);
    }
  }
}

/**
 * Restores all custom KMLs saved in IndexedDB onto the map.
 */
async function restoreCustomKmlsFromDB() {
  const records = await dbGetAllCustomKmls();
  if (!records || !records.length) {
    updateVectorLayerCountBadge();
    return;
  }

  records.forEach((record) => {
    addCustomKmlToMap(record, null, false);
    renderCustomKmlCard(record);
  });

  updateVectorLayerCountBadge();
  console.log(`[IndexedDB] Restored ${records.length} custom KML layer(s) into WebGIS map.`);
}

/**
 * Renders an interactive card for a custom KML in the sidebar.
 */
function renderCustomKmlCard(record) {
  const container = document.getElementById("customKmlLayersList");
  if (!container) return;

  // Check if card already exists
  let card = container.querySelector(`.custom-kml-card[data-kml-id="${record.id}"]`);
  if (card) card.remove();

  card = document.createElement("div");
  card.className = "layer-item vector-layer-card custom-kml-card";
  card.setAttribute("data-kml-id", record.id);
  card.style.borderLeftColor = record.color;

  const featureText = record.featureCount
    ? `${record.featureCount} ${record.featureCount === 1 ? "Feature" : "Features"}`
    : "KML Vector";

  card.innerHTML = `
    <div class="layer-item-header">
      <label class="switch">
        <input type="checkbox" class="chk-custom-kml" data-id="${record.id}" ${record.visible !== false ? "checked" : ""} />
        <span class="slider round"></span>
      </label>
      <div class="layer-info">
        <div class="layer-name-row">
          <span class="layer-name" title="${record.filename || record.name}">${record.name}</span>
          <span class="badge-poly custom-badge">${featureText}</span>
        </div>
        <span class="layer-source"><i class="fa-solid fa-database"></i> Stored in IndexedDB</span>
      </div>
      <div class="layer-actions">
        <button class="btn-kml-action btn-zoom-kml" data-id="${record.id}" title="Zoom to layer extent">
          <i class="fa-solid fa-crosshairs"></i>
        </button>
        <button class="btn-kml-action btn-delete-kml" data-id="${record.id}" title="Delete this KML layer from map & IndexedDB">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
    <div class="vector-controls">
      <div class="control-row">
        <label>Layer Color:</label>
        <input type="color" class="custom-kml-color" data-id="${record.id}" value="${record.color || "#00e5ff"}" />
      </div>
      <div class="control-row">
        <label>Fill Opacity:</label>
        <input type="range" class="custom-kml-opacity" data-id="${record.id}" min="0" max="1" step="0.05" value="${record.opacity !== undefined ? record.opacity : 0.2}" />
        <span class="custom-kml-opacity-val">${Math.round((record.opacity !== undefined ? record.opacity : 0.2) * 100)}%</span>
      </div>
    </div>
  `;

  // Attach Card Event Listeners
  const chk = card.querySelector(".chk-custom-kml");
  const colorInput = card.querySelector(".custom-kml-color");
  const opacityInput = card.querySelector(".custom-kml-opacity");
  const opacityVal = card.querySelector(".custom-kml-opacity-val");
  const btnZoom = card.querySelector(".btn-zoom-kml");
  const btnDelete = card.querySelector(".btn-delete-kml");

  // Visibility toggle
  chk.addEventListener("change", async (e) => {
    const isVisible = e.target.checked;
    const item = state.customKmlLayers[record.id];
    if (item && item.layer) {
      item.layer.setVisible(isVisible);
    }
    record.visible = isVisible;
    await dbUpdateCustomKml(record.id, { visible: isVisible });
  });

  // Dynamic Style Update
  const updateStyle = async () => {
    const newColor = colorInput.value;
    const newOpacity = parseFloat(opacityInput.value);
    opacityVal.textContent = `${Math.round(newOpacity * 100)}%`;
    card.style.borderLeftColor = newColor;

    const item = state.customKmlLayers[record.id];
    if (item && item.layer) {
      item.layer.setStyle(createCustomKmlStyle(newColor, newOpacity));
    }

    record.color = newColor;
    record.opacity = newOpacity;
    await dbUpdateCustomKml(record.id, { color: newColor, opacity: newOpacity });
  };

  colorInput.addEventListener("input", updateStyle);
  opacityInput.addEventListener("input", updateStyle);

  // Zoom Button
  btnZoom.addEventListener("click", () => {
    const item = state.customKmlLayers[record.id];
    if (item && item.source) {
      zoomToVectorLayer(item.source);
      showToast(`Zoomed to "${record.name}"`);
    }
  });

  // Delete Button
  btnDelete.addEventListener("click", () => {
    deleteSingleCustomKml(record.id, record.name);
  });

  container.appendChild(card);
}

/**
 * Removes a single custom KML from the map and IndexedDB.
 */
async function deleteSingleCustomKml(id, name) {
  const item = state.customKmlLayers[id];
  if (item && item.layer && state.map) {
    state.map.removeLayer(item.layer);
  }
  delete state.customKmlLayers[id];

  await dbDeleteCustomKml(id);

  const card = document.querySelector(`.custom-kml-card[data-kml-id="${id}"]`);
  if (card) card.remove();

  updateVectorLayerCountBadge();
  showToast(`Deleted "${name || "KML layer"}" from map & IndexedDB`);
}

/**
 * Clears all custom KML layers from map and IndexedDB,
 * while strictly preserving the default Part-B-OCP boundary.
 */
async function clearAllCustomKmlLayers() {
  const count = Object.keys(state.customKmlLayers).length;
  if (count === 0) return;

  const confirmed = confirm(
    `Are you sure you want to delete all ${count} custom KML layer(s) from the map and browser storage?\n\nThe default Part-B-OCP boundary will remain untouched.`
  );
  if (!confirmed) return;

  Object.values(state.customKmlLayers).forEach((item) => {
    if (item.layer && state.map) {
      state.map.removeLayer(item.layer);
    }
  });

  state.customKmlLayers = {};
  await dbClearAllCustomKmls();

  const container = document.getElementById("customKmlLayersList");
  if (container) container.innerHTML = "";

  updateVectorLayerCountBadge();
  showToast(`Cleared ${count} custom KML layer(s). Default Part-B boundary preserved.`);
}

/**
 * Updates the total vector layer counter badge and toggle visibility for Clear All.
 */
function updateVectorLayerCountBadge() {
  const countEl = document.getElementById("vectorLayerCount");
  const clearAllBtn = document.getElementById("btnClearAllKmlHeader");
  const customCount = Object.keys(state.customKmlLayers || {}).length;
  const totalCount = 1 + customCount; // 1 default Part-B-OCP + custom

  if (countEl) {
    if (customCount === 0) {
      countEl.textContent = "1 Boundary (Default)";
    } else {
      countEl.textContent = `${totalCount} Boundaries (${customCount} Custom)`;
    }
  }

  if (clearAllBtn) {
    clearAllBtn.style.display = customCount > 0 ? "inline-flex" : "none";
  }
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

  // Vector Boundary Toggle - automatically synced with state.boundaryVisible
  const chkKmlBoundary = document.getElementById("chkKmlBoundary");
  if (chkKmlBoundary) {
    if (state.boundaryVisible !== undefined) chkKmlBoundary.checked = state.boundaryVisible;
    chkKmlBoundary.addEventListener("change", (e) => {
      state.vectorLayer.setVisible(e.target.checked);
    });
  }

  // Zoom to Default Boundary Button
  const btnZoomDefaultKml = document.getElementById("btnZoomDefaultKml");
  if (btnZoomDefaultKml) {
    btnZoomDefaultKml.addEventListener("click", () => {
      if (state.vectorLayer) {
        zoomToVectorLayer(state.vectorLayer);
        showToast("Zoomed to Part-B-OCP default boundary");
      }
    });
  }

  // Vector Style Customizer - automatically synced with state.boundaryColor & boundaryOpacity
  const kmlBorderColor = document.getElementById("kmlBorderColor");
  const kmlOpacity = document.getElementById("kmlOpacity");
  const kmlOpacityVal = document.getElementById("kmlOpacityVal");

  if (kmlBorderColor && state.boundaryColor) {
    kmlBorderColor.value = state.boundaryColor;
  }
  if (kmlOpacity && state.boundaryOpacity !== undefined) {
    kmlOpacity.value = state.boundaryOpacity;
    if (kmlOpacityVal) kmlOpacityVal.textContent = `${Math.round(state.boundaryOpacity * 100)}%`;
  }

  function updateVectorStyle() {
    const color = kmlBorderColor.value;
    const opacity = parseFloat(kmlOpacity.value);
    if (kmlOpacityVal) kmlOpacityVal.textContent = `${Math.round(opacity * 100)}%`;
    state.vectorLayer.setStyle(createVectorStyle(color, opacity));
  }

  if (kmlBorderColor) kmlBorderColor.addEventListener("input", updateVectorStyle);
  if (kmlOpacity) kmlOpacity.addEventListener("input", updateVectorStyle);

  // Base Map Buttons - automatically highlights button matching state.activeBaseKey
  const basemapBtns = document.querySelectorAll(".basemap-btn");
  basemapBtns.forEach(btn => {
    const key = btn.getAttribute("data-base");
    btn.classList.toggle("active", key === state.activeBaseKey);
    btn.addEventListener("click", () => {
      switchBaseMap(key);
      basemapBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Navigation Header Buttons
  const btnFitExtent = document.getElementById("btnFitExtent");
  if (btnFitExtent) btnFitExtent.addEventListener("click", fitToPartBExtent);
  const btnZoomToPit = document.getElementById("btnZoomToPit");
  if (btnZoomToPit) btnZoomToPit.addEventListener("click", fitToPartBExtent);

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
  const btnDownloadGeoJSON = document.getElementById("btnDownloadGeoJSON");
  if (btnDownloadGeoJSON) btnDownloadGeoJSON.addEventListener("click", exportGeoJson);

  // Synchronize / Reload layers from Part B.qgs
  const btnReloadQgs = document.getElementById("btnReloadQgs");
  if (btnReloadQgs) {
    btnReloadQgs.addEventListener("click", () => {
      loadAndParseQgsProject(true);
    });
  }

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

    const defOpacity = (state.defaultRasterOpacity !== undefined ? state.defaultRasterOpacity : 1.0);
    const defOpacityPercent = Math.round(defOpacity * 100);

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
        <input type="range" class="raster-opacity-slider" data-layer="${cfg.id}" min="0" max="1" step="0.05" value="${defOpacity}" />
        <span id="val_opacity_${cfg.id}">${defOpacityPercent}%</span>
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

function switchActiveRasterScene(layerId, showBanner = true) {
  state.activeRasterId = layerId;
  const cfg = SENTINEL_LAYERS_CONFIG.find(c => c.id === layerId);

  // Update UI cards
  document.querySelectorAll(".raster-layer-card").forEach(c => c.classList.remove("active-scene"));
  const activeCard = document.getElementById(`card_${layerId}`);
  if (activeCard) activeCard.classList.add("active-scene");

  // Synchronize radio button in the list
  const radio = document.getElementById(`radio_${layerId}`);
  if (radio) radio.checked = true;

  // Update header and mobile scene label
  if (cfg) {
    const sceneNameEl = document.getElementById("currentSceneName");
    if (sceneNameEl) sceneNameEl.textContent = cfg.name;
    const mobileTag = document.getElementById("mobileSceneTag");
    if (mobileTag) mobileTag.textContent = `${cfg.shortName} ⭐`;
  }

  // Update layer visibility: activate selected layer, hide others
  Object.keys(state.rasterLayers).forEach(id => {
    state.rasterLayers[id].setVisible(id === layerId);
  });

  // Update on-map and sidebar date stepper controls & display top notification banner
  updateDateStepperUI(layerId, showBanner);
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
// 9. MULTI-DATE TIMELINE STEPPER COMPARISON (UP/DOWN ARROWS & KEYBOARD)
// ---------------------------------------------------------------------------

let dateBannerTimeout = null;

/**
 * Returns Sentinel-2 scenes sorted chronologically (Newest first: Index 0 = Latest).
 */
function getChronologicalScenes() {
  return [...SENTINEL_LAYERS_CONFIG].sort((a, b) => {
    const timeA = new Date(a.date).getTime() || 0;
    const timeB = new Date(b.date).getTime() || 0;
    return timeB - timeA; // Descending: newest first
  });
}

/**
 * Step through raster scenes chronologically:
 * - "newer" / "up": Decreases index towards 0 (Newer date)
 * - "older" / "down": Increases index towards length-1 (Older date)
 */
function stepRasterScene(direction = "newer") {
  const scenes = getChronologicalScenes();
  if (!scenes || scenes.length === 0) return;

  const total = scenes.length;
  let currIdx = scenes.findIndex(s => s.id === state.activeRasterId);
  if (currIdx === -1) currIdx = 0;

  let nextIdx;
  if (direction === "newer" || direction === "up") {
    // Newer date -> index decreases towards 0
    nextIdx = currIdx - 1;
    if (nextIdx < 0) nextIdx = total - 1; // Wrap around to oldest scene
  } else {
    // Older date -> index increases towards total-1
    nextIdx = currIdx + 1;
    if (nextIdx >= total) nextIdx = 0; // Wrap around to newest scene
  }

  const targetScene = scenes[nextIdx];
  switchActiveRasterScene(targetScene.id, true);
}

/**
 * Shows the floating on-map date banner at the top of the canvas for a few seconds.
 */
function showMapDateBanner(cfg, currIdx, total) {
  const banner = document.getElementById("mapDateBanner");
  if (!banner || !cfg) return;

  const titleEl = document.getElementById("bannerDateTitle");
  const subEl = document.getElementById("bannerDateSub");

  if (titleEl) {
    titleEl.textContent = cfg.name;
  }
  if (subEl) {
    const cleanTag = cfg.clean ? " ⭐ Clean" : "";
    subEl.textContent = `Scene ${currIdx + 1} of ${total} • Date: ${cfg.date || "N/A"} • Cloud: ${cfg.cloud || "N/A"}${cleanTag} • Use ▲ / ▼ keys`;
  }

  // Pop in banner
  banner.classList.add("visible");

  // Auto-hide after configured duration (default: 3500ms)
  const duration = (state.dateBannerDuration !== undefined ? state.dateBannerDuration : 3500);
  if (dateBannerTimeout) clearTimeout(dateBannerTimeout);
  dateBannerTimeout = setTimeout(() => {
    banner.classList.remove("visible");
  }, duration);
}

/**
 * Synchronizes all on-map and sidebar date stepper UI elements.
 */
function updateDateStepperUI(layerId, showBanner = true) {
  const scenes = getChronologicalScenes();
  if (!scenes || scenes.length === 0) return;

  const total = scenes.length;
  let currIdx = scenes.findIndex(s => s.id === layerId);
  if (currIdx === -1) currIdx = 0;
  const cfg = scenes[currIdx];
  if (!cfg) return;

  // 1. Update on-map stepper display
  const stepperDateText = document.getElementById("stepperDateText");
  const stepperIdxText = document.getElementById("stepperIdxText");
  if (stepperDateText) stepperDateText.textContent = cfg.date || cfg.shortName;
  if (stepperIdxText) stepperIdxText.textContent = `${currIdx + 1} of ${total}`;

  // 2. Update sidebar timeline comparison card
  const sidebarTimelineBadge = document.getElementById("sidebarTimelineBadge");
  const sidebarTimelineTitle = document.getElementById("sidebarTimelineTitle");
  const sidebarTimelineMeta = document.getElementById("sidebarTimelineMeta");
  if (sidebarTimelineBadge) sidebarTimelineBadge.textContent = `${currIdx + 1} / ${total}`;
  if (sidebarTimelineTitle) sidebarTimelineTitle.textContent = cfg.name;
  if (sidebarTimelineMeta) {
    sidebarTimelineMeta.textContent = `Acquisition: ${cfg.date || "N/A"} • Cloud Cover: ${cfg.cloud || "N/A"}${cfg.clean ? " (Cleanest ⭐)" : ""}`;
  }

  // 3. Show top floating banner if requested
  if (showBanner) {
    showMapDateBanner(cfg, currIdx, total);
  }
}

function setupDateStepperFeature() {
  // On-Map Floating Stepper Buttons
  const btnDateNewer = document.getElementById("btnDateNewer");
  const btnDateOlder = document.getElementById("btnDateOlder");
  if (btnDateNewer) btnDateNewer.addEventListener("click", () => stepRasterScene("newer"));
  if (btnDateOlder) btnDateOlder.addEventListener("click", () => stepRasterScene("older"));

  // Sidebar Stepper Buttons
  const btnSidebarDateNewer = document.getElementById("btnSidebarDateNewer");
  const btnSidebarDateOlder = document.getElementById("btnSidebarDateOlder");
  if (btnSidebarDateNewer) btnSidebarDateNewer.addEventListener("click", () => stepRasterScene("newer"));
  if (btnSidebarDateOlder) btnSidebarDateOlder.addEventListener("click", () => stepRasterScene("older"));

  // Top Floating Tool Button (Cycle Date)
  const btnNextDate = document.getElementById("btnNextDate");
  if (btnNextDate) btnNextDate.addEventListener("click", () => stepRasterScene("older"));

  // Close Banner Button & Click-to-Dismiss
  const btnCloseDateBanner = document.getElementById("btnCloseDateBanner");
  const mapDateBanner = document.getElementById("mapDateBanner");
  if (btnCloseDateBanner) {
    btnCloseDateBanner.addEventListener("click", (e) => {
      e.stopPropagation();
      if (mapDateBanner) mapDateBanner.classList.remove("visible");
      if (dateBannerTimeout) clearTimeout(dateBannerTimeout);
    });
  }
  if (mapDateBanner) {
    mapDateBanner.addEventListener("click", () => {
      mapDateBanner.classList.remove("visible");
      if (dateBannerTimeout) clearTimeout(dateBannerTimeout);
    });
  }

  // Global Keyboard Up/Down Arrow Key Navigation
  window.addEventListener("keydown", (e) => {
    // Avoid intercepting when user is typing in form inputs, textareas, selects
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      stepRasterScene("newer");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      stepRasterScene("older");
    }
  });

  // Initial UI synchronization (without popping the banner on page load)
  updateDateStepperUI(state.activeRasterId, false);
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
    document.documentElement.requestFullscreen().catch(() => { });
  } else {
    document.exitFullscreen().catch(() => { });
  }
}

// ---------------------------------------------------------------------------
// 13. QGIS PROJECT (.QGS) CLIENT-SIDE XML PARSER & DYNAMIC RASTER ENGINE
// ---------------------------------------------------------------------------

let isQgsProjectLoaded = false;

/**
 * Extracts Sentinel-2 and COG raster layers dynamically from Part B.qgs XML.
 */
function extractRastersFromQgsXml(xmlDoc) {
  const parsed = [];
  const treeLayers = xmlDoc.querySelectorAll("layer-tree-layer");
  const mapLayers = xmlDoc.querySelectorAll("projectlayers > maplayer, maplayer");

  // Build lookup map by id
  const mapLayerById = new Map();
  mapLayers.forEach(ml => {
    const idEl = ml.querySelector("id");
    if (idEl && idEl.textContent) {
      mapLayerById.set(idEl.textContent.trim(), ml);
    }
  });

  const seenIds = new Set();

  treeLayers.forEach(tl => {
    const layerId = tl.getAttribute("id") || "";
    const provider = (tl.getAttribute("providerKey") || "").toLowerCase();
    let source = tl.getAttribute("source") || "";
    let name = tl.getAttribute("name") || "";
    const isChecked = tl.getAttribute("checked") === "Qt::Checked";

    const ml = mapLayerById.get(layerId);
    if (ml) {
      if (!source) {
        const ds = ml.querySelector("datasource");
        if (ds) source = ds.textContent.trim();
      }
      if (!name) {
        const ln = ml.querySelector("layername");
        if (ln) name = ln.textContent.trim();
      }
    }

    const isGdal = provider === "gdal";
    const isGeoTiff = source.includes(".tif") || source.includes("/vsicurl/") || source.includes("sentinel-s2");
    const isXyz = source.includes("type=xyz") || source.includes("mt1.google.com");

    if ((isGdal || isGeoTiff) && !isXyz && source) {
      const cleanUrl = source.replace(/^\/vsicurl\//i, "").trim();

      // Extract date from URL filename or name
      let dateStr = "";
      const urlDateMatch = cleanUrl.match(/_(\d{4})(\d{2})(\d{2})_/);
      if (urlDateMatch) {
        dateStr = `${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`;
      } else {
        const nameDateMatch = name.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
        if (nameDateMatch) {
          dateStr = `${nameDateMatch[1]}-${nameDateMatch[2]}-${nameDateMatch[3]}`;
        }
      }

      // Extract cloud coverage
      let cloudStr = "N/A";
      const cloudMatch = name.match(/(\d+(\.\d+)?)\s*%\s*cloud/i) || name.match(/cloud\s*(\d+(\.\d+)?)\s*%/i);
      if (cloudMatch) {
        cloudStr = `${cloudMatch[1]}%`;
      }

      const isClean = /clean|cleanest/i.test(name) || (cloudMatch && parseFloat(cloudMatch[1]) < 10);
      const shortName = dateStr ? `${dateStr} (${cloudStr} cloud)` : name;

      let uniqueId = dateStr ? `s2_${dateStr.replace(/-/g, "")}` : layerId;
      if (seenIds.has(uniqueId)) {
        let counter = 2;
        while (seenIds.has(`${uniqueId}_${counter}`)) counter++;
        uniqueId = `${uniqueId}_${counter}`;
      }
      seenIds.add(uniqueId);

      parsed.push({
        id: uniqueId,
        name: name || `Sentinel-2 (${dateStr})`,
        shortName: shortName,
        date: dateStr,
        cloud: cloudStr,
        clean: isClean,
        fileOrderIndex: parsed.length,
        url: cleanUrl,
        defaultChecked: isChecked
      });
    }
  });

  return parsed;
}

/**
 * Rebuilds and synchronizes raster layers on live OpenLayers map canvas.
 */
function rebuildRasterLayersOnMap() {
  if (!state.map) return;

  // 1. Remove existing raster layers from state.map
  Object.values(state.rasterLayers).forEach(layer => {
    state.map.removeLayer(layer);
  });
  state.rasterLayers = {};

  // 2. Refresh active raster ID
  const exists = SENTINEL_LAYERS_CONFIG.some(c => c.id === state.activeRasterId);
  if (!exists || state.activeRasterId === "latest") {
    state.activeRasterId = getLatestRasterId();
  }

  // 3. Re-instantiate OpenLayers WebGLTile layers
  initSentinelCogLayers();

  // 4. Insert before vector boundary layer
  const layersColl = state.map.getLayers();
  const vectorIdx = layersColl.getArray().indexOf(state.vectorLayer);

  Object.values(state.rasterLayers).forEach(layer => {
    if (vectorIdx >= 0) {
      layersColl.insertAt(vectorIdx, layer);
    } else {
      layersColl.push(layer);
    }
  });

  // 5. Re-render UI list & Date Stepper
  renderRasterLayersList();
  updateDateStepperUI(state.activeRasterId, false);
  applyRasterFilters();
}

/**
 * Parses QGIS project XML string and applies its layers and metadata to the application.
 */
function applyQgsXml(xmlText, isLiveReload = false) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const qgisNode = xmlDoc.querySelector("qgis");
  const version = qgisNode ? qgisNode.getAttribute("version") : "3.44.15";
  const saveUser = qgisNode ? qgisNode.getAttribute("saveUserFull") || qgisNode.getAttribute("saveUser") : "Administrator";
  const saveDateTime = qgisNode ? qgisNode.getAttribute("saveDateTime") : "2026-10-24";

  QGIS_PROJECT_INFO.version = version;
  QGIS_PROJECT_INFO.user = saveUser;
  QGIS_PROJECT_INFO.saveDateTime = saveDateTime;

  const qgisVerEl = document.getElementById("qgisVersion");
  const qgisUserEl = document.getElementById("qgisUser");
  const qgisDateEl = document.getElementById("qgisDate");
  if (qgisVerEl) qgisVerEl.textContent = version;
  if (qgisUserEl) qgisUserEl.textContent = saveUser;
  if (qgisDateEl) qgisDateEl.textContent = saveDateTime;

  // Dynamically extract rasters from the QGS XML
  const dynamicRasters = extractRastersFromQgsXml(xmlDoc);
  if (dynamicRasters && dynamicRasters.length > 0) {
    SENTINEL_LAYERS_CONFIG = dynamicRasters;
    console.log(`[QGS Parser] Dynamically loaded ${dynamicRasters.length} raster layers from Part B.qgs:`, dynamicRasters.map(r => r.name));
  } else {
    console.warn("[QGS Parser] No GDAL/COG raster layers found in QGS XML; retaining current configuration.");
  }

  // Update XML Preview box in Project Info tab
  const xmlPreview = document.getElementById("xmlPreview");
  if (xmlPreview) {
    const allTreeLayers = xmlDoc.querySelectorAll("layer-tree-layer");
    let summary = `--- QGIS Project (Version ${version}) ---\n`;
    summary += `Saved By: ${saveUser} | ${saveDateTime}\n`;
    summary += `Total Layers in Tree: ${allTreeLayers.length}\n`;
    summary += `Sentinel-2 Rasters Loaded: ${dynamicRasters.length}\n\n`;
    summary += `Layers List:\n`;
    allTreeLayers.forEach((tl, idx) => {
      const name = tl.getAttribute("name");
      const provider = tl.getAttribute("providerKey");
      const src = tl.getAttribute("source");
      summary += `[${idx + 1}] ${name} (${provider})\n    ${src ? src.substring(0, 75) + "..." : ""}\n`;
    });
    xmlPreview.textContent = summary;
  }

  // If map is already running and this is a reload, rebuild the map layers
  if (isLiveReload && state.map) {
    rebuildRasterLayersOnMap();
  }
}

/**
 * Loads Part B.qgs via HTTP fetch (handles encoded and unencoded URLs).
 */
async function loadAndParseQgsProject(isLiveReload = false) {
  try {
    let res = await fetch("Part%20B.qgs");
    if (!res.ok) res = await fetch("Part B.qgs");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xmlText = await res.text();
    applyQgsXml(xmlText, isLiveReload);
    isQgsProjectLoaded = true;
    if (isLiveReload) {
      showToast(`Synchronized ${SENTINEL_LAYERS_CONFIG.length} raster layers from Part B.qgs!`);
    }
  } catch (err) {
    console.warn("Could not fetch Part B.qgs directly (running via file:/// or network issue), using embedded fallback:", err.message);
    renderFallbackQgsMetadata();
  }
}

function renderFallbackQgsMetadata() {
  document.getElementById("qgisVersion").textContent = QGIS_PROJECT_INFO.version;
  document.getElementById("qgisUser").textContent = QGIS_PROJECT_INFO.user;
  document.getElementById("qgisDate").textContent = QGIS_PROJECT_INFO.saveDateTime;

  let summary = `--- Extracted from Part B.qgs (v3.44.15) ---\n`;
  summary += `Project CRS: EPSG:4326 (WGS 84)\n`;
  summary += `Extent: [87.2757, 23.6746] to [87.2940, 23.6915]\n\n`;
  summary += `Active Raster Layers in Project (${SENTINEL_LAYERS_CONFIG.length} scenes):\n`;
  SENTINEL_LAYERS_CONFIG.forEach((cfg, idx) => {
    summary += `${idx + 1}. ${cfg.name} (COG Sentinel-2 L2A)\n`;
  });
  const xmlPreview = document.getElementById("xmlPreview");
  if (xmlPreview) xmlPreview.textContent = summary;
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
      applyQgsXml(e.target.result, true);
      showToast(`QGIS project ${file.name} synchronized with ${SENTINEL_LAYERS_CONFIG.length} raster layers!`);
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
    processAndSaveKmlFile(file);
  } else {
    showToast(`File ${file.name} received`);
  }
}

// ---------------------------------------------------------------------------
// 15. PIT ANALYTICS DATA POPULATION
// ---------------------------------------------------------------------------

function populatePitAnalyticsTable() {
  const tbody = document.getElementById("coordsTableBody");
  if (!tbody) return;
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

  // Read saved preference or default to state.defaultViewMode
  state.viewMode = localStorage.getItem("qgis_openmap_viewmode") || state.defaultViewMode || "auto";

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

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Dynamically parse Part B.qgs first so all raster layers are extracted directly from QGIS
  await loadAndParseQgsProject(false);
  // 2. Initialize the OpenLayers Map Engine and UI with the live project layers
  initWebGisMap();
});
