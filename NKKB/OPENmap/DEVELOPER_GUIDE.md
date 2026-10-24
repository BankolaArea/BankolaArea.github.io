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
- `"osm"` : OpenStreetMap Standard
- `"google-earth"` : Google Earth Satellite (High-res photographic)
- `"google-traffic"` : Google Traffic & Hybrid Roads
- `"esri-sat"` : Esri World Imagery Satellite
- `"carto-dark"` : CartoDB Dark Matter (Sleek dark theme)

### Super-Easy Step:
Open [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js) and simply change `activeBaseKey` inside `const state = { ... }`:

```javascript
const state = {
  // Change to: "osm", "google-earth", "esri-sat", "carto-dark", or "google-traffic"
  activeBaseKey: "osm", 
  ...
};
```
> [!TIP]
> That's all! Both the map layer visibility and the active highlight button in the sidebar will automatically synchronize with your chosen default. No HTML changes needed!

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

The boundary layer represents the Part-B-OCP mining leasehold boundary. You can customize all boundary defaults directly inside `const state = { ... }` in [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js):

```javascript
const state = {
  ...
  // 📐 PART-B-OCP LEASEHOLD BOUNDARY DEFAULTS
  boundaryVisible: true,     // true = visible on load, false = hidden by default
  boundaryColor: "#ff9800",  // Color hex: #ff9800 (Orange), #00e5ff (Cyan), #10b981 (Emerald), etc.
  boundaryOpacity: 0.25,     // Fill opacity: 0.0 (transparent) to 1.0 (solid)
  ...
};
```
> [!TIP]
> Changing these values in `state` automatically updates the map rendering **and** synchronizes the checkbox, color picker, and opacity slider in the sidebar!

### Updating or Replacing Boundary Polygon Coordinates
The boundary coordinates are defined in `PART_B_OCP_POLYGON` in [`app.js`](file:///c:/WEBMASTER/BankolaArea.github.io/NKKB/OPENmap/app.js) in `[Longitude, Latitude]` format:
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

## 5. Dynamic Satellite Raster Scenes (Fetched from Part B.qgs)

The Sentinel-2 Cloud-Optimized GeoTIFFs (COGs) are **dynamically fetched and parsed directly from `Part B.qgs`** at runtime!
Whenever you add or remove rasters in your QGIS project and save `Part B.qgs`, simply refresh the browser or click **"Synchronize from Part B.qgs"** in the Project Info tab. The website automatically reads your QGIS layers, updates the layer list, adjusts the date stepper count, and adds them to the map.

### Automatic Latest Scene Selection (Default):
By default, `state.activeRasterId` is set to `"latest"`:
```javascript
const state = {
  ...
  activeRasterId: "latest", // <-- Automatically selects the newest acquisition by date!
  defaultRasterOpacity: 1.0, // <-- Default opacity/visibility (1.0 = 100% full opacity)
  ...
};
```
When set to `"latest"`, the engine compares the dates of all available Sentinel-2 scenes in `Part B.qgs` and activates the newest one automatically. The scene badges in the sidebar and mobile header update dynamically without manual changes!

### Default Raster Opacity / Visibility:
By default, `state.defaultRasterOpacity` is set to `1.0` (100% visibility).
- `1.0` : 100% (Solid, fully opaque)
- `0.95`: 95%
- `0.80`: 80% (Subtle basemap bleed-through)

Changing `defaultRasterOpacity` in `state` automatically adjusts both the WebGL raster layers and the sidebar opacity range sliders + percentage labels.

### Multi-Date Comparison & Arrow Key Stepper:
To compare satellite imagery over time without relying on a split-screen slider:
- **On-Map Floating Stepper**: Click the **▲ (Newer Date)** or **▼ (Older Date)** chevron buttons directly on the map.
- **Keyboard Navigation**: Press <kbd>▲ ArrowUp</kbd> (Newer) or <kbd>▼ ArrowDown</kbd> (Older) anywhere on the map to instantly cycle dates.
- **Notification Banner**: Whenever a date changes, an animated banner pops down from the top of the map for 3.5 seconds with the date, cloud cover, and scene index.
- Configure duration via `state.dateBannerDuration: 3500` (in milliseconds).

### To Pin a Specific Scene Instead:
If you prefer to lock the map to a fixed scene (e.g. October 15 cleanest), simply provide its ID:
```javascript
const state = {
  ...
  activeRasterId: "s2_20261015", // <-- Fixed scene ID
  ...
};
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
