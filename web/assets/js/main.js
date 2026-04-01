import { state } from "./state.js";
import { render } from "./render.js";

render();

window._debug = {
  getState: () => state,
  getMap: () => state.map,
  firstFeaturePixel: () => {
    if (!state.map || !state.mapClusterSource) return null;
    const features = state.mapClusterSource.getFeatures();
    if (!features.length) return null;
    const geom = features[0].getGeometry();
    if (!geom) return null;
    return state.map.getPixelFromCoordinate(geom.getCoordinates());
  },
  featureCount: () => {
    const vs = state.mapVectorSource;
    const cs = state.mapClusterSource;
    return { vector: vs ? vs.getFeatures().length : 0, cluster: cs ? cs.getFeatures().length : 0 };
  },
};
