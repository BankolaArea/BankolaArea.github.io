# Part B.qgs • WebGIS Developer & Customization Guide

This developer guide provides step-by-step instructions on customizing defaults, base maps, boundaries, legends, raster layers, and view modes in the **Part B.qgs Client-Side WebGIS Viewer**.

All application settings are client-side and can be modified directly in two files:
- [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js) — GIS engine logic, OpenLayers layers, projections, and state
- [`index.html`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/index.html) — DOM UI controls, defaults, and initial widget states
- [`style.css`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/style.css) — Design system, layout, and responsive mobile rules

---

## Table of Contents
1. [Changing the Default Base Map](#1-changing-the-default-base-map)
2. [Adding a New Custom Base Map](#2-adding-a-new-custom-base-map)
3. [KML / Leasehold Boundary Defaults (Color, Opacity & Coordinates)](#3-kml--leasehold-boundary-defaults)
4. [Map Legend View (Show, Hide, or Remove)](#4-map-legend-view)
5. [Default Satellite Raster Scene (Sentinel-2 COG)](#5-default-satellite-raster-scene)
6. [Default Map Center, Extent & Zoom Level](#6-default-map-center-extent--zoom-level)
7. [Default GPU Raster FX Filters (Brightness, Contrast, Presets)](#7-default-gpu-raster-fx-filters)
8. [Default View Mode (Auto, Mobile, Desktop)](#8-default-view-mode)

---

## 1. Changing the Default Base Map

The application includes 5 pre-configured basemaps:
- `google-earth` (Google Earth Satellite)
- `google-traffic` (Google Hybrid & Real-time Traffic)
- `esri-sat` (Esri World Imagery Satellite)
- `carto-dark` (CartoDB Dark Matter)
- `osm` (OpenStreetMap Standard)

### Steps to Change Default Base Map:

#### Step A: Update Active Key and Layer Visibility in `app.js`
Open [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js):
1. In the `state` object (around line 128), set `activeBaseKey` to your desired key:
```javascript
const state = {
  map: null,
  baseLayers: {},
  activeBaseKey: "esri-sat", // <-- Change here (e.g. "esri-sat", "google-earth", "carto-dark", "osm")
  ...
};
```
2. In `initWebGisMap()` (around line 155), set `visible: true` for your desired base layer and `visible: false` for the others:
```javascript
// Example: Setting Esri World Imagery as default
state.baseLayers["google-earth"] = new ol.layer.Tile({
  ...
  visible: false // <-- Set false
});

state.baseLayers["esri-sat"] = new ol.layer.Tile({
  title: "Esri World Imagery",
  source: new ol.source.XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19
  }),
  visible: true // <-- Set true
});
```

#### Step B: Update Active Button in `index.html`
In [`index.html`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/index.html) (inside the Base Map Section):
Move the `active` class to the button matching your chosen basemap:
```html
<!-- Example: Setting Esri Satellite active by default -->
<div class="basemap-grid">
  <button class="basemap-btn" data-base="google-earth">
    <div class="base-preview base-google-earth"></div>
    <span>Google Earth</span>
  </button>
  <button class="basemap-btn active" data-base="esri-sat"> <!-- Added active -->
    <div class="base-preview base-esri"></div>
    <span>Esri Satellite</span>
  </button>
  ...
</div>
```

---

## 2. Adding a New Custom Base Map

To add a custom tile provider (such as Bhuvan, Mapbox, or custom tile server):

1. Define the layer in `app.js` inside `initWebGisMap()`:
```javascript
state.baseLayers["custom-map"] = new ol.layer.Tile({
  title: "Custom Topo Map",
  source: new ol.source.XYZ({
    url: "https://tile.yourserver.org/{z}/{x}/{y}.png",
    maxZoom: 18,
    attributions: "© Your Attribution"
  }),
  visible: false
});
```
2. Add the layer to the map's layers array:
```javascript
state.map = new ol.Map({
  target: "map",
  layers: [
    ...Object.values(state.baseLayers),
    ...Object.values(state.rasterLayers),
    state.vectorLayer
  ],
  ...
});
```
3. Add a button in [`index.html`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/index.html) inside `.basemap-grid`:
```html
<button class="basemap-btn" data-base="custom-map">
  <div class="base-preview"></div>
  <span>Custom Map</span>
</button>
```

---

## 3. KML / Leasehold Boundary Defaults

The boundary layer represents the Part-B-OCP mining leasehold boundary.

### A. Hide Boundary by Default
1. In [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js) inside `initVectorBoundaryLayer()` (around line 315):
```javascript
state.vectorLayer = new ol.layer.Vector({
  source: vectorSource,
  style: createVectorStyle("#ff9800", 0.25),
  visible: false, // <-- Change from true to false
  zIndex: 99
});
```
2. In [`index.html`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/index.html), remove the `checked` attribute from the toggle switch:
```html
<!-- Before -->
<input type="checkbox" id="chkKmlBoundary" checked />

<!-- After (Off by default) -->
<input type="checkbox" id="chkKmlBoundary" />
```

### B. Change Default Border Color and Fill Opacity
1. In [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js):
```javascript
// Change color hex (e.g. #00e5ff for Cyan) and opacity (e.g. 0.35 for 35%)
state.vectorLayer = new ol.layer.Vector({
  source: vectorSource,
  style: createVectorStyle("#00e5ff", 0.35),
  visible: true,
  zIndex: 99
});
```
2. In [`index.html`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/index.html):
```html
<input type="color" id="kmlBorderColor" value="#00e5ff" />
<input type="range" id="kmlOpacity" min="0" max="1" step="0.05" value="0.35" />
<span id="kmlOpacityVal">35%</span>
```

### C. Update or Replace Boundary Polygon Coordinates
The boundary coordinates are defined in `PART_B_OCP_POLYGON` in [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js) (lines 27–39) in `[Longitude, Latitude]` format:
```javascript
const PART_B_OCP_POLYGON = [
  [87.2845870925932, 23.68416998949326],
  [87.28650444077128, 23.68426505813315],
  ...
  [87.2845870925932, 23.68416998949326] // Always close the polygon with the first point
];
```

---

## 4. Map Legend View

The map floating legend widget can be configured to be visible, hidden, or completely removed.

### Option 1: Hidden by Default (Can be toggled via JS or UI)
Add `style="display: none;"` to the widget in [`index.html`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/index.html):
```html
<div class="map-legend-widget" id="mapLegend" style="display: none;">
  <div class="legend-header">
    <span><i class="fa-solid fa-list-check"></i> Active Layer Legend</span>
    <button class="btn-close-legend" id="btnCloseLegend"><i class="fa-solid fa-xmark"></i></button>
  </div>
  ...
</div>
```

### Option 2: Visible by Default
Ensure `style="display: none;"` is removed:
```html
<div class="map-legend-widget" id="mapLegend">
  ...
</div>
```

### Option 3: Completely Removed / Commented Out
Comment out or remove the HTML block:
```html
<!--
<div class="map-legend-widget" id="mapLegend">
  ...
</div>
-->
```
> [!NOTE]
> `app.js` is built with defensive null-checks for `btnCloseLegend` and `mapLegend`, so removing or commenting out the legend widget will **not** cause any JavaScript errors.

---

## 5. Default Satellite Raster Scene

The Sentinel-2 Cloud-Optimized GeoTIFFs (COGs) are listed in `SENTINEL_LAYERS_CONFIG` in [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js) (lines 43–110).

### Changing Which Satellite Scene is Active on Load:
1. In [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js) around line 131:
```javascript
const state = {
  ...
  activeRasterId: "s2_20261005", // <-- Set your default layer ID here
  ...
};
```
2. In `SENTINEL_LAYERS_CONFIG`, ensure the chosen layer has `defaultChecked: true`, and set all others to `false`:
```javascript
{
  id: "s2_20261005",
  name: "S2 [2026-10-05] (5.7% cloud) - TCI",
  ...
  defaultChecked: true // <-- Set true
}
```
3. Update the initial badge in [`index.html`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/index.html):
```html
<span class="brand-sub" id="currentSceneName">S2 [2026-10-05] (5.7% cloud)</span>
```

---

## 6. Default Map Center, Extent & Zoom Level

To change where the map opens by default, edit `QGIS_PROJECT_INFO` in [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js) (lines 14–24):

```javascript
const QGIS_PROJECT_INFO = {
  filename: "Part B.qgs",
  version: "3.44.15-Solothurn",
  crs: "EPSG:4326 (WGS 84)",
  projectedCrs: "EPSG:32645 (WGS 84 / UTM zone 45N)",
  
  // Bounding box [xmin (Lon), ymin (Lat), xmax (Lon), ymax (Lat)]
  extent: [87.2757366, 23.6746642, 87.2940692, 23.6915430],
  
  // Starting coordinates [Longitude, Latitude]
  center: [87.2865, 23.6895],
  
  // Initial zoom (e.g. 14 for regional, 15-16 for mine pit detail)
  defaultZoom: 15
};
```

---

## 7. Default GPU Raster FX Filters

GPU image enhancement filters (Brightness, Contrast, Saturation, Gamma) run client-side on the WebGL canvas.

### In `app.js`:
Adjust the starting values in `state.rasterFilters` (around line 138):
```javascript
rasterFilters: {
  brightness: 100, // 30 - 250 (%)
  contrast: 115,   // 50 - 250 (%)
  saturation: 120, // 0 - 300 (%)
  gamma: 100,      // 50 - 200 (%)
  preset: "natural" // "natural", "high-contrast", "vegetation", "grayscale"
}
```

### In `index.html`:
Update the corresponding slider input default `value` attributes and labels:
```html
<input type="range" id="rngBrightness" min="30" max="250" value="100" />
<span id="lblBrightness">100%</span>

<input type="range" id="rngContrast" min="50" max="250" value="115" />
<span id="lblContrast">115%</span>
```

---

## 8. Default View Mode

The viewer supports 3 view modes:
- `"auto"` — Automatically displays Mobile mode on screens `<= 850px` or mobile devices; displays Desktop mode on wider screens.
- `"mobile"` — Forces mobile layout (slide-over drawer, bottom navigation, compact headers).
- `"desktop"` — Forces standard desktop multi-panel workspace regardless of screen size.

### To Change the Hardcoded Fallback Default:
In [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js) inside `setupMobileAndAdaptiveView()`:
```javascript
// Default is 'auto'. You can change to 'desktop' or 'mobile':
state.viewMode = localStorage.getItem("qgis_openmap_viewmode") || "auto";
```

### Clearing / Overriding Stored Preferences:
Users can switch view modes anytime via the status bar button `[View: Auto]` or mobile buttons. To programmatically reset or clear user preferences in browser console:
```javascript
localStorage.removeItem("qgis_openmap_viewmode");
location.reload();
```

---

## Summary of Key Files

| File | Purpose |
| :--- | :--- |
| [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js) | Core WebGIS logic, OpenLayers maps/layers, COG reading, state management |
| [`index.html`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/index.html) | Markup, sidebar panels, controls, mobile navigation bar & top bar |
| [`style.css`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/style.css) | Dark obsidian theme, responsive mobile drawer styles, map tool styling |
| [`Part B.qgs`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/Part%20B.qgs) | Original QGIS project XML loaded and parsed in the browser |
