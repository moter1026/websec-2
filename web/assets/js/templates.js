import { state, isFav } from "./state.js";
import { escapeHtml, toTime, stationSubtitle } from "./util.js";

export function appHtml() {
  return `<div class="app">
    <header class="topbar">
      <div class="brandRow">
        <div class="brandTitle">
          <h1>Электрички — Прибывалка</h1>
          <div class="sub">Поиск станций, карта, расписание и избранное</div>
        </div>
      </div>
      <nav class="tabs" aria-label="Разделы">
        <button class="tab" data-tab="station" aria-selected="${state.tab === "station"}">Станция</button>
        <button class="tab" data-tab="route" aria-selected="${state.tab === "route"}">Между</button>
        <button class="tab" data-tab="favorites" aria-selected="${state.tab === "favorites"}">Избранное</button>
      </nav>
    </header>
    <main class="content">
      ${state.tab === "station" ? stationTabHtml() : ""}
      ${state.tab === "route"   ? routeTabHtml()   : ""}
      ${state.tab === "favorites" ? favoritesTabHtml() : ""}
    </main>
  </div>`;
}

export function stationTabHtml() {
  const results = state.stationResults.map((st) => `
    <div class="item">
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(st.title)}</div>
        <div class="itemMeta">
          ${stationSubtitle(st) ? `<span class="badge">${escapeHtml(stationSubtitle(st))}</span>` : ""}
          <span class="badge">${escapeHtml(st.code)}</span>
          ${isFav(st.code) ? `<span class="badge badgeOk">★</span>` : ""}
        </div>
      </div>
      <div class="row" style="flex:0 0 auto;gap:8px">
        <button class="btn btnPrimary" data-action="pick-station" data-code="${escapeHtml(st.code)}">Выбрать</button>
        <button class="btn" data-action="fav-station" data-code="${escapeHtml(st.code)}">${isFav(st.code) ? "Убрать" : "В избр."}</button>
      </div>
    </div>`).join("");

  const mapSection = state.mapVisible ? `
    <div style="margin-top:12px">
      <div class="label" style="margin-bottom:6px">
        Карта &nbsp;
        <span style="color:#22c55e;font-weight:700">●</span> станция &nbsp;
        <span style="color:#7c3aed;font-weight:700">●</span> группа (нажмите для выбора)
      </div>
      <div id="station-map-placeholder" class="mapWrap"></div>
    </div>` : "";

  const clusterSection = state.clusterStations.length > 0 ? `
    <section class="card">
      <div class="cardHeader">
        <div>
          <h2>Станции в точке</h2>
          <div class="hint">${state.clusterStations.length} станций объединены на этом масштабе</div>
        </div>
        <button class="btn btnGhost" data-action="clear-cluster">✕ Закрыть</button>
      </div>
      <div class="cardBody">
        <div class="list" role="list">
          ${state.clusterStations.map((st) => `
          <div class="item" role="listitem">
            <div class="itemMain">
              <div class="itemTitle">${escapeHtml(st.title)}</div>
              <div class="itemMeta">
                ${stationSubtitle(st) ? `<span class="badge">${escapeHtml(stationSubtitle(st))}</span>` : ""}
                <span class="badge">${escapeHtml(st.code)}</span>
                ${isFav(st.code) ? `<span class="badge badgeOk">★</span>` : ""}
              </div>
            </div>
            <div class="row" style="flex:0 0 auto;gap:8px">
              <button class="btn btnPrimary" data-action="pick-station" data-code="${escapeHtml(st.code)}">Выбрать</button>
              <button class="btn" data-action="fav-station" data-code="${escapeHtml(st.code)}">${isFav(st.code) ? "Убрать" : "В избр."}</button>
            </div>
          </div>`).join("")}
        </div>
      </div>
    </section>` : "";

  const schedule = state.stationSchedule.slice(0, 60).map((it) => {
    const dep = toTime(it.departure);
    const arr = toTime(it.arrival);
    const title = it.thread?.short_title || it.thread?.title || "Поезд";
    const num = it.thread?.number || "";
    return `<div class="item">
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(dep)} → ${escapeHtml(arr)} · ${escapeHtml(title)}</div>
        <div class="itemMeta">
          ${num ? `<span class="badge">${escapeHtml(num)}</span>` : ""}
          ${it.platform ? `<span class="badge">Платф. ${escapeHtml(it.platform)}</span>` : ""}
          ${it.days ? `<span class="badge">${escapeHtml(it.days)}</span>` : ""}
        </div>
      </div>
      <div style="flex:0 0 auto"><span class="badge badgeOk">электричка</span></div>
    </div>`;
  }).join("");

  return `
  <section class="card">
    <div class="cardHeader">
      <div>
        <h2>Найти станцию</h2>
        <div class="hint">По названию или кликом на точку на карте</div>
      </div>
      <button class="btn btnGhost" data-action="toggle-map">${state.mapVisible ? "Скрыть карту" : "Показать карту"}</button>
    </div>
    <div class="cardBody">
      <div class="field">
        <div class="labelRow">
          <div class="label">Название станции</div>
          <span class="badge">${state.query.trim() ? `${state.stationResults.length} результатов` : "введите запрос"}</span>
        </div>
        <input class="input" id="station-query" value="${escapeHtml(state.query)}" placeholder="Самара, Новокуйбышевск, Курумоч…" />
      </div>
      ${state.error ? `<div class="item"><div class="itemMain"><div class="itemTitle">Ошибка</div><div class="itemMeta"><span class="badge badgeWarn">${escapeHtml(state.error)}</span></div></div></div>` : ""}
      ${results}
      ${mapSection}
    </div>
  </section>

  ${clusterSection}

  <section class="card">
    <div class="cardHeader">
      <div>
        <h2>Расписание по станции</h2>
        <div class="hint">${state.selectedStation ? escapeHtml(state.selectedStation.title) : "Станция не выбрана"}</div>
      </div>
      <div class="row" style="flex:0 0 auto;gap:8px">
        <input class="input" id="station-date" style="height:40px" type="date" value="${escapeHtml(state.stationDate)}" />
        <button class="btn ${state.selectedStation && isFav(state.selectedStation.code) ? "btnPrimary" : ""}"
          data-action="fav-selected" ${state.selectedStation ? "" : "disabled"}>
          ${state.selectedStation ? (isFav(state.selectedStation.code) ? "★ В избранном" : "☆ В избранное") : "Выберите станцию"}
        </button>
      </div>
    </div>
    <div class="cardBody">
      ${state.selectedStation
        ? (schedule || `<div class="item"><div class="itemMain"><div class="itemTitle">Нет данных</div><div class="itemMeta"><span class="badge badgeWarn">Расписание пусто или недоступно</span></div></div></div>`)
        : `<div class="item"><div class="itemMain"><div class="itemTitle">Станция не выбрана</div><div class="itemMeta"><span class="badge">Найдите и выберите станцию выше или на карте</span></div></div></div>`}
    </div>
  </section>`;
}

export function routeTabHtml() {
  const segs = state.routeSegments.slice(0, 80).map((s) => {
    const title = s.thread?.short_title || s.thread?.title || "Электричка";
    return `<div class="item">
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(toTime(s.departure))} → ${escapeHtml(toTime(s.arrival))} · ${escapeHtml(title)}</div>
        <div class="itemMeta">
          ${s.thread?.number ? `<span class="badge">${escapeHtml(s.thread.number)}</span>` : ""}
          <span class="badge">${escapeHtml(s.from?.title || "—")}</span>
          <span class="badge">${escapeHtml(s.to?.title || "—")}</span>
          ${typeof s.duration === "number" ? `<span class="badge">${Math.round(s.duration / 60)} мин</span>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");

  return `
  <section class="card">
    <div class="cardHeader"><div><h2>Расписание между станциями</h2><div class="hint">Введите название, выберите из списка</div></div></div>
    <div class="cardBody">
      <div class="field">
        <div class="labelRow">
          <div class="label">Откуда</div>
          ${state.routeFrom ? `<span class="badge badgeOk">${escapeHtml(state.routeFrom.title)}</span>` : `<span class="badge">не выбрано</span>`}
        </div>
        <input class="input" id="route-from-q" placeholder="Начните вводить название…" autocomplete="off" />
        <div id="route-from-results"></div>
      </div>
      <div class="field">
        <div class="labelRow">
          <div class="label">Куда</div>
          ${state.routeTo ? `<span class="badge badgeOk">${escapeHtml(state.routeTo.title)}</span>` : `<span class="badge">не выбрано</span>`}
        </div>
        <input class="input" id="route-to-q" placeholder="Начните вводить название…" autocomplete="off" />
        <div id="route-to-results"></div>
      </div>
      <div class="row" style="margin-top:4px">
        <input class="input" id="route-date" type="date" value="${escapeHtml(state.routeDate)}" />
        <button class="btn btnPrimary" data-action="search-route">Показать</button>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn" ${!state.routeFrom ? "disabled" : ""} data-action="fav-route-from">
          ${state.routeFrom ? (isFav(state.routeFrom.code) ? "★ Откуда" : "☆ Откуда") : "Откуда"}
        </button>
        <button class="btn" ${!state.routeTo ? "disabled" : ""} data-action="fav-route-to">
          ${state.routeTo ? (isFav(state.routeTo.code) ? "★ Куда" : "☆ Куда") : "Куда"}
        </button>
      </div>
      ${state.error ? `<div class="item" style="margin-top:10px"><div class="itemMain"><div class="itemTitle">Ошибка</div><div class="itemMeta"><span class="badge badgeWarn">${escapeHtml(state.error)}</span></div></div></div>` : ""}
    </div>
  </section>
  <section class="card">
    <div class="cardHeader">
      <h2>Найденные рейсы</h2>
      ${state.routeSegments.length > 0 ? `<span class="badge">${state.routeSegments.length} рейсов</span>` : ""}
    </div>
    <div class="cardBody">
      ${segs || `<div class="item"><div class="itemMain"><div class="itemTitle">Пока нет данных</div><div class="itemMeta"><span class="badge">Выберите "Откуда" и "Куда", нажмите "Показать"</span></div></div></div>`}
    </div>
  </section>`;
}

export function favoritesTabHtml() {
  const list = state.favorites.map((f) => `
    <div class="item">
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(f.title)}</div>
        <div class="itemMeta">
          ${f.settlement ? `<span class="badge">${escapeHtml(f.settlement)}</span>` : ""}
          ${f.region ? `<span class="badge">${escapeHtml(f.region)}</span>` : ""}
          <span class="badge">${escapeHtml(f.code)}</span>
        </div>
      </div>
      <div class="row" style="flex:0 0 auto;gap:8px">
        <button class="btn btnPrimary" data-action="open-fav" data-code="${escapeHtml(f.code)}">Открыть</button>
        <button class="btn btnDanger" data-action="remove-fav" data-code="${escapeHtml(f.code)}">Удалить</button>
      </div>
    </div>`).join("");
  return `
  <section class="card">
    <div class="cardHeader"><div><h2>Любимые остановки</h2><div class="hint">Хранится локально в браузере</div></div></div>
    <div class="cardBody">
      ${list || `<div class="item"><div class="itemMain"><div class="itemTitle">Пока пусто</div><div class="itemMeta"><span class="badge">Добавьте станцию из вкладок "Станция" или "Между"</span></div></div></div>`}
    </div>
  </section>`;
}
