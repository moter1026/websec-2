import { loadFavorites } from "./favorites.js";

export const state = {
  tab: "station",
  query: "",
  stationResults: [],
  selectedStation: null,
  stationSchedule: [],
  stationDate: new Date().toISOString().slice(0, 10),
  clusterStations: [],
  routeFrom: null,
  routeTo: null,
  routeDate: new Date().toISOString().slice(0, 10),
  routeSegments: [],
  favorites: loadFavorites(),
  error: "",
  mapVisible: true,
  mapContainer: null,
  map: null,
  mapReady: false,
  searchTimer: null,
};

export function isFav(code) {
  return state.favorites.some((x) => x.code === code);
}

export function getStationByCode(code) {
  return (
    state.stationResults.find((x) => x.code === code) ||
    state.clusterStations.find((x) => x.code === code) ||
    (state.selectedStation?.code === code ? state.selectedStation : null) ||
    (state.routeFrom?.code === code ? state.routeFrom : null) ||
    (state.routeTo?.code === code ? state.routeTo : null) ||
    null
  );
}
