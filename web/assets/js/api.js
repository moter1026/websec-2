import { state } from "./state.js";

async function getJson(url, signal) {
  const opts = { headers: { Accept: "application/json" } };
  if (signal) opts.signal = signal;
  const r = await fetch(url, opts);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} ${t}`);
  }
  return r.json();
}

let _bboxAbortController = null;

/** Abort any in-flight bbox stations request and return a fresh AbortSignal for the next one. */
export function beginStationsByBboxRequest() {
  if (_bboxAbortController) _bboxAbortController.abort();
  _bboxAbortController = new AbortController();
  return _bboxAbortController.signal;
}

export function cancelStationsByBboxRequest() {
  if (_bboxAbortController) {
    _bboxAbortController.abort();
    _bboxAbortController = null;
  }
}

export async function fetchStationsByBbox(
  { min_lat, max_lat, min_lng, max_lng, limit = "500" },
  signal
) {
  const params = new URLSearchParams({
    min_lat: String(min_lat),
    max_lat: String(max_lat),
    min_lng: String(min_lng),
    max_lng: String(max_lng),
    limit: String(limit),
  });
  return getJson(`/api/stations/by_bbox?${params}`, signal);
}

export async function fetchStationsForPicker(q, limit = 10) {
  return getJson(`/api/stations?q=${encodeURIComponent(q)}&limit=${limit}`);
}

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
    const data = await getJson(
      `/api/station/${encodeURIComponent(state.selectedStation.code)}/schedule?${qs}`
    );
    state.stationSchedule = (data.schedule || []).sort((a, b) =>
      String(a.departure || "").localeCompare(String(b.departure || ""))
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
    state.routeSegments = (data.segments || []).sort((a, b) =>
      String(a.departure || "").localeCompare(String(b.departure || ""))
    );
  } catch (e) {
    state.error = String(e?.message || e);
    state.routeSegments = [];
  }
}
