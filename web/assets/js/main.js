import { state } from "./state.js";
import { render } from "./render.js";
import { getLayerByName, getSourceOfVectorLayerByName } from "./layerInstruments.js";

render();

const STATIONS_LAYER_NAME = "stations";

window._debug = {
  getState: () => state,
  getMap: () => state.map,
  firstFeaturePixel: () => {
    if (!state.map) return null;
    const layer = getLayerByName(state.map, STATIONS_LAYER_NAME);
    const clusterSrc = layer?.getSource();
    const features = clusterSrc?.getFeatures?.() || [];
    if (!features.length) return null;
    const geom = features[0].getGeometry();
    if (!geom) return null;
    return state.map.getPixelFromCoordinate(geom.getCoordinates());
  },
  featureCount: () => {
    const vs = state.map ? getSourceOfVectorLayerByName(state.map, STATIONS_LAYER_NAME) : null;
    const layer = state.map ? getLayerByName(state.map, STATIONS_LAYER_NAME) : null;
    const cs = layer?.getSource();
    return {
      vector: vs ? vs.getFeatures().length : 0,
      cluster: cs?.getFeatures ? cs.getFeatures().length : 0,
    };
  },
};
