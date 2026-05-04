---
title: Full Suite
description: All-in-one TRPG extension bundling dice, initiative, bestiary, character cards, search, time stop, viewport sync, portals, HP / AC bubbles, and a status-tracker palette under one manifest. Brings your own SRD / homebrew JSON sources.
author: FullPeople
image: https://raw.githubusercontent.com/FullPeople/full-suite-en/main/docs/screenshots/hero.png
icon: https://obr.dnd.center/full-suite-en/exe_icon.png
tags:
  - dice
  - combat
  - tool
  - automation
manifest: https://obr.dnd.center/full-suite-en/manifest.json
learn-more: https://github.com/FullPeople/full-suite-en
---

# Full Suite

Full Suite is an all-in-one TRPG extension that ships **ten modules under a single manifest**. UI defaults to English; a CN | EN toggle in Settings + the announcement modal lets each player pick independently.

> **Bring-your-own data**: this build ships with **no built-in content library**. Bestiary + Global Search are inert until you configure at least one SRD or homebrew JSON source under Settings → Libraries. The library JSON schema follows the standard 5e SRD layout.

## Modules

- **Dice** — Expression-based rolls with advantage / disadvantage, max / min clamps, triggered rerolls, exploding bursts, repeat blocks, and freely nestable wrappers. Multi-target rolls, dark rolls, click-to-replay history, synthesised SFX plus dice / cartoon samples for impact.
- **Initiative Tracker** — Top-anchored horizontal initiative strip. Start combat, turn cycling, automatic camera focus on turn change, owner-aware roll & end-turn for player-owned tokens.
- **Bestiary** — Drag a monster onto the map → token spawned with HP/AC, optionally auto-joined to initiative. Auto-popup stat-block on selection. Right-click any token to bind / replace / unbind a monster reference; bubbles HP/AC/name rewrite on bind.
- **Character Cards** — Click-to-roll character sheets, in-place HP / AC / temp / hit-dice editing, JSON import / export (drag a JSON file onto the panel, or use the in-card Import button). Read-only example card included.
- **Global Search** — Top-right floating search input over the configured library. Hover to preview, click to pin.
- **Time Stop** — DM-only freeze of player canvas input with cinematic letterbox bars + scene-wide audio mute.
- **Sync Viewport** — Pan every player's camera to a chosen point or the selected token.
- **Portals** — Drag-circle scene portals with same-tag linking. Drop a token inside a portal to open a destination picker; tokens gather to the destination in a hex-spiral arrangement. Bypasses Dynamic Fog's light-source rejection during the teleport.
- **HP / AC Bubbles** — Compact HP bar + AC heater shield over every bound token. Combat-gated silhouette mode for hidden enemies. Acts as a drop-in replacement for the third-party Stat Bubbles plugin.
- **Status Tracker** — Bottom-right buff palette. Drag a buff pill onto a token to apply; drag onto another token to transfer; drag to empty space to remove. Curved-band bubbles render above each affected token. Includes a standalone HP-bar component popover for "lightweight" tokens with no monster / character-card binding.

## Mobile clients

Heavy modules (Status Tracker, Metadata Inspector, Character Card fullscreen panel, Global Search) auto-disable on mobile devices. Other clients in the same room get a yellow notification listing the disabled modules so the GM knows what the mobile player can't see.

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
Repeat             repeat(3, 1d20+5)      3 independent rows
Independent seg    adv(1d6) + adv(1d4)    two independent advantage rolls
Nested             adv(max(1d20, 10) + 5)
```

Both ASCII and full-width punctuation `（）` `，` are accepted.

## Inline-tag integration

Standard SRD-style inline tags — `{@dice}`, `{@damage}`, `{@hit}`, `{@d20}`, `{@chance}`, `{@scaledice}`, `{@scaledamage}`, `{@recharge}` — are click-to-roll wherever they appear (search previews, monster panels, character cards). Monster panels: left-click rolls openly; right-click opens a context menu (Roll / Dark Roll / Advantage / Disadvantage / Add to Tray).

## Configuring a library

The bestiary + global search modules are **inert until a library is configured**. Settings → Libraries → "+ Add library" → paste a base URL.

A library MUST serve, relative to its base URL:

```
search/index.json     ← entry list for the global search bar
data/<file>.json      ← stat-block / spell / item / class data
data/bestiary/<file>.json
data/class/index.json + data/class/class-<slug>.json
data/items-base.json  (optional, for weapon-property tooltips)
```

The exact JSON schema mirrors the standard 5e SRD layout. Plenty of homebrew packs ship in this shape; the suite is **renderer-only and bundles no rules content**.

## License

Released under [GNU GPL-3.0](https://github.com/FullPeople/full-suite-en/blob/main/LICENSE). Strong copyleft — view, modify, redistribute (including commercially); derivative works must keep GPL-3.0 and ship source.

The `bubbles` module derives from [Stat Bubbles for D&D](https://github.com/SeamusFinlayson/Bubbles-for-Owlbear-Rodeo) by Seamus Finlayson, also GPL-3.0.

D&D 5e content © Wizards of the Coast; this extension is a reference and play aid only and ships no rules content of its own.

## Support

- Source code: [github.com/FullPeople/full-suite-en](https://github.com/FullPeople/full-suite-en)
- Issues / feedback: <1763086701@qq.com>
- Self-hosted at [obr.dnd.center](https://obr.dnd.center) on Alibaba Cloud, with ongoing updates funded by Ko-fi backers.
