import { render } from "preact";
import { useEffect, useState, useMemo, useCallback } from "preact/hooks";
import { fireQuickRoll } from "../dice/tags";
import { subscribeToSfx } from "../dice/sfx-broadcast";
import { getLocalLang } from "../../state";

// Per-client UI language. The character-card iframe re-reads this on
// load (changing language requires reopening the panel for now —
// keeps the JSX render path simple). Top-level button labels, tab
// names, and ability labels switch via this; deeper section text
// (skill rows, weapon stats, spell tooltips) is still bilingual-
// friendly Chinese for now since translating every leaf would be a
// huge churn — file a follow-up if a player flags it.
const lang: "zh" | "en" = (getLocalLang() === "en" ? "en" : "zh");
function tt(zhText: string, enText: string): string {
  return lang === "en" ? enText : zhText;
}

// ============================================================
// Full-screen character card v2 — data-driven Preact renderer
// ============================================================
//
// Replaces the legacy server-rendered Jinja2 HTML iframe (which was
// hard to wire to live data). This component:
//
//   1. Reads /characters/<roomId>/<cardId>/data.json directly.
//   2. Renders every section the parser produces — identity, stats,
//      abilities + skills, defenses, combat (weapons/armor),
//      spellcasting (slots + spells with tooltip details), features
//      (class/race/feats/special abilities/wondrous items), background
//      story blocks, inventory (currency + encumbrance + items).
//   3. Inline-edits HP/temp HP/AC via local in-memory state and a
//      future-friendly onPatch hook (server PUT path is hooked but
//      stubbed for tonight's iteration).
//   4. Export → downloads the current data.json. Import → uploads a
//      JSON file and replaces the local cache (server persistence
//      pending a /api/character/<room>/<card>/data PUT endpoint).
//
// Palette matches the rest of the suite (cluster, settings, dice
// panel) — dark navy charcoal canvas, signature amber #f5a623 for
// character names + section headers, warm gold for stat values,
// soft red for HP, muted teal for saves, sky blue for clickable
// affordances (used sparingly). Reads as "more suite", not a
// third-party widget.

const SERVER_ORIGIN = "https://obr.dnd.center";

// ===== Types ================================================
interface CharacterData {
  schema_version?: string;
  meta?: any;
  identity?: any;
  classes?: any[];
  total_level?: number;
  abilities?: Record<string, any>;
  core_stats?: any;
  defenses?: any;
  skills?: any[];
  combat?: any;
  spellcasting?: any;
  features?: any;
  background?: any;
  inventory?: any;
  exports?: any;
}

// ===== Const tables ==========================================
const ABL_ORDER = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABL_LABEL: Record<string, string> = lang === "en"
  ? { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" }
  : { str: "力量", dex: "敏捷", con: "体质", int: "智力", wis: "感知", cha: "魅力" };
const ABL_ABBR: Record<string, string> = lang === "en"
  ? { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" }
  : { str: "力", dex: "敏", con: "体", int: "智", wis: "感", cha: "魅" };

type TabKey = "overview" | "combat" | "spells" | "features" | "inventory" | "background";

const TABS: { key: TabKey; label: string }[] = lang === "en"
  ? [
      { key: "overview",   label: "Overview" },
      { key: "combat",     label: "Combat" },
      { key: "spells",     label: "Spells" },
      { key: "features",   label: "Features" },
      { key: "inventory",  label: "Inventory" },
      { key: "background", label: "Background" },
    ]
  : [
      { key: "overview",   label: "概览" },
      { key: "combat",     label: "战斗" },
      { key: "spells",     label: "法术" },
      { key: "features",   label: "特性" },
      { key: "inventory",  label: "装备" },
      { key: "background", label: "背景" },
    ];

// ===== Helpers ===============================================
function fmtMod(n: unknown): string {
  if (typeof n !== "number") return "?";
  return n >= 0 ? `+${n}` : `${n}`;
}
function getQS(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}
function downloadJson(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== Subcomponents =========================================
function Header({ data, onExport, onImport, onRefresh, readOnly }: {
  data: CharacterData;
  onExport: () => void;
  onImport: () => void;
  onRefresh: () => void;
  /** EN variant: example-card mode hides Import + Refresh and shows
   *  a "Read-only example" badge. Export still works so users can
   *  take a modifiable copy. */
  readOnly?: boolean;
}) {
  const id = data.identity || {};
  const cs = data.core_stats || {};
  const name = id.display_name || id.character_name || tt("未命名", "Unnamed");
  const englishName = id.character_name && id.display_name && id.character_name !== id.display_name
    ? id.character_name : null;

  const cls = (data.classes || [])
    .filter((c) => c?.name)
    .map((c) => `${c.name}${c.subclass ? `（${c.subclass}）` : ""}${c.level ? ` Lv${c.level}` : ""}`)
    .join(" / ") || "—";

  const race = [id.race?.name, id.race?.subrace].filter(Boolean).join("·") || "—";
  const totalLv = data.total_level != null ? data.total_level : "?";

  return (
    <div class="cc-head">
      <div class="cc-head-left">
        <div class="cc-head-name">
          {name}
          {englishName && <span class="en">{englishName}</span>}
        </div>
        <div class="cc-head-meta">
          <span class="pip"><b>{race}</b></span>
          <span class="pip"><b>{cls}</b></span>
          <span class="pip">{tt("总等级", "Total Level")} <b>{totalLv}</b></span>
          {id.alignment && <span class="pip">{tt("阵营", "Alignment")} <b>{id.alignment}</b></span>}
          {cs.size && <span class="pip">{tt("体型", "Size")} <b>{cs.size}</b></span>}
          {id.faith && <span class="pip">{tt("信仰", "Faith")} <b>{id.faith}</b></span>}
        </div>
      </div>
      <div class="cc-head-right">
        {readOnly && (
          <span class="pip" style="background:rgba(245,166,35,0.18);color:#f0b94a;border:1px solid rgba(245,166,35,0.45);font-weight:700;letter-spacing:0.4px">
            {tt("只读示例", "READ-ONLY EXAMPLE")}
          </span>
        )}
        {!readOnly && (
          <button class="cc-btn" onClick={onRefresh} title={tt("重新拉取服务器上的最新数据", "Re-fetch the latest data from the server")}>
            <span class="ic">↻</span>{tt("刷新", "Refresh")}
          </button>
        )}
        <button
          class="cc-btn primary"
          onClick={onExport}
          title={readOnly
            ? tt("把这张示例卡导出为 JSON，编辑后可作为你自己的卡导入", "Export this example as a JSON file you can edit and re-import as your own card.")
            : tt("把当前角色卡数据导出为 JSON 文件", "Export the current character card as a JSON file")}
        >
          <span class="ic">⬇</span>{readOnly ? tt("导出为我的卡", "Export as my card") : tt("导出 JSON", "Export JSON")}
        </button>
        {!readOnly && (
          <button class="cc-btn" onClick={onImport} title={tt("从 JSON 文件加载角色卡（仅本地预览，未保存到服务器）", "Load a character card from a JSON file (local preview only, not yet saved to server)")}>
            <span class="ic">⬆</span>{tt("导入 JSON", "Import JSON")}
          </button>
        )}
      </div>
    </div>
  );
}

function StatsBanner({
  data, onPatch,
}: {
  data: CharacterData;
  onPatch: (patch: Partial<CharacterData>) => void;
}) {
  const cs = data.core_stats || {};
  const hp = cs.hp || {};
  const hd = cs.hit_dice || {};

  const setHp = (which: "current" | "max" | "temp", val: string) => {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n)) return;
    const next = { ...hp, [which]: n };
    onPatch({ core_stats: { ...cs, hp: next } });
  };
  const setAc = (val: string) => {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n)) return;
    onPatch({ core_stats: { ...cs, ac: n } });
  };
  const setHdCur = (val: string) => {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n)) return;
    onPatch({ core_stats: { ...cs, hit_dice: { ...hd, current: n } } });
  };

  return (
    <div class="cc-stats">
      <div class="stat-cell hp">
        <div class="stat-cell-label">HP</div>
        <div class="stat-cell-val">
          <input class="stat-input big"
            value={hp.current ?? 0}
            onChange={(e: any) => setHp("current", e.target.value)} />
          <span class="slash">/</span>
          <input class="stat-input small"
            value={hp.max ?? 0}
            onChange={(e: any) => setHp("max", e.target.value)} />
        </div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell-label">{tt("临时", "Temp")}</div>
        <div class="stat-cell-val">
          <input class="stat-input big"
            value={hp.temp ?? 0}
            onChange={(e: any) => setHp("temp", e.target.value)} />
        </div>
      </div>
      <div class="stat-cell ac">
        <div class="stat-cell-label">AC</div>
        <div class="stat-cell-val">
          <input class="stat-input big"
            value={cs.ac ?? 10}
            onChange={(e: any) => setAc(e.target.value)} />
        </div>
      </div>
      <div class="stat-cell init">
        <div class="stat-cell-label">{tt("先攻", "Init")}</div>
        <div class="stat-cell-val">
          <span class="big">{fmtMod(cs.initiative)}</span>
        </div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell-label">{tt("速度", "Speed")}</div>
        <div class="stat-cell-val">
          <span class="big">{cs.speed ?? "?"}</span>
          <span class="unit">{tt("尺", "ft")}</span>
        </div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell-label">{tt("被察", "Passive")}</div>
        <div class="stat-cell-val">
          <span class="big">{cs.passive_perception ?? "?"}</span>
        </div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell-label">{tt("熟练", "Prof")}</div>
        <div class="stat-cell-val">
          <span class="big">{fmtMod(cs.proficiency_bonus)}</span>
        </div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell-label">{tt("生命骰", "Hit Dice")}</div>
        <div class="stat-cell-val">
          <input class="stat-input big" value={hd.current ?? 0}
            onChange={(e: any) => setHdCur(e.target.value)} />
          <span class="slash">/</span>
          <span class="small">{hd.max ?? "?"}{hd.die_size ?? ""}</span>
        </div>
      </div>
    </div>
  );
}

function rollExpr(label: string, expr: string, advMode?: "adv" | "dis") {
  if (!expr) return;
  fireQuickRoll({ expression: expr, label, advMode }).catch(() => {});
}

function AbilitiesAndSkills({ data }: { data: CharacterData }) {
  const ab = data.abilities || {};
  const cs = data.core_stats || {};
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const skBy: Record<string, any[]> = {};
  for (const s of skills) (skBy[s.ability] ??= []).push(s);

  return (
    <div class="sec">
      <div class="sec-h">
        <span class="sec-h-title">{tt("属性 · 豁免 · 技能", "Abilities · Saves · Skills")}</span>
      </div>
      <div class="sec-body">
        <div class="abl-grid">
          {ABL_ORDER.map((k) => {
            const a = ab[k] || {};
            const mod = typeof a.modifier === "number" ? a.modifier : 0;
            const profBonus = cs.proficiency_bonus ?? 0;
            const saveBonus = typeof a.save?.bonus === "number"
              ? a.save.bonus
              : (a.save?.proficient ? mod + profBonus : mod);
            const aExpr = `1d20${mod >= 0 ? "+" : ""}${mod}`;
            const sExpr = `1d20${saveBonus >= 0 ? "+" : ""}${saveBonus}`;
            return (
              <div class="abl">
                <div class="abl-name">{ABL_LABEL[k]}</div>
                <div class="abl-total">{a.total ?? "?"}</div>
                <div class="abl-mod"
                  onClick={() => rollExpr(tt(`${ABL_LABEL[k]}检定`, `${ABL_LABEL[k]} check`), aExpr)}
                  onContextMenu={(e: any) => { e.preventDefault(); rollExpr(tt(`${ABL_LABEL[k]}检定（优势）`, `${ABL_LABEL[k]} check (adv)`), aExpr, "adv"); }}
                  title={tt(`${ABL_LABEL[k]}检定 ${aExpr}\n（左键投，右键优势）`, `${ABL_LABEL[k]} check ${aExpr}\n(left-click roll, right-click advantage)`)}>
                  {fmtMod(a.modifier)}
                </div>
                <div class={`abl-save ${a.save?.proficient ? "is-prof" : ""}`}
                  onClick={() => rollExpr(tt(`${ABL_LABEL[k]}豁免`, `${ABL_LABEL[k]} save`), sExpr)}
                  title={tt(`${ABL_LABEL[k]}豁免 ${sExpr}`, `${ABL_LABEL[k]} save ${sExpr}`)}>
                  {tt("豁免", "Save")} <b>{fmtMod(saveBonus)}</b>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "12px" }}>
          <div class="sk-list">
            {ABL_ORDER.flatMap((k) =>
              (skBy[k] || []).map((s) => {
                const total = typeof s.total === "number" ? s.total : 0;
                const expr = `1d20${total >= 0 ? "+" : ""}${total}`;
                const cls = s.proficiency === "expertise" ? "exp" : s.proficiency === "proficient" ? "prof" : "";
                return (
                  <div class={`sk ${cls}`}
                    onClick={() => rollExpr(tt(`${s.name}检定`, `${s.name} check`), expr)}
                    onContextMenu={(e: any) => { e.preventDefault(); rollExpr(tt(`${s.name}检定（优势）`, `${s.name} check (adv)`), expr, "adv"); }}
                    title={tt(`${s.name}检定 ${expr}\n（左键投，右键优势）`, `${s.name} check ${expr}\n(left-click roll, right-click advantage)`)}>
                    <span class="sk-prof">{cls === "exp" ? "★" : cls === "prof" ? "●" : "○"}</span>
                    <span class="sk-name">{s.name}</span>
                    <span class="sk-abil">{ABL_ABBR[s.ability] || ""}</span>
                    <span class="sk-val">{fmtMod(s.total)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Defenses({ data }: { data: CharacterData }) {
  const d = data.defenses || {};
  const id = data.identity || {};
  const langs: string[] = Array.isArray(id.languages) ? id.languages : [];
  const tools: string[] = Array.isArray(id.tool_proficiencies) ? id.tool_proficiencies : [];

  const empty = !d.resistances?.length && !d.immunities?.length && !d.advantages?.length && !d.disadvantages?.length;
  if (empty && !langs.length && !tools.length) return null;

  return (
    <div class="sec">
      <div class="sec-h"><span class="sec-h-title">{tt("防御 · 语言 · 工具", "Defenses · Languages · Tools")}</span></div>
      <div class="sec-body">
        {!!d.resistances?.length && (
          <div class="def-row">
            <span class="def-label">{tt("抗性", "Resist")}</span>
            {d.resistances.map((x: string) => <span class="def-tag res">{x}</span>)}
          </div>
        )}
        {!!d.immunities?.length && (
          <div class="def-row">
            <span class="def-label">{tt("免疫", "Immune")}</span>
            {d.immunities.map((x: string) => <span class="def-tag imm">{x}</span>)}
          </div>
        )}
        {!!d.advantages?.length && (
          <div class="def-row">
            <span class="def-label">{tt("优势", "Advantage")}</span>
            {d.advantages.map((x: string) => <span class="def-tag adv">{x}</span>)}
          </div>
        )}
        {!!d.disadvantages?.length && (
          <div class="def-row">
            <span class="def-label">{tt("劣势", "Disadvantage")}</span>
            {d.disadvantages.map((x: string) => <span class="def-tag dis">{x}</span>)}
          </div>
        )}
        {!!langs.length && (
          <div class="def-row">
            <span class="def-label">{tt("语言", "Languages")}</span>
            {langs.map((x) => <span class="def-tag">{x}</span>)}
          </div>
        )}
        {!!tools.length && (
          <div class="def-row">
            <span class="def-label">{tt("工具", "Tools")}</span>
            {tools.map((x) => <span class="def-tag">{x}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

function CombatSection({ data }: { data: CharacterData }) {
  const cb = data.combat || {};
  const armor = cb.armor || {};
  const shield = cb.shield || {};
  const weapons: any[] = Array.isArray(cb.weapons) ? cb.weapons : [];

  return (
    <div class="sec">
      <div class="sec-h">
        <span class="sec-h-title">{tt("战斗 · 武器 · 护甲", "Combat · Weapons · Armor")}</span>
      </div>
      <div class="sec-body dense">
        {(armor.name || armor.ac_base != null) && (
          <div class="weap" style={{ background: "rgba(138,111,63,0.06)" }}>
            <div class="weap-name">
              🛡 {armor.name || tt("护甲", "Armor")}
              {armor.equipped && <span class="weap-prof">{tt("已装备", "Equipped")}</span>}
              {armor.attuned && <span class="weap-prof">{tt("同调", "Attuned")}</span>}
            </div>
            <div class="weap-atk" title={tt("基础 AC + 敏捷上限", "Base AC + Dex cap")}>
              AC {armor.ac_base ?? "?"}
              {typeof armor.dex_bonus_cap === "number" && ` (+${tt("敏", "Dex")}≤${armor.dex_bonus_cap})`}
            </div>
            <div class="weap-dmg" style={{ visibility: "hidden" }}>—</div>
            {armor.weight != null && (
              <div class="weap-props">{tt(`重量 ${armor.weight} 磅`, `${armor.weight} lb`)}</div>
            )}
          </div>
        )}
        {shield.ac_bonus != null && (
          <div class="weap" style={{ background: "rgba(138,111,63,0.06)" }}>
            <div class="weap-name">⛨ {tt("盾牌", "Shield")}
              {shield.equipped && <span class="weap-prof">{tt("已装备", "Equipped")}</span>}
              {shield.attuned && <span class="weap-prof">{tt("同调", "Attuned")}</span>}
            </div>
            <div class="weap-atk">+{shield.ac_bonus} AC</div>
            <div class="weap-dmg" style={{ visibility: "hidden" }}>—</div>
          </div>
        )}
        {weapons.length === 0 && !armor.name && !shield.ac_bonus && (
          <div style={{ color: "var(--ink-mute)", fontStyle: "italic", padding: "8px" }}>
            {tt("暂未配置武器或护甲", "No weapons or armor configured yet")}
          </div>
        )}
        {weapons.map((w) => {
          const atkMatch = /([+-]?\d+)/.exec(String(w.attack_bonus ?? ""));
          const atkBn = atkMatch ? parseInt(atkMatch[1], 10) : 0;
          const atkExpr = `1d20${atkBn >= 0 ? "+" : ""}${atkBn}`;
          const dmgRaw = String(w.damage ?? "").replace(/\s+/g, "");
          const dmgMatch = /\d*d\d+([+-]\d+)?/.exec(dmgRaw);
          const dmgExpr = dmgMatch ? dmgMatch[0] : dmgRaw;
          return (
            <div class="weap">
              <div class="weap-name">
                ⚔ {w.name || "?"}
                {w.proficient && <span class="weap-prof">{tt("熟", "Prof")}</span>}
              </div>
              <div class="weap-atk"
                onClick={() => rollExpr(tt(`${w.name} 命中`, `${w.name} attack`), atkExpr)}
                onContextMenu={(e: any) => { e.preventDefault(); rollExpr(tt(`${w.name} 命中（优势）`, `${w.name} attack (adv)`), atkExpr, "adv"); }}
                title={tt(`左键投，右键优势 · ${atkExpr}`, `Left-click roll, right-click advantage · ${atkExpr}`)}>
                {w.attack_bonus || `${fmtMod(atkBn)}`}
              </div>
              <div class="weap-dmg"
                onClick={() => rollExpr(tt(`${w.name} 伤害${w.damage_type ? `(${w.damage_type})` : ""}`, `${w.name} damage${w.damage_type ? `(${w.damage_type})` : ""}`), dmgExpr)}
                title={`${w.damage} ${w.damage_type ?? ""}`}>
                {w.damage ?? "—"} {w.damage_type ? <span style={{ opacity: 0.7, fontSize: "10px" }}>{w.damage_type}</span> : ""}
              </div>
              {w.extra_damage && (
                <div class="weap-dmg weap-dmg-extra"
                  onClick={(e: any) => {
                    e.stopPropagation();
                    rollExpr(
                      tt(
                        `${w.name} 附加伤害${w.extra_damage_type ? `(${w.extra_damage_type})` : ""}`,
                        `${w.name} bonus damage${w.extra_damage_type ? `(${w.extra_damage_type})` : ""}`,
                      ),
                      String(w.extra_damage).replace(/\s+/g, ""),
                    );
                  }}
                  title={tt(`附加伤害骰 ${w.extra_damage}${w.extra_damage_type ? ` · ${w.extra_damage_type}` : ""}`, `Bonus damage die ${w.extra_damage}${w.extra_damage_type ? ` · ${w.extra_damage_type}` : ""}`)}>
                  +{w.extra_damage} {w.extra_damage_type ? <span style={{ opacity: 0.7, fontSize: "10px" }}>{w.extra_damage_type}</span> : ""}
                </div>
              )}
              {(w.properties || w.weight != null || w.ammo_type) && (
                <div class="weap-props">
                  {[
                    w.properties,
                    w.weight != null ? tt(`${w.weight}磅`, `${w.weight} lb`) : null,
                    w.ammo_type ? tt(`弹药:${w.ammo_type}`, `Ammo: ${w.ammo_type}`) : null,
                  ].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpellsSection({ data }: { data: CharacterData }) {
  const sp = data.spellcasting || {};
  const cs = data.core_stats || {};
  const slots = sp.spell_slots || {};
  const cantrips: any[] = Array.isArray(sp.cantrips_known) ? sp.cantrips_known : [];
  const always: any[] = Array.isArray(sp.always_known) ? sp.always_known : [];
  const prepared: any[] = Array.isArray(sp.prepared) ? sp.prepared : [];

  const [openSpell, setOpenSpell] = useState<string | null>(null);

  if (!cantrips.length && !always.length && !prepared.length && !sp.attack_bonus && !sp.save_dc) {
    return null;
  }

  // Group prepared by group number (1/2/3) — falls back to single
  // group when group field absent.
  const groups: Record<string, any[]> = {};
  for (const s of prepared) {
    const g = String(s.group ?? "1");
    (groups[g] ??= []).push(s);
  }

  const renderSpell = (s: any, idx: number, prefix: string) => {
    const key = `${prefix}-${idx}`;
    const isOpen = openSpell === key;
    return (
      <>
        <div class="spell"
          onClick={() => setOpenSpell(isOpen ? null : key)}
          title={tt("点击展开法术详情", "Click to expand spell details")}>
          <span class={`spell-lv ${(s.level ?? 0) === 0 ? "cantrip" : ""}`}>
            {(s.level ?? 0) === 0 ? tt("戏", "C") : tt(`${s.level}环`, `Lv${s.level}`)}
          </span>
          <span class="spell-name">{s.name}</span>
          {s.meta?.concentration && <span class="spell-tag conc">{tt("专注", "Conc")}</span>}
          {s.meta?.ritual && <span class="spell-tag ritual">{tt("仪式", "Ritual")}</span>}
        </div>
        {isOpen && s.description && (
          <div class="spell-detail">
            {s.meta && (
              <div class="meta">
                {s.meta.school && <span>{s.meta.school}</span>}
                {s.meta.casting_time && <span>{tt(`施法 ${s.meta.casting_time}`, `Casting ${s.meta.casting_time}`)}</span>}
                {s.meta.range && <span>{tt(`距离 ${s.meta.range}`, `Range ${s.meta.range}`)}</span>}
                {s.meta.components && <span>{s.meta.components}</span>}
                {s.meta.duration && <span>{tt(`持续 ${s.meta.duration}`, `Duration ${s.meta.duration}`)}</span>}
                {s.meta.source && <span>《{s.meta.source}》</span>}
              </div>
            )}
            {s.description}
          </div>
        )}
      </>
    );
  };

  return (
    <div class="sec">
      <div class="sec-h">
        <span class="sec-h-title">{tt("法术", "Spells")}</span>
        {(sp.spellcasting_ability || sp.save_dc) && (
          <span class="sec-h-meta">
            {sp.spellcasting_ability && tt(`关键属性: ${sp.spellcasting_ability}`, `Ability: ${sp.spellcasting_ability}`)}
            {sp.save_dc != null && tt(`  ·  豁免DC: ${sp.save_dc}`, `  ·  Save DC: ${sp.save_dc}`)}
            {sp.attack_bonus && tt(`  ·  攻击: ${sp.attack_bonus}`, `  ·  Attack: ${sp.attack_bonus}`)}
            {sp.max_prepared != null && tt(`  ·  最大准备: ${sp.max_prepared}`, `  ·  Max prepared: ${sp.max_prepared}`)}
          </span>
        )}
      </div>
      <div class="sec-body">
        {/* Spell slots */}
        <div class="spell-slots">
          {[1,2,3,4,5,6,7,8,9].map((lv) => {
            const s = slots[String(lv)];
            const has = s && (s.max ?? 0) > 0;
            return (
              <div class={`slot ${has ? "has-slots" : ""}`}>
                <div class="slot-lv">{tt(`${lv}环`, `Lv${lv}`)}</div>
                <div class="slot-cur">{has ? (s.current ?? 0) : "—"}</div>
                <div class="slot-max">{has ? `/${s.max}` : ""}</div>
              </div>
            );
          })}
        </div>

        {sp.sorcery_points && (
          <div style={{
            marginBottom: "10px", padding: "6px 10px",
            background: "var(--bg-soft)", border: "1px solid var(--gold-soft)",
            borderRadius: "5px", fontSize: "11.5px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ color: "var(--ink-dim)", fontWeight: 600 }}>{tt("术法点", "Sorcery Points")}</span>
            <span style={{ fontFamily: "Georgia,serif", color: "var(--gold)", fontWeight: 700, fontSize: "14px" }}>
              {sp.sorcery_points.current ?? 0} / {sp.sorcery_points.max ?? 0}
            </span>
          </div>
        )}

        {/* Cantrips */}
        {!!cantrips.length && (
          <div class="spell-group">
            <div class="spell-group-h">{tt("戏法", "Cantrips")}</div>
            {cantrips.map((s, i) => renderSpell(s, i, "cantrip"))}
          </div>
        )}

        {/* Always known */}
        {!!always.length && (
          <div class="spell-group">
            <div class="spell-group-h">{tt("始终准备", "Always Prepared")}</div>
            {always.map((s, i) => renderSpell(s, i, "always"))}
          </div>
        )}

        {/* Prepared groups */}
        {Object.entries(groups).map(([g, list]) => (
          <div class="spell-group">
            <div class="spell-group-h">{tt(`准备法术 · 组 ${g}`, `Prepared · Group ${g}`)}</div>
            {list.map((s, i) => renderSpell(s, i, `g${g}`))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureBlock({ title, items }: { title: string; items: any[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (!items?.length) return null;
  return (
    <div style={{ marginBottom: "10px" }}>
      <div class="spell-group-h" style={{ marginBottom: "6px" }}>{title}</div>
      {items.map((f, i) => {
        const isOpen = openIdx === i;
        return (
          <div class={`feat ${isOpen ? "is-open" : ""}`}>
            <div class="feat-h" onClick={() => setOpenIdx(isOpen ? null : i)}>
              <span class="feat-name">
                {f.name}
                {f.level != null && <span class="lv">Lv{f.level}</span>}
                {f.category && <span class="lv" style={{ borderColor: "var(--teal-soft)", color: "var(--teal)" }}>{f.category}</span>}
              </span>
              <span class="feat-toggle">▼</span>
            </div>
            {isOpen && f.description && <div class="feat-body">{f.description}</div>}
          </div>
        );
      })}
    </div>
  );
}

function FeaturesSection({ data }: { data: CharacterData }) {
  const f = data.features || {};
  const cls: any[] = Array.isArray(f.class_features) ? f.class_features : [];
  const race: any[] = Array.isArray(f.race_features) ? f.race_features : [];
  const feats: any[] = Array.isArray(f.feats) ? f.feats : [];
  // New schema fields (v0.3+, may not exist in older data):
  const fightingStyle: any[] = Array.isArray(f.fighting_style_feats) ? f.fighting_style_feats : [];
  const special: any[] = Array.isArray(f.special_abilities) ? f.special_abilities : [];

  if (!cls.length && !race.length && !feats.length && !fightingStyle.length && !special.length) return null;

  return (
    <div class="sec">
      <div class="sec-h"><span class="sec-h-title">{tt("特性 · 专长", "Features · Feats")}</span></div>
      <div class="sec-body">
        <FeatureBlock title={tt("职业特性", "Class Features")} items={cls} />
        <FeatureBlock title={tt("种族特性", "Race Features")} items={race} />
        <FeatureBlock title={tt("战斗风格", "Fighting Style")} items={fightingStyle} />
        <FeatureBlock title={tt("特殊能力", "Special Abilities")} items={special} />
        <FeatureBlock title={tt("专长", "Feats")} items={feats} />
      </div>
    </div>
  );
}

function BackgroundSection({ data }: { data: CharacterData }) {
  const bg = data.background || {};
  const id = data.identity || {};
  const blocks = [
    { label: tt("外貌", "Appearance"), body: bg.appearance },
    { label: tt("性格", "Personality"), body: bg.personality },
    { label: tt("特质", "Traits"), body: bg.traits },
    { label: tt("理念", "Ideals"), body: bg.ideals },
    { label: tt("羁绊", "Bonds"), body: bg.bonds },
    { label: tt("缺陷", "Flaws"), body: bg.flaws },
    { label: tt("故事", "Story"), body: bg.story },
    { label: tt("其他", "Other"), body: bg.description },
  ].filter((b) => b.body);

  return (
    <div class="sec">
      <div class="sec-h">
        <span class="sec-h-title">{tt("背景 · 个人", "Background · Personal")}</span>
        {bg.background_name && <span class="sec-h-meta">{tt(`背景：${bg.background_name}`, `Background: ${bg.background_name}`)}</span>}
      </div>
      <div class="sec-body">
        <dl class="kv" style={{ marginBottom: "12px" }}>
          {id.player && (<><dt>{tt("玩家", "Player")}</dt><dd>{id.player}</dd></>)}
          {id.gender && (<><dt>{tt("性别", "Gender")}</dt><dd>{id.gender}</dd></>)}
          {id.age != null && (<><dt>{tt("年龄", "Age")}</dt><dd>{id.age}</dd></>)}
          {id.height && (<><dt>{tt("身高", "Height")}</dt><dd>{id.height}</dd></>)}
          {id.weight && (<><dt>{tt("体重", "Weight")}</dt><dd>{id.weight}</dd></>)}
          {id.hometown && (<><dt>{tt("家乡", "Hometown")}</dt><dd>{id.hometown}</dd></>)}
        </dl>
        {!!blocks.length && (
          <div class="bio-grid">
            {blocks.map((b) => (
              <div class="bio-block">
                <div class="bio-block-h">{b.label}</div>
                <div class="bio-block-body">{b.body}</div>
              </div>
            ))}
          </div>
        )}
        {!blocks.length && (
          <div style={{ color: "var(--ink-mute)", fontStyle: "italic" }}>{tt("暂无背景信息", "No background info yet")}</div>
        )}
      </div>
    </div>
  );
}

function InventorySection({ data }: { data: CharacterData }) {
  const inv = data.inventory || {};
  const w = inv.currency?.wallet || {};
  const enc = inv.encumbrance || {};
  const items: any[] = Array.isArray(inv.items) ? inv.items : [];
  // Wondrous items (奇物) — new schema field, ships when present.
  const wondrous: any[] = Array.isArray(inv.wondrous_items) ? inv.wondrous_items : [];

  return (
    <div class="sec">
      <div class="sec-h">
        <span class="sec-h-title">{tt("装备 · 货币 · 负重", "Inventory · Currency · Encumbrance")}</span>
        {inv.currency?.total_gp_raw && <span class="sec-h-meta">总值 {inv.currency.total_gp_raw}</span>}
      </div>
      <div class="sec-body">
        <div class="coin-row">
          <div class="coin pp"><div class="coin-name">{tt("铂PP", "PP")}</div><div class="coin-val">{w.pp ?? 0}</div></div>
          <div class="coin gp"><div class="coin-name">{tt("金GP", "GP")}</div><div class="coin-val">{w.gp ?? 0}</div></div>
          <div class="coin ep"><div class="coin-name">{tt("银EP", "EP")}</div><div class="coin-val">{w.ep ?? 0}</div></div>
          <div class="coin sp"><div class="coin-name">{tt("铜SP", "SP")}</div><div class="coin-val">{w.sp ?? 0}</div></div>
          <div class="coin cp"><div class="coin-name">{tt("铜CP", "CP")}</div><div class="coin-val">{w.cp ?? 0}</div></div>
        </div>

        {(enc.equipment_weight != null || enc.total_weight != null) && (
          <div style={{ marginBottom: "10px" }}>
            <div class="bio-block-h" style={{ marginBottom: "5px" }}>{tt("负重", "Encumbrance")}</div>
            <div class="enc-bar">
              <div class="enc-cell">{tt("装备", "Equipped")} <div class="v">{enc.equipment_weight ?? 0}</div></div>
              <div class="enc-cell">{tt("背包", "Packs")} <div class="v">{(enc.pack1_weight ?? 0) + (enc.pack2_weight ?? 0)}</div></div>
              <div class="enc-cell">{tt("总计", "Total")} <div class="v">{enc.total_weight ?? 0}</div></div>
              <div class="enc-cell">{tt("上限", "Cap")} <div class="v">{enc.max_capacity ?? "?"}</div></div>
            </div>
          </div>
        )}

        {!!wondrous.length && (
          <FeatureBlock title={tt("奇物 / 魔法物品", "Wondrous Items / Magic Items")} items={wondrous} />
        )}

        {items.length === 0 && !wondrous.length && (
          <div style={{ color: "var(--ink-mute)", fontStyle: "italic", padding: "6px 0" }}>
            {tt(
              "（暂无背包细目，可在 xlsx 角色卡 \"背包1/2\" 表更新）",
              "(No pack items yet — fill them out in your character sheet)",
            )}
          </div>
        )}
        {!!items.length && (
          <div style={{ marginTop: "8px" }}>
            <div class="bio-block-h" style={{ marginBottom: "5px" }}>{tt("背包", "Pack")}</div>
            {items.map((it: any) => (
              <div class="weap">
                <div class="weap-name">{it.name || "?"}</div>
                <div class="weap-atk" style={{ visibility: "hidden" }}>—</div>
                <div class="weap-dmg" style={{ background: "transparent", border: "0", color: "var(--ink-dim)" }}>
                  {it.weight != null ? tt(`${it.weight} 磅`, `${it.weight} lb`) : ""} {it.location ? `· ${it.location}` : ""}
                </div>
                {it.description && <div class="weap-props">{it.description}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Main app ==============================================
function App() {
  const [data, setData] = useState<CharacterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const roomId = getQS("room") || "";
  const cardId = getQS("card") || "";
  // EN variant: when `?example=1` is set, this iframe loads the
  // static example JSON shipped with the plugin (no server). The
  // panel renders read-only — Import button is hidden, onPatch is
  // a no-op so users can't accidentally mutate the reference card.
  // Export JSON still works so users can take a copy as a starting
  // point.
  const exampleMode = getQS("example") === "1";

  const loadData = useCallback(async () => {
    if (exampleMode) {
      setError(null);
      try {
        // Path is relative to the plugin base URL (configured via
        // SUITE_BASE in vite.config.ts). The iframe is hosted at
        // /full-suite-en/cc-fullscreen.html so a relative fetch
        // resolves to /full-suite-en/example-character-card.json
        // automatically.
        const res = await fetch("./example-character-card.json", { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e: any) {
        setError(`Failed to load example: ${e?.message || String(e)}`);
      }
      return;
    }
    if (!roomId || !cardId) {
      setError(tt("URL 缺少 room 或 card 参数", "URL is missing room or card parameter"));
      return;
    }
    setError(null);
    try {
      const res = await fetch(
        `${SERVER_ORIGIN}/characters/${encodeURIComponent(roomId)}/${encodeURIComponent(cardId)}/data.json`,
        { cache: "no-cache" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(`加载失败：${e?.message || String(e)}`);
    }
  }, [roomId, cardId, exampleMode]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Patch handler — for now updates local state only. Future: PUT to
  // server when /api/character/<room>/<card>/data endpoint exists.
  // In example-mode it's a no-op so the reference card can't be
  // mutated by stat-edit clicks etc. (the in-place HP/AC editor
  // calls onPatch on commit).
  const onPatch = useCallback((patch: Partial<CharacterData>) => {
    if (exampleMode) return;
    setData((prev) => prev ? { ...prev, ...patch } : prev);
  }, [exampleMode]);

  const onExport = useCallback(() => {
    if (!data) return;
    const id = data.identity || {};
    const name = id.display_name || id.character_name || "character";
    const suffix = exampleMode ? "example" : cardId.slice(0, 6);
    downloadJson(`${name}-${suffix}.json`, data);
  }, [data, cardId, exampleMode]);

  const onImport = useCallback(() => {
    const inp = document.getElementById("ccFileInput") as HTMLInputElement | null;
    if (!inp) return;
    inp.value = "";
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || !("abilities" in parsed || "identity" in parsed)) {
          window.alert("JSON 不像是角色卡数据（缺少 identity / abilities 字段）");
          return;
        }
        // Update local state immediately for snappy UI feedback.
        setData(parsed);

        // Persist to server so other clients pick it up on their
        // next fetch / refresh. Falls back to local-only preview
        // when the PUT endpoint isn't available (e.g. older server
        // build that doesn't have /data PUT yet).
        try {
          const url = `${SERVER_ORIGIN}/api/character/${encodeURIComponent(roomId)}/${encodeURIComponent(cardId)}/data`;
          const res = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed),
          });
          if (!res.ok) {
            const body = await res.text();
            window.alert(
              `已加载本地 JSON。\n但保存到服务器失败（HTTP ${res.status}），仅本地预览：\n${body.slice(0, 200)}`,
            );
            return;
          }
          const result = await res.json();
          if (result.render_warning) {
            window.alert(
              `已保存到服务器，但旧版静态 HTML 渲染失败：${result.render_warning}\n（不影响新全屏面板查看）`,
            );
          } else {
            window.alert(`✓ 已保存为 ${result.name}\n其他客户端刷新后可看到。`);
          }
        } catch (e: any) {
          window.alert(
            `已加载本地 JSON。\n但保存到服务器失败，仅本地预览：${e?.message || String(e)}`,
          );
        }
      } catch (e: any) {
        window.alert(`导入失败：${e?.message || String(e)}`);
      }
    };
    inp.click();
  }, [roomId, cardId]);

  if (error) {
    return <div class="cc-error">{error}</div>;
  }
  if (!data) {
    return <div class="cc-loading">{tt("加载角色卡…", "Loading character card…")}</div>;
  }

  return (
    <>
      <Header data={data} onExport={onExport} onImport={onImport} onRefresh={loadData} readOnly={exampleMode} />
      <StatsBanner data={data} onPatch={onPatch} />
      <div class="cc-tabs">
        {TABS.map((t) => (
          <button class={`cc-tab ${tab === t.key ? "is-on" : ""}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div class="cc-body">
        {tab === "overview" && (
          <div class="cc-grid">
            <AbilitiesAndSkills data={data} />
            <div>
              <Defenses data={data} />
            </div>
          </div>
        )}
        {tab === "combat" && (
          <CombatSection data={data} />
        )}
        {tab === "spells" && (
          <SpellsSection data={data} />
        )}
        {tab === "features" && (
          <FeaturesSection data={data} />
        )}
        {tab === "inventory" && (
          <InventorySection data={data} />
        )}
        {tab === "background" && (
          <BackgroundSection data={data} />
        )}
      </div>
    </>
  );
}

const appEl = document.getElementById("app");
if (appEl) {
  // Subscribe to dice SFX broadcasts so click-to-roll plays sound
  // even though this iframe normally doesn't have audio context warmed.
  try { subscribeToSfx(); } catch {}
  render(<App />, appEl);
}
