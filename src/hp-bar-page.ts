// Standalone HP / Temp / AC bar — popover script (EN version).
//
// URL params:
//   itemId — required, the token whose bubbles metadata we read & write.

import OBR from "@owlbear-rodeo/sdk";
import { bindPanelDrag } from "./utils/panelDrag";
import { PANEL_IDS } from "./utils/panelLayout";
import {
  parseStatInput,
  readBubbles,
  patchBubbles,
  clampStat,
  type BubblesData,
} from "./utils/statEdit";

const params = new URLSearchParams(location.search);
const itemId = params.get("itemId") ?? "";

const dragHandle = document.getElementById("dragHandle") as HTMLDivElement;
const hpPillEl = document.getElementById("hpPill") as HTMLDivElement;
const lockBtn = document.getElementById("lockBtn") as HTMLButtonElement | null;
const inputs = Array.from(
  document.querySelectorAll<HTMLInputElement>(".stat-input"),
);

let live: BubblesData = {};
let isGM = false;

function fmt(v: number | undefined, fallback = 0): string {
  return String(typeof v === "number" ? v : fallback);
}

function paint(): void {
  for (const inp of inputs) {
    if (document.activeElement === inp) continue;
    const field = inp.dataset.field as keyof BubblesData;
    inp.value = fmt(live[field] as number | undefined);
  }
  const hp = typeof live.health === "number" ? live.health : 0;
  const max = typeof live["max health"] === "number" ? live["max health"] : 0;
  const ratio = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 1;
  hpPillEl.style.setProperty("--hp-ratio", String(ratio));
  if (lockBtn) {
    const locked = live.locked === undefined ? true : !!live.locked;
    lockBtn.dataset.locked = locked ? "true" : "false";
    lockBtn.title = locked
      ? "Locked: HP details hidden from players outside combat. Click to unlock for full visibility."
      : "Unlocked: HP / AC fully visible to all. Click to lock and gate visibility on combat.";
  }
}

async function refresh(): Promise<void> {
  if (!itemId) return;
  try {
    live = await readBubbles(itemId);
  } catch {
    live = {};
  }
  paint();
}

async function commit(inp: HTMLInputElement): Promise<void> {
  if (!itemId) return;
  const field = inp.dataset.field as keyof BubblesData;
  const cur = (live[field] as number | undefined) ?? 0;
  const parsed = parseStatInput(inp.value, cur);
  if (parsed === null) {
    inp.value = fmt(cur);
    return;
  }
  const v = clampStat(field, parsed);
  const updated = await patchBubbles(itemId, { [field]: v } as Partial<BubblesData>);
  live = updated;
  paint();
}

for (const inp of inputs) {
  inp.addEventListener("focus", () => { inp.select(); });
  inp.addEventListener("blur", () => { void commit(inp); });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inp.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      const field = inp.dataset.field as keyof BubblesData;
      inp.value = fmt(live[field] as number | undefined);
      inp.blur();
    }
  });
}

bindPanelDrag(dragHandle, PANEL_IDS.hpBar);

window.addEventListener("contextmenu", (e) => e.preventDefault());

lockBtn?.addEventListener("click", async () => {
  if (!itemId || !isGM) return;
  const next = !(live.locked === undefined ? true : !!live.locked);
  const updated = await patchBubbles(itemId, { locked: next });
  live = updated;
  paint();
});

OBR.onReady(async () => {
  try {
    isGM = (await OBR.player.getRole()) === "GM";
  } catch {}
  if (!isGM) document.body.classList.add("is-player");
  await refresh();
  OBR.scene.items.onChange(() => { void refresh(); });
  OBR.player.onChange((p) => {
    const nextGM = p.role === "GM";
    if (nextGM !== isGM) {
      isGM = nextGM;
      document.body.classList.toggle("is-player", !isGM);
    }
  });
});
