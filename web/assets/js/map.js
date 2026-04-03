import { state } from "./state.js";
import {
  beginStationsByBboxRequest,
  cancelStationsByBboxRequest,
  fetchStationsByBbox,
} from "./api.js";
import { getLayerByName, getSourceOfVectorLayerByName } from "./layerInstruments.js";

const STATIONS_LAYER_NAME = "stations";

export function drawMap({ render, loadStationSchedule }) {
  if (!window.ol) return;

  if (!state.mapContainer) {
    state.mapContainer = document.createElement("div");
    state.mapContainer.id = "station-map";
    state.mapContainer.style.cssText = "position:absolute;inset:0;";
  }

  const placeholder = document.getElementById("station-map-placeholder");
  if (!placeholder) return;
  placeholder.style.position = "relative";
  placeholder.appendChild(state.mapContainer);

  if (!state.mapReady) {
    initMap({ render, loadStationSchedule });
  } else {
    requestAnimationFrame(() => state.map && state.map.updateSize());
  }

  loadMapStations();
}

function initMap({ render, loadStationSchedule }) {
  const ol = window.ol;

  const mapVectorSource = new ol.source.Vector();

  const mapClusterSource = new ol.source.Cluster({
    distance: 40,
    minDistance: 20,
    source: mapVectorSource,
  });

  const _styleCache = new Map();
  function clusterStyle(feature) {
    const members = feature.get("features") || [];
    const n = members.length;
    if (!_styleCache.has(n)) {
      if (n === 1) {
        _styleCache.set(
          n,
          new ol.style.Style({
            image: new ol.style.Circle({
              radius: 7,
              fill: new ol.style.Fill({ color: "#22c55e" }),
              stroke: new ol.style.Stroke({ color: "#0b1220", width: 2 }),
            }),
          })
        );
      } else {
        const r = Math.min(9 + Math.ceil(Math.log2(n + 1)) * 2.5, 26);
        _styleCache.set(
          n,
          new ol.style.Style({
            image: new ol.style.Circle({
              radius: r,
              fill: new ol.style.Fill({ color: "#7c3aed" }),
              stroke: new ol.style.Stroke({ color: "#0b1220", width: 2.5 }),
            }),
            text: new ol.style.Text({
              text: String(n),
              fill: new ol.style.Fill({ color: "#fff" }),
              font: `bold ${Math.round(r * 0.85)}px sans-serif`,
              offsetY: 1,
            }),
          })
        );
      }
    }
    return _styleCache.get(n);
  }

  const stationsLayer = new ol.layer.Vector({
    source: mapClusterSource,
    style: clusterStyle,
  });
  stationsLayer.set("name", STATIONS_LAYER_NAME);

  state.map = new ol.Map({
    target: state.mapContainer,
    layers: [new ol.layer.Tile({ source: new ol.source.OSM() }), stationsLayer],
    view: new ol.View({
      center: ol.proj.fromLonLat([37.617, 55.755]),
      zoom: 6,
    }),
  });

  state.map.on("pointermove", (evt) => {
    if (evt.dragging) return;
    const hit = state.map.hasFeatureAtPixel(evt.pixel, {
      layerFilter: (l) => l.get("name") === STATIONS_LAYER_NAME,
      hitTolerance: 8,
    });
    state.mapContainer.style.cursor = hit ? "pointer" : "";
  });

  state.map.on("singleclick", async (evt) => {
    const features = state.map.getFeaturesAtPixel(evt.pixel, {
      layerFilter: (l) => l.get("name") === STATIONS_LAYER_NAME,
      hitTolerance: 12,
    });
    if (!features || features.length === 0) return;

    const members = features[0].get("features") || [];
    if (members.length === 0) return;

    if (members.length === 1) {
      const station = members[0].get("station");
      if (!station) return;
      state.clusterStations = [];
      state.selectedStation = station;
      await loadStationSchedule();
      render();
    } else {
      state.clusterStations = members.map((f) => f.get("station")).filter(Boolean);
      state.selectedStation = null;
      state.stationSchedule = [];
      render();
    }
  });

  state.map.on("moveend", () => loadMapStations());

  state.mapReady = true;
}

export function destroyMap() {
  cancelStationsByBboxRequest();
  if (state.map) {
    state.map.setTarget(null);
    state.map.dispose();
    state.map = null;
  }
  state.mapReady = false;
}

async function loadMapStations() {
  if (!state.map) return;
  const vectorSource = getSourceOfVectorLayerByName(state.map, STATIONS_LAYER_NAME);
  if (!vectorSource) return;

  const size = state.map.getSize();
  if (!size || !size[0]) return;

  const extent = state.map.getView().calculateExtent(size);
  const ol = window.ol;
  const sw = ol.proj.toLonLat([extent[0], extent[1]]);
  const ne = ol.proj.toLonLat([extent[2], extent[3]]);

  const signal = beginStationsByBboxRequest();

  try {
    const stations = await fetchStationsByBbox(
      {
        min_lat: sw[1].toFixed(4),
        max_lat: ne[1].toFixed(4),
        min_lng: sw[0].toFixed(4),
        max_lng: ne[0].toFixed(4),
        limit: "500",
      },
      signal
    );
    if (signal.aborted) return;

    vectorSource.clear();
    for (const s of stations) {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") continue;
      vectorSource.addFeature(
        new ol.Feature({
          geometry: new ol.geom.Point(ol.proj.fromLonLat([s.lng, s.lat])),
          station: s,
        })
      );
    }
  } catch (e) {
    if (!signal.aborted) console.warn("loadMapStations:", e.message);
  }
}
