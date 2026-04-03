/**
 * При полном перерисовывании через innerHTML фокус и позиция каретки в полях ввода теряются.
 * Снимок активного элемента перед render() и восстановление после — чтобы не «выбрасывало»
 * из строки поиска и дат при каждом обновлении UI.
 */
let pendingInputFocus = null;

export function captureInputFocus() {
  pendingInputFocus = null;
  const el = document.activeElement;
  if (!el) return;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    const id = el.id;
    if (!id) return;
    const snap = { id };
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      snap.selStart = el.selectionStart;
      snap.selEnd = el.selectionEnd;
      snap.selDir = el.selectionDirection;
    }
    pendingInputFocus = snap;
  }
}

export function restoreInputFocusAfterRender() {
  const snap = pendingInputFocus;
  pendingInputFocus = null;
  if (!snap) return;
  const el = document.getElementById(snap.id);
  if (!el) return;
  el.focus();
  if (
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
    typeof el.setSelectionRange === "function" &&
    snap.selStart != null &&
    snap.selEnd != null
  ) {
    try {
      el.setSelectionRange(snap.selStart, snap.selEnd, snap.selDir || "forward");
    } catch {
      /* e.g. type=date */
    }
  }
}
