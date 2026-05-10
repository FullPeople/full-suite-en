# DM Announcement

> Edit this file to change the in-app announcement modal contents for the
> **English (full-suite-en) build**. Each `## Title [kind]` block is one
> section. `kind` controls the rendering:
>   - `[warn]` red banner / `[info]` blue notice
>   - **A-block** `[issues]` bug / request table — per row
>     `type | severity | desc`. type ∈ `bug` / `feature` / `wip` / `done`.
>     severity ∈ `critical` / `high` / `medium` / `low` (optional).
>   - **B-block** `[highlights]` feature-spotlight cards — per row
>     `imageUrl | title | desc`. Image can be omitted (`title | desc` works).
>     Relative paths are resolved against the bundle base.
>   - **C-block** `[changelog]` version log — per row `version · description`.
>   - `[todo]` plain todo list (`desc | tag | size`) / `[footer]` sign-off.
>
> Inline: `**bold**`, `` `code` ``, plain emails auto-linked,
> `<span style="color:#hex">text</span>` for inline color.
>
> Deploy: `bash deploy-full-suite-en.sh`. The script copies this file to
> `obr-suite-en/public/announcement.md` at build time.
>
> Note: this is the **independent EN source**. The Chinese-community build
> uses `shared/announcement.md` (bilingual single-file). The two are
> deliberately separate so the EN cut can describe only the features that
> ship in `full-suite-en` (no World Pack, no 5etools mentions, etc.).

## Notice [info]

- Found a bug? Email me at 1763086701@qq.com.
- <span style="color:#5dade2">**The suite ships its own HP/AC bubbles**</span> — you can safely **disable** the third-party "Stat Bubbles for D&D" plugin; the built-in bubbles take over with a more unified look (silhouette mode for bestiary-bound enemies, locked/viewmode, threshold quantisation).
- Your support will be credited in the **contributors list** (link in **Settings**). It directly funds faster fixes and ongoing development!

## Highlights [highlights]

> Optional spotlight cards for new features. Each row: `imageUrl | title | desc`.
> Image relative to the bundle base; can be omitted.

- trickster-tool-icon.svg | Trickster Marker | New toolbar plugin. GM draws a hidden trigger circle on the map (players can't see it); when a target token drag-commits into the circle → <span style="color:#a06bd9">**auto-fire Time Stop + camera focus**</span> on the entering token. Perfect for ambush triggers / hidden traps. See Settings → Trickster Marker.
- circleimage-icon.svg | Circle Image / BG Remove | New toolbar plugin. Drop in a local image → <span style="color:#5dade2">**circular avatar crop**</span> (pan / zoom + custom-coloured rim ring) <span style="color:#5dade2">**or auto-strip white/black backgrounds**</span> (tolerance + feather) → upload to your OBR asset library → drag from there to the scene. Great for ad-hoc NPC portraits or making transparent-bg tokens out of character art.
- exe_icon.png | Click-to-search on character cards | Click any **spell / feature / feat** name on the full-screen character card → global search opens pre-filtered to the first match. No more manual copy-paste.
- Better fog / walls | maybe

## Sign-off [footer]

— 弗人 / FullPeople
