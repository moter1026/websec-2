import { state } from "./state.js";
import { appHtml } from "./templates.js";
import { captureInputFocus, restoreInputFocusAfterRender } from "./focus.js";
import { bindUi } from "./ui.js";
import { drawMap } from "./map.js";
import { loadStationSchedule } from "./api.js";

export function render() {
  captureInputFocus();
  document.getElementById("root").innerHTML = appHtml();
  bindUi(render);
  restoreInputFocusAfterRender();
  if (state.tab === "station" && state.mapVisible) {
    drawMap({ render, loadStationSchedule });
  }
}
