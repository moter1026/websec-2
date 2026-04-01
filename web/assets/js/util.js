export function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function toTime(s) {
  if (!s) return "—";
  const m = String(s).match(/T(\d{2}:\d{2})/);
  return m?.[1] || String(s);
}

export function stationSubtitle(st) {
  return [st.settlement, st.region].filter(Boolean).join(" · ");
}

export async function getJson(url, signal) {
  const opts = { headers: { Accept: "application/json" } };
  if (signal) opts.signal = signal;
  const r = await fetch(url, opts);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} ${t}`);
  }
  return r.json();
}
