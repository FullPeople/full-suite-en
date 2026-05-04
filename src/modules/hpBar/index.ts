// Standalone HP bar module — EN version.
//
// Right-click context menu adds a per-token "hp-bar-enabled" flag,
// but ONLY for tokens that have neither a bestiary binding nor a
// character-card binding (since both of those already render their
// own HP/AC editors via their own info popovers). When such a flagged
// token is selected, a draggable mini-popover appears showing the
// same HP/Temp/AC pills as the bestiary info popover — editing in
// the popover writes to the bubbles metadata key, so all three
// views (popover, on-token bar, bubbles plugin) stay in sync.

import OBR from "@owlbear-rodeo/sdk";
import { assetUrl } from "../../asset-base";
import { onViewportResize } from "../../utils/viewportAnchor";
import {
  PANEL_IDS,
  getPanelOffset,
  registerPanelBbox,
  BC_PANEL_DRAG_END,
  BC_PANEL_RESET,
  type DragEndPayload,
} from "../../utils/panelLayout";

const PLUGIN_ID = "com.full-suite-en/hp-bar";
const POPOVER_ID = `${PLUGIN_ID}/popover`;
const POPOVER_URL = assetUrl("hp-bar.html");

// Per-token metadata key — when present (any truthy value), the
// right-click menu shows "remove HP bar" instead of "add", and
// selecting the token auto-pops the bar.
export const HP_BAR_FLAG_KEY = `${PLUGIN_ID}/enabled`;

// Bindings we mutually exclude with — both have their own info
// popover that already includes an HP editor.
const BESTIARY_SLUG_KEY = "com.bestiary/slug";
const CC_BIND_KEY = "com.character-cards/boundCardId";

// Bubbles plugin's metadata key. The HP bar component is now tied
// to this — selecting any token that already has bubbles + no
// other binding auto-enables the HP bar component on the fly.
const BUBBLES_META_KEY = "com.owlbear-rodeo-bubbles-extension/metadata";

const CTX_ADD = "com.full-suite-en/hp-bar-add";
const CTX_REMOVE = "com.full-suite-en/hp-bar-remove";

const POPOVER_W = 250;
const POPOVER_H = 56;
const RIGHT_OFFSET = 20;
const TOP_OFFSET = 100;

const unsubs: Array<() => void> = [];
let popoverOpen = false;
let currentItemId: string | null = null;

async function popoverAnchor(): Promise<{ left: number; top: number }> {
  let vw = 1280, vh = 720;
  try { vw = await OBR.viewport.getWidth(); } catch {}
  try { vh = await OBR.viewport.getHeight(); } catch {}
  const off = getPanelOffset(PANEL_IDS.hpBar);
  const baseLeft = vw - POPOVER_W - RIGHT_OFFSET;
  const baseTop = TOP_OFFSET;
  const left = Math.min(Math.max(8, baseLeft + off.dx), vw - POPOVER_W - 8);
  const top = Math.min(Math.max(8, baseTop + off.dy), vh - POPOVER_H - 8);
  return { left, top };
}

async function openPopoverFor(itemId: string): Promise<void> {
  if (popoverOpen && currentItemId === itemId) return;
  if (popoverOpen && currentItemId !== itemId) {
    await closePopover();
  }
  currentItemId = itemId;
  const anchor = await popoverAnchor();
  try {
    await OBR.popover.open({
      id: POPOVER_ID,
      url: `${POPOVER_URL}?itemId=${encodeURIComponent(itemId)}`,
      width: POPOVER_W,
      height: POPOVER_H,
      anchorReference: "POSITION",
      anchorPosition: anchor,
      anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
      transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
      hidePaper: true,
      disableClickAway: true,
    });
    popoverOpen = true;
  } catch (e) {
    console.warn("[hp-bar] open failed", e);
    popoverOpen = false;
    currentItemId = null;
  }
}

async function closePopover(): Promise<void> {
  if (!popoverOpen) return;
  popoverOpen = false;
  currentItemId = null;
  try { await OBR.popover.close(POPOVER_ID); } catch {}
}

function hasBubblesMetadata(item: any): boolean {
  const m = (item?.metadata || {})[BUBBLES_META_KEY];
  if (!m || typeof m !== "object") return false;
  const r = m as Record<string, unknown>;
  return r["health"] != null
    || r["max health"] != null
    || r["temporary health"] != null
    || r["armor class"] != null;
}

async function handleSelection(selection: string[] | undefined): Promise<void> {
  if (!selection || selection.length !== 1) {
    if (popoverOpen) await closePopover();
    return;
  }
  const id = selection[0];
  let item: any = null;
  try {
    const items = await OBR.scene.items.getItems([id]);
    item = items[0];
  } catch {}
  if (!item) {
    if (popoverOpen) await closePopover();
    return;
  }
  if (item.type !== "IMAGE") {
    if (popoverOpen) await closePopover();
    return;
  }
  const meta = (item.metadata || {}) as Record<string, unknown>;
  // Defer to bestiary / character-card popovers ONLY when their
  // own auto-popup is enabled. When the user has disabled either
  // auto-popup the standalone HP bar takes over so the user still
  // gets a quick HP/AC editor.
  if (meta[BESTIARY_SLUG_KEY] != null) {
    if (isBestiaryAutoPopupOn()) {
      if (popoverOpen) await closePopover();
      return;
    }
  }
  if (meta[CC_BIND_KEY] != null) {
    if (isCcAutoPopupOn()) {
      if (popoverOpen) await closePopover();
      return;
    }
  }
  // Auto-add: token already has bubbles displayed (HP/AC) but no
  // HP_BAR_FLAG_KEY → set the flag and open the popover.
  if (!meta[HP_BAR_FLAG_KEY]) {
    if (!hasBubblesMetadata(item)) {
      if (popoverOpen) await closePopover();
      return;
    }
    try {
      await OBR.scene.items.updateItems([id], (drafts) => {
        for (const d of drafts) {
          (d.metadata as any)[HP_BAR_FLAG_KEY] = true;
        }
      });
    } catch (e) {
      console.warn("[hp-bar] auto-add flag failed", e);
    }
  }
  await openPopoverFor(id);
}

function isBestiaryAutoPopupOn(): boolean {
  try { return localStorage.getItem("com.bestiary/auto-popup") !== "0"; }
  catch { return true; }
}
function isCcAutoPopupOn(): boolean {
  try { return localStorage.getItem("character-cards/auto-info") !== "0"; }
  catch { return true; }
}

export async function setupHpBar(): Promise<void> {
  registerPanelBbox(PANEL_IDS.hpBar, async () => {
    if (!popoverOpen) return null;
    const { left, top } = await popoverAnchor();
    return { left, top, width: POPOVER_W, height: POPOVER_H };
  });

  try {
    await OBR.contextMenu.create({
      id: CTX_ADD,
      icons: [
        {
          icon: assetUrl("status-icon.svg"),
          label: "Add HP Bar",
          filter: {
            every: [
              { key: "type", value: "IMAGE" },
              { key: ["metadata", BESTIARY_SLUG_KEY], value: undefined },
              { key: ["metadata", CC_BIND_KEY], value: undefined },
              { key: ["metadata", HP_BAR_FLAG_KEY], value: undefined },
            ],
            max: 1,
          },
        },
      ],
      onClick: async (ctx) => {
        const id = ctx.items[0]?.id;
        if (!id) return;
        try {
          await OBR.scene.items.updateItems([id], (drafts) => {
            for (const d of drafts) {
              (d.metadata as any)[HP_BAR_FLAG_KEY] = true;
            }
          });
          try {
            const sel = await OBR.player.getSelection();
            await handleSelection(sel);
          } catch {}
        } catch (e) {
          console.error("[hp-bar] add failed", e);
        }
      },
    });
    await OBR.contextMenu.create({
      id: CTX_REMOVE,
      icons: [
        {
          icon: assetUrl("status-icon.svg"),
          label: "Remove HP Bar",
          filter: {
            every: [
              { key: "type", value: "IMAGE" },
              { key: ["metadata", HP_BAR_FLAG_KEY], operator: "!=", value: undefined },
            ],
            max: 1,
          },
        },
      ],
      onClick: async (ctx) => {
        const id = ctx.items[0]?.id;
        if (!id) return;
        try {
          await OBR.scene.items.updateItems([id], (drafts) => {
            for (const d of drafts) {
              delete (d.metadata as any)[HP_BAR_FLAG_KEY];
            }
          });
          if (popoverOpen && currentItemId === id) await closePopover();
        } catch (e) {
          console.error("[hp-bar] remove failed", e);
        }
      },
    });
  } catch (e) {
    console.warn("[hp-bar] context menu register failed", e);
  }

  unsubs.push(
    OBR.player.onChange(async (player) => {
      try { await handleSelection(player.selection); } catch {}
    }),
  );
  unsubs.push(
    OBR.scene.items.onChange(async () => {
      try {
        const sel = await OBR.player.getSelection();
        await handleSelection(sel);
      } catch {}
    }),
  );
  unsubs.push(
    OBR.scene.onReadyChange(async (ready) => {
      if (!ready) await closePopover();
      else {
        try {
          const sel = await OBR.player.getSelection();
          await handleSelection(sel);
        } catch {}
      }
    }),
  );

  try {
    const sel = await OBR.player.getSelection();
    await handleSelection(sel);
  } catch {}

  unsubs.push(
    onViewportResize(async () => {
      if (popoverOpen && currentItemId) {
        const id = currentItemId;
        popoverOpen = false;
        currentItemId = null;
        await openPopoverFor(id);
      }
    }),
  );
  unsubs.push(
    OBR.broadcast.onMessage(BC_PANEL_DRAG_END, async (event) => {
      const payload = event.data as DragEndPayload | undefined;
      if (payload?.panelId !== PANEL_IDS.hpBar) return;
      if (popoverOpen && currentItemId) {
        const id = currentItemId;
        popoverOpen = false;
        currentItemId = null;
        await openPopoverFor(id);
      }
    }),
  );
  unsubs.push(
    OBR.broadcast.onMessage(BC_PANEL_RESET, async () => {
      if (popoverOpen && currentItemId) {
        const id = currentItemId;
        popoverOpen = false;
        currentItemId = null;
        await openPopoverFor(id);
      }
    }),
  );
}

export async function teardownHpBar(): Promise<void> {
  for (const u of unsubs.splice(0)) {
    try { u(); } catch {}
  }
  try { await OBR.contextMenu.remove(CTX_ADD); } catch {}
  try { await OBR.contextMenu.remove(CTX_REMOVE); } catch {}
  await closePopover();
}
