# Full Suite (EN)

[中文](./README.zh.md) · English

A third-party extension for [Owlbear Rodeo](https://owlbear.rodeo) that bundles ten modules under a single manifest.

> **EN variant**: this build ships with **no built-in content library** and **no localised fixtures**. It is intentionally neutral so DMs can plug in their own SRD / homebrew JSON sources. For the Chinese-community build (with built-in libraries + character-sheet templates), see the parent repo.

## Install

In an OBR room, click the ⊕ "Add Extension" button (top right) and paste:

```
https://obr.dnd.center/full-suite-en/manifest.json
```

UI defaults to English. A CN | EN toggle in Settings + the announcement modal lets each player pick independently.

## Modules

| Module | Description |
|---|---|
| Dice | Expression-based rolls, multi-target, history, replay, SFX, click-to-roll for `{@dice}` / `{@damage}` / `{@hit}` style inline tags. |
| Initiative | Top-anchored initiative strip. Start-combat, turn-change camera focus, owner-aware roll / end-turn. |
| Bestiary | Drag a monster onto the map → spawned token with HP/AC, optional auto-join initiative. Right-click bind / replace / unbind. **Requires a configured library** (Settings → Libraries). |
| Character Cards | Click-to-roll character sheets (load from JSON; `Import JSON` button inside the card). HP / AC / temp / hit dice editable in place. Read-only example card included. |
| Global Search | Top-right floating search input over a configured library. Hover-to-preview, click-to-pin. |
| Time Stop | DM-only freeze of player canvas input with cinematic letterbox bars + global mute. |
| Sync Viewport | Pan every player's camera to a chosen point or selected token. |
| Portals | Drag-circle scene portals with same-tag linking; bypasses Dynamic Fog's light-source rejection during teleport. |
| HP / AC Bubbles | Compact HP bar + AC heater shield over every bound token. Combat-gated silhouette mode for hidden enemies. Replaces the third-party Stat Bubbles plugin (which can be safely uninstalled). |
| Status Tracker | Buff palette → drag a status onto a token to apply. Drag onto another token = transfer; drag to empty space = remove. Includes the standalone HP-bar component popover for "lightweight" tokens with no monster / card binding. |

## Defaults that differ from the Chinese build

| | EN build | Chinese build |
|---|---|---|
| UI default language | **English** | Chinese |
| Announcement default language | **English** | Chinese |
| Built-in libraries | **None** (user must add) | kiwee mirror + partnered listing pre-installed |
| Character card source | **JSON only** (drag JSON onto panel, or use the `Import JSON` button inside the card) | JSON + xlsx pipeline |
| Default OFF modules | Vision / Fog (in design), Metadata Inspector (DM debug tool) | Same |
| Default ON modules | Status Tracker, HP / AC Bubbles, all others | Same |
| Mobile clients | Status Tracker + Metadata Inspector + Character Card panel + Global Search auto-disabled with a notification | Same |
| Stable / Dev channel split | Single production channel (`/full-suite-en/`) | Stable + dev channels |
| Scene-metadata namespace | `com.full-suite-en/*` | `com.obr-suite/*` (incompatible — don't run both in the same room) |

## Configuring a library

The bestiary + global search modules are **inert until a library is configured**. Settings → Libraries → "+ Add library" → paste a base URL.

A library MUST serve, relative to its base URL:

```
search/index.json     ← entry list for the global search bar
data/<file>.json      ← the actual stat-block / spell / item / class data
data/bestiary/<file>.json
data/class/index.json + data/class/class-<slug>.json
data/items-base.json  (for weapon-property tooltips)
```

The exact JSON schema mirrors the standard 5e SRD layout. Plenty of homebrew packs ship in this shape; the suite is renderer-only and does not bundle any rules content of its own.

For a single library you can also use `indexPath` to point at a custom search-index filename other than `search/index.json` (useful when a host serves multiple curated lists).

## Dice expression syntax

```
Basic              2d6 + 1d20 + 5
Advantage          adv(1d20)              roll twice, keep higher
Disadvantage       dis(1d20)              roll twice, keep lower
Elven Accuracy     adv(1d20, 2)           roll three times, keep highest
Floor              max(1d20, 10)          value not below 10
Ceiling            min(1d20, 15)          value not above 15
Triggered reroll   reset(1d20, 1)         reroll once when value equals 1
Burst              burst(2d6)             max-roll explodes; chain length 5
Same highlight     same(2d20)
Repeat             repeat(3, 1d20+5)      3 independent rows, each its own total
Independent seg    adv(1d6) + adv(1d4)    two independent advantage rolls
Nested             adv(max(1d20, 10) + 5)
```

Both ASCII and full-width punctuation `（）` `，` are accepted.

## Bestiary binding model

Each token stores a `com.bestiary/slug` metadata reference. The full monster data lives in scene metadata under `com.bestiary/monsters` as a shared lookup table (one entry per monster type).

- A token without a slug shows "Bind Monster" in its right-click menu.
- A token with a slug shows "Replace Monster" and "Unbind".
- Binding and replacement also rewrite the token's bubbles HP/AC, name and DEX modifier to match the new monster.

## Portal workflow

1. The DM activates the "Portal" tool from the left-rail toolbar.
2. Click and drag on the map: the click point becomes the centre, the drag distance becomes the radius.
3. On release, an edit panel opens for naming (e.g. "1F") and tagging (e.g. "001").
4. When a player drops a token inside a portal, a destination panel lists every same-tag portal in the scene.
5. Picking a destination gathers every selected token to it in a hex-spiral arrangement.

### Dynamic Fog compatibility

OBR's official Dynamic Fog extension blocks light-emitting tokens from entering fog regions by re-positioning them. To allow portal teleports through fog, this extension snapshots and removes the token's light metadata (any key whose value carries `attenuationRadius` or `sourceRadius`) immediately before the position update, then restores the original values 1:1 right after.

## Project layout

```
obr-suite-en/
├── public/manifest.json
├── src/
│   ├── background.ts
│   ├── cluster.ts
│   ├── settings.ts
│   ├── state.ts
│   └── modules/
│       ├── dice/
│       ├── initiative/
│       ├── bestiary/
│       ├── characterCards/
│       ├── search/
│       ├── portals/
│       ├── bubbles/
│       ├── statusTracker/
│       ├── hpBar/
│       ├── metadata-inspector/
│       ├── timeStop.ts
│       └── focus.ts
└── *.html (iframe entries)
```

Stack: TypeScript + Vite + Preact (initiative panel + character card fullscreen) + `@owlbear-rodeo/sdk` v3.x.

Cross-client state lives in scene metadata (`com.full-suite-en/state`); DM writes, players read.

Per-client preferences live in localStorage (cluster expanded, auto-popup toggles, dice SFX, dice history, bubble scale, etc.).

## License

[GNU General Public License v3.0](./LICENSE) — strong copyleft.

| | |
|---|---|
| ✓ | Free to view, modify, redistribute, including commercially |
| ✓ | Source must accompany any distribution |
| ✓ | Derivative works must keep GPL-3.0 license |
| ✓ | Original copyright notice (`Copyright (c) 2026 FullPeople`) preserved |

## Credits

- Dice icon: [flaticon](https://www.flaticon.com/) by [Freepik](https://www.flaticon.com/authors/freepik)
- Dice SFX: Sound Effect by [freesound_community](https://pixabay.com/users/freesound_community-46691455/) and ksjsbwuil from [Pixabay](https://pixabay.com/)
- D&D 5e content © Wizards of the Coast; this extension is a reference and play aid only and ships **no rules content** of its own.
- The `bubbles` module is derived from [Stat Bubbles for D&D](https://github.com/SeamusFinlayson/Bubbles-for-Owlbear-Rodeo) by Seamus Finlayson, also under GPL-3.0.

## Support

[![Ko-fi](https://img.shields.io/badge/Ko--fi-FullPeople-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/fullpeople)

## Contact

- Email: [1763086701@qq.com](mailto:1763086701@qq.com)
- GitHub: [@FullPeople](https://github.com/FullPeople)
