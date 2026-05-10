// Feature visibility for stable / dev channel split.
export const STABLE_HIDES = true;

// === Mobile detection ==================================================
// Modules with heavy WebGL / continuous rAF (status tracker palette,
// metadata-inspector tool, character-card fullscreen panel, global
// search bar) are disabled on mobile to save memory + GPU budget.
//
// Detection layers (any → mobile):
//   1. UA regex — matches phones + most tablets, but iPad on iOS 13+
//      reports as Macintosh and modern Android can request "desktop
//      site" which strips the Mobile token.
//   2. Touch + coarse pointer — catches the iPad-as-Mac case and
//      Android desktop-mode (touchscreen still reports `pointer:
//      coarse` even with a spoofed UA).
//   3. Small screen + touch — defensive backstop for browsers that
//      mask the pointer query.
export function isMobileDevice(): boolean {
  try {
    const ua = navigator.userAgent || "";
    if (/Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua)) return true;
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const isCoarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (hasTouch && isCoarse) return true;
    if (hasTouch && window.innerWidth <= 600) return true;
  } catch {}
  return false;
}
export const IS_MOBILE = isMobileDevice();

/** Panel IDs hidden from the layout editor on mobile because their
 *  underlying tool was never registered. */
export const MOBILE_HIDDEN_PANELS: ReadonlySet<string> = new Set([
  "status-palette",
  "metadata-inspector",
]);
