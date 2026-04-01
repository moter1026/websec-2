import { state, getStationByCode } from "./state.js";
import { saveFavorites } from "./favorites.js";
import { searchStations, loadStationSchedule, loadRoute } from "./api.js";
import { destroyMap } from "./map.js";
import { getJson, escapeHtml, stationSubtitle } from "./util.js";

function bindStationPicker(inputId, resultsId, onSelect) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(resultsId);
  if (!input || !container) return;
  let t = null;
  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(t);
    if (!q) { container.innerHTML = ""; return; }
    t = setTimeout(async () => {
      const stations = await getJson(`/api/stations?q=${encodeURIComponent(q)}&limit=10`).catch(() => []);
      if (!stations.length) { container.innerHTML = ""; return; }
      container.innerHTML = `<div class="list" style="margin-top:8px" role="list">
        ${stations.map((st) => `
        <div class="item" role="listitem">
          <div class="itemMain">
            <div class="itemTitle">${escapeHtml(st.title)}</div>
            <div class="itemMeta">
              ${stationSubtitle(st) ? `<span class="badge">${escapeHtml(stationSubtitle(st))}</span>` : ""}
              <span class="badge">${escapeHtml(st.code)}</span>
            </div>
          </div>
          <button class="btn btnPrimary" data-code="${escapeHtml(st.code)}">Выбрать</button>
        </div>`).join("")}
      </div>`;
      container.querySelectorAll("[data-code]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const st = stations.find((s) => s.code === btn.getAttribute("data-code"));
          if (!st) return;
          input.value = st.title;
          container.innerHTML = "";
          onSelect(st);
        });
      });
    }, 250);
  });
}

function toggleFavMutate(st) {
  if (!st?.code) return;
  if (state.favorites.some((x) => x.code === st.code)) {
    state.favorites = state.favorites.filter((x) => x.code !== st.code);
  } else {
    state.favorites = [{
      code: st.code, title: st.title,
      lat: st.lat ?? null, lng: st.lng ?? null,
      region: st.region ?? null, settlement: st.settlement ?? null,
    }, ...state.favorites].slice(0, 30);
  }
  saveFavorites(state.favorites);
}

export function bindUi(render) {
  document.querySelectorAll("[data-tab]").forEach((el) =>
    el.addEventListener("click", () => {
      state.tab = el.getAttribute("data-tab");
      state.error = "";
      render();
    })
  );

  const qEl = document.getElementById("station-query");
  if (qEl) qEl.addEventListener("input", () => {
    state.query = qEl.value;
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(async () => {
      await searchStations();
      render();
    }, 250);
  });

  const sd = document.getElementById("station-date");
  if (sd) sd.addEventListener("change", async () => {
    state.stationDate = sd.value;
    await loadStationSchedule();
    render();
  });

  const rd = document.getElementById("route-date");
  if (rd) rd.addEventListener("change", () => { state.routeDate = rd.value; });

  bindStationPicker("route-from-q", "route-from-results", (st) => {
    state.routeFrom = st;
    render();
  });
  bindStationPicker("route-to-q", "route-to-results", (st) => {
    state.routeTo = st;
    render();
  });

  document.querySelectorAll("[data-action]").forEach((el) =>
    el.addEventListener("click", async () => {
      const act  = el.getAttribute("data-action");
      const code = el.getAttribute("data-code");

      if (act === "toggle-map") {
        state.mapVisible = !state.mapVisible;
        if (!state.mapVisible) destroyMap();
        render();

      } else if (act === "pick-station") {
        const st = getStationByCode(code);
        if (st) {
          state.clusterStations = [];
          state.selectedStation = st;
          await loadStationSchedule();
          render();
        }

      } else if (act === "fav-station") {
        const st = getStationByCode(code);
        if (st) {
          toggleFavMutate(st);
          render();
        }

      } else if (act === "fav-selected") {
        if (state.selectedStation) {
          toggleFavMutate(state.selectedStation);
          render();
        }

      } else if (act === "clear-cluster") {
        state.clusterStations = [];
        render();

      } else if (act === "search-route") {
        await loadRoute();
        render();

      } else if (act === "fav-route-from") {
        if (state.routeFrom) {
          toggleFavMutate(state.routeFrom);
          render();
        }

      } else if (act === "fav-route-to") {
        if (state.routeTo) {
          toggleFavMutate(state.routeTo);
          render();
        }

      } else if (act === "remove-fav") {
        state.favorites = state.favorites.filter((x) => x.code !== code);
        saveFavorites(state.favorites);
        render();

      } else if (act === "open-fav") {
        const st = state.favorites.find((x) => x.code === code);
        if (st) {
          state.selectedStation = st;
          state.clusterStations = [];
          state.tab = "station";
          await loadStationSchedule();
          render();
        }
      }
    })
  );
}
