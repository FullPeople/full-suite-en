// Feature visibility for stable / dev channel split.
export const STABLE_HIDES = false;

// === Mobile detection ==================================================
// Modules with heavy WebGL / continuous rAF (status tracker palette,
// metadata-inspector tool, character-card fullscreen panel, global
// search bar) are disabled on mobile to save memory + GPU budget.
export function isMobileDevice(): boolean {
  try {
    const ua = navigator.userAgent || "";
    return /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua);
  } catch {
    return false;
  }
}
export const IS_MOBILE = isMobileDevice();

/** Panel IDs hidden from the layout editor on mobile because their
 *  underlying tool was never registered. */
export const MOBILE_HIDDEN_PANELS: ReadonlySet<string> = new Set([
  "status-palette",
  "metadata-inspector",
]);
