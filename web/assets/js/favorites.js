const FAV_KEY = "favStations_v1";

export function loadFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); }
  catch { return []; }
}

export function saveFavorites(items) {
  localStorage.setItem(FAV_KEY, JSON.stringify(items));
}
