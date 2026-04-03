/** Resolve an OpenLayers layer by custom `name` set via layer.set("name", "..."). */
export function getLayerByName(mapObject, layerName) {
  if (!mapObject) return null;
  return mapObject.getAllLayers().find((l) => l.get("name") === layerName) || null;
}

/**
 * Vector source for a layer: plain VectorSource, or inner source of ol.source.Cluster.
 */
export function getSourceOfVectorLayerByName(mapObject, layerName) {
  const layer = getLayerByName(mapObject, layerName);
  if (!layer) return null;
  const src = layer.getSource();
  if (!src) return null;
  if (typeof src.getSource === "function") {
    const inner = src.getSource();
    if (inner) return inner;
  }
  return src;
}
