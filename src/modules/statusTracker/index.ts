// Status Tracker — full-screen modal that shows every visible
// character on the current viewport, lets the DM drag buffs
// from a palette onto each token, and edits per-token consumable
// resources from a side panel.
//
// Tool integration:
//   - tool.createAction on the Select tool with shortcut "BracketRight"
//     (the `]` key) toggles the modal open/closed.
//
// On-token visualisation: see bubbles.ts.

import OBR, {
  Image,
  Item,
  isImage,
} from "@owlbear-rodeo/sdk";
import { assetUrl } from "../../asset-base";
import { IS_MOBILE } from "../../feature-flags";
import {
  PLUGIN_ID,
  STATUS_BUFFS_KEY,
  SCENE_BUFF_CATALOG_KEY,
  DEFAULT_BUFFS,
  BuffDef,
} from "./types";
import { syncTokenBuffs, readTokenBuffIds } from "./bubbles";

const MODAL_ID = "com.full-suite-en/status-tracker";
const MODAL_URL = assetUrl("status-tracker.html");
const TOOL_ID = "com.full-suite-en/status-tracker-tool";
const TOOL_ACTION_ID = "com.full-suite-en/status-tracker-toggle";
const SELECT_TOOL = "rodeo.owlbear.tool/select";
const MOVE_TOOL = "rodeo.owlbear.tool/move";
const ICON_URL = assetUrl("status-icon.svg");

// Tool the user was on when they activated the status tracker, so
// the `]` shortcut can return there instead of always falling back
// to the move tool.
let previousTool: string | null = null;

// LOCAL broadcast — the in-modal iframe asks us to refresh a token's
// buff bubbles on the canvas after the DM drags / drops in the modal.
const BC_REFRESH_TOKEN = `${PLUGIN_ID}/refresh-token`;
const BC_TOGGLE = `${PLUGIN_ID}/toggle`;

let isOpen = false;
const unsubs: Array<() => void> = [];

async function openModal(): Promise<void> {
  if (isOpen) return;
  try {
    await OBR.modal.open({
      id: MODAL_ID,
      url: MODAL_URL,
      fullScreen: true,
      hidePaper: true,
      hideBackdrop: false,
    });
    isOpen = true;
  } catch (e) {
    console.warn("[obr-suite/status] openModal failed", e);
  }
}

async function closeModal(): Promise<void> {
  try { await OBR.modal.close(MODAL_ID); } catch {}
  isOpen = false;
}

async function toggleModal(): Promise<void> {
  if (isOpen) await closeModal();
  else await openModal();
}

// Lookup a buff def by id, falling back to scene catalog if a
// custom buff was added by the DM and isn't in DEFAULT_BUFFS.
async function getCatalog(): Promise<BuffDef[]> {
  try {
    const meta = await OBR.scene.getMetadata();
    const v = meta[SCENE_BUFF_CATALOG_KEY] as unknown;
    if (Array.isArray(v)) {
      const out: BuffDef[] = [];
      for (const e of v) {
        if (e && typeof (e as any).id === "string") {
          out.push({
            id: (e as any).id,
            name: String((e as any).name ?? (e as any).id),
            color: String((e as any).color ?? "#ffffff"),
            group: typeof (e as any).group === "string" ? (e as any).group : undefined,
          });
        }
      }
      if (out.length) return out;
    }
  } catch {}
  return DEFAULT_BUFFS;
}

async function refreshTokenBuffs(tokenId: string): Promise<void> {
  try {
    const items = await OBR.scene.items.getItems([tokenId]);
    const token = items[0];
    if (!token || !isImage(token)) return;
    const buffIds = readTokenBuffIds(token);
    const cat = await getCatalog();
    const buffs = buffIds
      .map((id) => cat.find((b) => b.id === id))
      .filter((b): b is BuffDef => !!b);
    await syncTokenBuffs(token as Image, buffs);
  } catch (e) {
    console.warn("[obr-suite/status] refreshTokenBuffs failed", e);
  }
}

// Watch ALL tokens for metadata changes — when the buff list on
// any token changes, re-render its bubbles. This way buffs added
// by the modal AND buffs added via direct metadata writes both
// stay visible.
let lastBuffSnapshot = new Map<string, string>();
async function syncAllVisibleTokens(): Promise<void> {
  try {
    const items = await OBR.scene.items.getItems();
    const next = new Map<string, string>();
    for (const it of items) {
      if (!isImage(it)) continue;
      const ids = readTokenBuffIds(it);
      if (ids.length === 0) {
        if (lastBuffSnapshot.has(it.id)) {
          // Cleared — drop bubbles.
          await syncTokenBuffs(it as Image, []);
        }
        continue;
      }
      const key = ids.join("|");
      next.set(it.id, key);
      if (lastBuffSnapshot.get(it.id) === key) continue;
      const cat = await getCatalog();
      const buffs = ids
        .map((id) => cat.find((b) => b.id === id))
        .filter((b): b is BuffDef => !!b);
      await syncTokenBuffs(it as Image, buffs);
    }
    lastBuffSnapshot = next;
  } catch (e) {
    console.warn("[obr-suite/status] syncAllVisibleTokens failed", e);
  }
}

export async function setupStatusTracker(): Promise<void> {
  // Mobile clients skip setup entirely — palette + capture overlay
  // rely on heavy WebGL machinery that chokes on phone GPUs. The
  // background.ts yellow-warning notification covers user feedback.
  if (IS_MOBILE) {
    console.info("[status] mobile client — skipping setup");
    return;
  }

  // Toolbar tool — Bestiary-style toggle. Click the icon → activate
  // the tool → modal opens. Click any other tool → deactivate →
  // modal closes. No role filter — both GM and players see the
  // icon (item 4 in the 2026-05-04 user spec).
  try {
    await OBR.tool.create({
      id: TOOL_ID,
      icons: [
        {
          icon: ICON_URL,
          label: "Status Tracker",
        },
      ],
      onClick: async () => {
        await OBR.tool.activateTool(TOOL_ID);
        return false;
      },
    });
    // Passthrough mode — required for the tool to be selectable.
    await OBR.tool.createMode({
      id: `${TOOL_ID}/mode`,
      icons: [
        {
          icon: ICON_URL,
          label: "Status Tracker",
          filter: { activeTools: [TOOL_ID] },
        },
      ],
      cursors: [{ cursor: "default" }],
    });
  } catch (e) {
    console.warn("[obr-suite/status] tool.create failed", e);
  }

  // Tool change → open / close the modal.
  unsubs.push(
    OBR.tool.onToolChange(async (activeId) => {
      if (activeId === TOOL_ID) {
        if (!isOpen) await openModal();
      } else {
        previousTool = activeId;
        if (isOpen) await closeModal();
      }
    }),
  );

  // `]` shortcut — toggles via the tool API so the active tool
  // stays in sync with the modal state.
  const performShortcutToggle = async (): Promise<void> => {
    try {
      const cur = await OBR.tool.getActiveTool();
      if (cur === TOOL_ID) {
        await OBR.tool.activateTool(previousTool ?? MOVE_TOOL);
      } else {
        previousTool = cur;
        await OBR.tool.activateTool(TOOL_ID);
      }
    } catch (e) {
      console.warn("[obr-suite/status] BracketRight toggle failed", e);
    }
  };
  try {
    await OBR.tool.createAction({
      id: TOOL_ACTION_ID,
      shortcut: "BracketRight",
      icons: [
        {
          icon: ICON_URL,
          label: "Status Tracker",
          filter: { activeTools: [SELECT_TOOL, TOOL_ID] },
        },
      ],
      onClick: performShortcutToggle,
    });
  } catch (e) {
    console.warn("[obr-suite/status] createAction failed", e);
  }

  // The modal iframe broadcasts these so we can react without it
  // owning OBR scene-write permissions on its own.
  unsubs.push(
    OBR.broadcast.onMessage(BC_REFRESH_TOKEN, (event) => {
      const tokenId = (event.data as any)?.tokenId as string | undefined;
      if (!tokenId) return;
      void refreshTokenBuffs(tokenId);
    }),
  );
  unsubs.push(
    OBR.broadcast.onMessage(BC_TOGGLE, () => { void toggleModal(); }),
  );

  // Background watch — keeps bubbles in sync with token metadata
  // even when the modal isn't open (other plugins or manual edits).
  unsubs.push(OBR.scene.items.onChange(() => { void syncAllVisibleTokens(); }));
  // Initial pass once the scene is ready.
  if (await OBR.scene.isReady()) {
    void syncAllVisibleTokens();
  }
  unsubs.push(
    OBR.scene.onReadyChange((ready) => {
      if (ready) void syncAllVisibleTokens();
      else lastBuffSnapshot.clear();
    }),
  );
}

export async function teardownStatusTracker(): Promise<void> {
  for (const u of unsubs.splice(0)) {
    try { u(); } catch {}
  }
  try { await OBR.tool.removeAction(TOOL_ACTION_ID); } catch {}
  try { await OBR.tool.removeMode(`${TOOL_ID}/mode`); } catch {}
  try { await OBR.tool.remove(TOOL_ID); } catch {}
  await closeModal();
}
