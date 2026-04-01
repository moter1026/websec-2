import { state } from "./state.js";
import { getJson } from "./util.js";

export async function searchStations() {
  const q = state.query.trim();
  state.error = "";
  if (!q) {
    state.stationResults = [];
    return;
  }
  try {
    state.stationResults = await getJson(`/api/stations?q=${encodeURIComponent(q)}&limit=25`);
  } catch (e) {
    state.error = String(e?.message || e);
    state.stationResults = [];
  }
}

export async function loadStationSchedule() {
  state.error = "";
  if (!state.selectedStation?.code) {
    state.stationSchedule = [];
    return;
  }
  try {
    const qs = new URLSearchParams();
    if (state.stationDate) qs.set("date", state.stationDate);
    const data = await getJson(`/api/station/${encodeURIComponent(state.selectedStation.code)}/schedule?${qs}`);
    state.stationSchedule = (data.schedule || []).sort(
      (a, b) => String(a.departure || "").localeCompare(String(b.departure || ""))
    );
  } catch (e) {
    state.error = String(e?.message || e);
    state.stationSchedule = [];
  }
}

export async function loadRoute() {
  state.error = "";
  if (!state.routeFrom?.code || !state.routeTo?.code) {
    state.error = "Выберите обе станции";
    return;
  }
  try {
    const qs = new URLSearchParams({ from: state.routeFrom.code, to: state.routeTo.code });
    if (state.routeDate) qs.set("date", state.routeDate);
    const data = await getJson(`/api/route/search?${qs}`);
    state.routeSegments = (data.segments || []).sort(
      (a, b) => String(a.departure || "").localeCompare(String(b.departure || ""))
    );
  } catch (e) {
    state.error = String(e?.message || e);
    state.routeSegments = [];
  }
}
