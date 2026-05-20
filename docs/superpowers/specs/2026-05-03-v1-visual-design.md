# Dofus level planner — V1 visual & interaction design

Status: design complete, awaiting user review before implementation planning.
Date: 2026-05-03.

## Concept

A single-page Vue 3 app where the user assembles a horizontal **timeline of equipment cards**. Each card represents the desired character state at a given level (class, level, all equipment slots). Cards are added to the timeline by clicking a "+" between existing cards, choosing either *Vide* (empty slots) or *Copier* (clone previous state).

Visual direction: **Vercel base** (dark `#000`/`#0a0a0a`, fine `#262626` borders, Geist/Inter typography, geometric layout) **fused with a Dofus accent layer** (mint `#5BD3A8` accent only, Bebas Neue uppercase display titles, soft cosmic radial-gradient background, hexagonal class logo frames). One universal mint accent — no class-specific colors.

## Stack

- Vite + Vue 3 `<script setup>`
- Pinia (timeline + active-card state)
- Tailwind (utility-first, custom theme tokens for the palette below)
- VueUse (`useDraggable`, `useElementSize`, `useEventListener`, etc.)
- Persistence: `localStorage`, a single build stored under one key (V1 = single build)
- Data: DofusDB API, client-side fetch, per-item-id cache in `localStorage`

## Color & typography tokens

| Token | Value | Use |
|---|---|---|
| `--bg-page` | `#050505` | App background base |
| `--bg-surface` | `#0a0a0a` | Cards, modals, sheet |
| `--bg-elev` | `#0f0f0f` | Hover surfaces, gradient header tops |
| `--bg-slot-empty` | `#0f0f0f` | Empty slot icon background |
| `--bg-slot-filled` | `#1f2937` | Filled slot icon background |
| `--border-default` | `#262626` | Standard borders |
| `--border-subtle` | `#1a1a1a` | Section dividers, modal headers |
| `--border-dashed-empty` | `#2a2a2a` | Dashed border for empty slots |
| `--accent` | `#5BD3A8` | Mint accent (universal — every class) |
| `--accent-deep` | `#2a8568` | Logo gradient bottom, dimmer accent |
| `--accent-deeper` | `#1a3d2e` | Logo gradient top, hover bg |
| `--danger` | `#b91c1c` | Over-leveled border |
| `--danger-soft` | `#f87171` | Over-leveled label/icon text |
| `--text-default` | `#fafafa` | Item names, headings |
| `--text-muted` | `#a3a3a3` | Subtitles |
| `--text-dim` | `#737373` | Tertiary |
| `--text-faint` | `#525252` | Slot labels (empty), placeholders |
| `--text-ghost` | `#404040` | Disabled state |

| Font | Use |
|---|---|
| **Bebas Neue** | Level numbers, section headers ("ÉQUIPEMENT", "DOFUS & TROPHÉES"), card titles, brand wordmark, modal titles, slot labels in empty state |
| **Inter** (400/500/600/700/900) | Item names, body, buttons, descriptions |
| **ui-monospace** | "Lv" prefix, item level badges, hint text, kbd |

## App shell

Three regions stacked vertically, top to bottom:

### 1. Top bar (sticky, ~52px)

- Left: brand wordmark `Dofus level planner` in Bebas Neue uppercase, preceded by a small mint dot with glow.
- Right: action buttons — `Nouveau build` (mint primary, resets the build to a single empty `Lv 1` card after a confirm prompt). `Importer` and `Exporter` are out of scope for V1 (see Out of scope below) and must **not** be rendered in the V1 UI; the top bar shows only `Nouveau build` on the right.
- Background: `rgba(5,5,5,0.8)` with `backdrop-filter: blur(8px)`.
- Bottom border: 1px `#1a1a1a`.

### 2. Timeline area (flex-1, horizontal scroll)

- Background: `#050505` + dual radial gradients (top-left `rgba(91,211,168,0.05)`, bottom-right `rgba(42,133,104,0.04)`) + 1px radial dot grid `rgba(255,255,255,0.015)` at 24px spacing.
- Horizontal scroll: native overflow-x with momentum on macOS, mouse-wheel→horizontal redirect for trackpad/wheel users on the timeline area.
- Padding: `24px` top, `0` left/right (the row pads itself).
- Row direction: `display: flex; align-items: stretch;` so cards and connectors share full height.

### 3. Mini-map (sticky, ~56px)

- Background: `rgba(5,5,5,0.9)` + `backdrop-filter: blur(8px)`.
- Top border: 1px `#1a1a1a`.
- Left: `Timeline` label (Bebas Neue, faint).
- Center: track shows one tick per card. Ticks render in card order (left to right matches timeline order); their relative widths are equal (track is divided into `cards.length` equal slots, simplest V1). Active-card tick = `#5BD3A8` with mint glow; other ticks = `#2a2a2a`.
- Viewport indicator: a translucent mint-bordered overlay over the track section currently visible in the timeline area, computed from scroll position + visible width.
- **Click-and-drag scroll**: pressing and holding anywhere on the track (not just the viewport) moves the timeline area's scrollLeft proportionally. Click without drag = jump. Implementation: pointer down → store start X + start scrollLeft → on pointer move while held, compute new scrollLeft from delta scaled by `track_width / timeline_total_width`.
- Right: stats string in mono — `<accent>Lv {active.level}</accent> · {cards.length} cards · {maxLevel} lvls`.

## Card structure

Each card is a fixed-width vertical surface representing one equipment state.

```
┌──────────────────────────────────────┐
│  ┌─────┐                              │  ← header (gradient top, ~76px)
│  │HEX  │  Lv  50                      │
│  │LOGO │  DONJON BOUFTOU (optional)   │
│  └─────┘                              │
├──────────────────────────────────────┤
│  ÉQUIPEMENT                           │  ← section header (Bebas accent)
│  [⛑] Coiffe Bouftou                  │
│  [🜌] Cape Bouftou                   │  ← 9 slots (icon + name when filled,
│  [○]  AMULETTE                       │       icon dashed + uppercase label
│  [○]  Anneau du Bouftou              │       when empty)
│  ...                                  │
│                                       │
│  DOFUS & TROPHÉES                     │
│  [◇][◆][◇][◇][◇][◇]                  │  ← single row of 6 cells
└──────────────────────────────────────┘
```

### Dimensions

- Width: **fixed 320px**.
- Min height: viewport-fit content. With all slots filled, ~480-520px.
- Border radius: 12px. Border: 1px `#262626`. Background: `#0a0a0a`.
- Drop shadow: `0 4px 32px rgba(0,0,0,0.4)`.

### Header (~76px)

- Padding: `14px`.
- Background: `linear-gradient(180deg, #0f0f0f, #0a0a0a)`.
- Bottom border: 1px `#1a1a1a`.
- Two children, flex row, `gap: 12px`, `align-items: center`:
  1. **Class logo** (hexagonal, 48×48):
     - Two-layer hexagon clip-path: filled gradient `#1a3d2e → #0a1a14` underneath, mint stroke (computed via clip-path subtraction trick) on top, soft mint drop-shadow.
     - Inside: real class image (DofusDB asset URL) when `classId` is set; a `?` glyph in mint with a pulsing stroke animation when `classId === null` (only happens on the very first card before initial class selection).
     - Click target: opens **Class picker** modal anchored to *this card only* (per-card class — see Class model below).
  2. **Right column**:
     - Top: `<span class=lv-prefix>Lv</span><span class=lv>{level}</span>` — Bebas Neue 28px white for the number, Inter 9px uppercase muted for the prefix. **The level is editable**: dashed underline on hover/focus, click → contenteditable or numeric input swap. No input arrows — keyboard typing only, range 1-200.
     - Bottom (optional): `title` field — Bebas Neue 12px, uppercase, muted (`#a3a3a3`), tracking 0.18em. Placeholder = none rendered if empty. Click empty area below level to add one. Free-form text, max ~30 chars.

### Body — equipment section

- Padding: `14px` (matches header padding so left edges align across logo + slot icons + dofus row).
- Section header: `ÉQUIPEMENT` — Bebas Neue 11px, mint `#5BD3A8` at 0.85 opacity, `letter-spacing: 0.3em`, `margin-bottom: 8px`.
- 9 slots in a vertical list, fixed order: Coiffe, Cape, Amulette, Anneau 1, Anneau 2, Ceinture, Bottes, Arme, Familier.
- Slot row anatomy: `flex; align-items: center; gap: 10px; padding: 5px 0; line-height: 24px; font-size: 11px;`
- Slot icon: 24×24 rounded-4px square. **Empty** = `#0f0f0f` bg, dashed `#2a2a2a` border, faint slot-type glyph centered (one bespoke inline SVG per slot type — coiffe, cape, amulette, anneau, ceinture, bottes, arme, familier — bundled in the app, not fetched). **Filled** = `#1f2937` bg, solid `#374151` border, real DofusDB item icon (from item asset URL).
- Slot label: **Empty** = uppercase Inter 600 10.5px tracking 0.1em, color `#525252`, content = slot type name (e.g., `AMULETTE`). **Filled** = sentence-case Inter 500 11px, color `#fafafa`, content = item name.
- The label baseline must vertically center with the icon — set `line-height: 24px` on the row to lock that.

### Body — dofus & trophées section

- Section header: `DOFUS & TROPHÉES`, same style, `margin-top: 14px`.
- One row of 6 cells: `display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px;`.
- Cell: `aspect-ratio: 1` (~36×36 at 280px content width), 5px border radius. Empty = dashed `#2a2a2a`, faint glyph. Filled = solid `#374151`, item icon. Same icon assets as equipment slots.
- Hover dofus: tooltip with item name + level required (no inline label, since cells are too small).

### Slot states

| State | Trigger | Visual |
|---|---|---|
| **Idle empty** | default, no item | dashed border, label uppercase muted |
| **Hover empty** | mouse over | mint border (solid), faint mint bg `rgba(91,211,168,0.06)`, label color lifts to `#a3a3a3`, right-side hint `+ AJOUTER` in mint uppercase |
| **Idle filled** | item set | solid border, item icon, item name |
| **Hover filled** | mouse over filled slot | mint glow on icon (1px shadow + 0 0 1px), `×` clear button revealed at right (22px circle, `#1a1a1a` bg, `#a3a3a3` glyph; `:hover` → red bg + red glyph) |
| **Over-leveled** | item.levelRequired > card.level | red icon (`#2a1414` bg, `#b91c1c` border, `#fca5a5` glyph) + red glow `rgba(220,38,38,0.25)` + right-side mono badge `lv {N}` in red `rgba(220,38,38,0.1)` bg. Not blocking — purely visual. |
| **Active** | picker open targeting this slot | full row gets inset mint shadow `inset 0 0 0 1px rgba(91,211,168,0.5)` + slight mint bg `rgba(91,211,168,0.05)`; icon gets stronger mint glow. Acts as visual anchor while the side sheet is open. |

Same five states apply to dofus cells, scaled down (no inline label, no clear button — `×` revealed as overlay corner instead, and over-leveled badge becomes a small red dot in the top-right corner).

## Connectors

Between every consecutive pair of cards, **and after the last card**, there is a connector slot (~120px wide, full card height). There is **no connector before the first card** — the timeline always grows to the right.

- Connector visual: a thin horizontal line `linear-gradient(90deg, transparent, #1f1f1f 20%, #1f1f1f 80%, transparent)` centered vertically.
- "+" pill button centered on the line:
  - **Idle**: outline pill, transparent bg, 1px mint border, mint glyph, `box-shadow: 0 0 0 4px #050505`. Compact (~32×32 if no label, or 32px tall with `+ Ajouter` text in Bebas Neue uppercase if we want it labeled — V1 spec says glyph-only idle, label appears on hover).
  - **Hover/active**: pill becomes filled mint, glyph dark `#061a13`, expanded with `Ajouter` label, mint glow `0 0 24px rgba(91,211,168,0.45)`. Slight `transform: scale(1.04)`.
- **Click** opens a popover anchored below the pill, two items:
  - `Card vide` — secondary text `Slots vides` (Inter uppercase 9.5px). Inherits class from previous card by default. Level field unset (placeholder `Lv —`).
  - `Copier la précédente` — secondary text `Reprend l'état`. Inherits class + all slots + level (level = previous + 1 by default).
- Keyboard shortcuts (V1.1 if simple): `N` for vide, `D` for duplicate.
- A new card materializes only after the user picks one of the two options. Until then, no card is rendered to the right of that connector — there is **no pre-generated empty slot**.
- The first card (`Lv 1`) is auto-generated on first launch. After that, growth is user-driven.

## Item picker — side sheet

When a slot is clicked (filled or empty), a **right-side sheet** slides in.

- Width: **540px**, full timeline-area height. Background `#0a0a0a`, left border 1px `#262626`, shadow `-24px 0 48px rgba(0,0,0,0.5)`.
- Header (`~52px`):
  - Title in Bebas Neue uppercase mint: `Choisir une {slotType}` (e.g., `Choisir une amulette`).
  - Right: `esc` kbd hint.
- Search input (immediately below header):
  - Full width, `#050505` bg, 1px `#262626` border, focus border `#5BD3A8`. Auto-focused on open.
- Filter pills row (one row, wrap if needed):
  - `Tous` (default active), `≤ Lv {card.level}`, `Au-dessus`, `Trier · niveau`, `Trier · nom`. Active pill = mint outline + mint text + soft mint bg.
- Item list (scrollable, fills remaining height):
  - Each item row: 36×36 icon, name (Inter 500 12px), stats summary (mono 10px muted, e.g., `+10 Vita · +5 Force · +1 PA`), right-side level badge (mono 10px in `#262626` bordered chip).
  - Over-leveled item: red icon (same treatment as in card) + red badge.
  - Selected item (currently equipped on this slot): mint inset shadow `inset 0 0 0 1px rgba(91,211,168,0.4)` + soft mint bg.
  - Click row → assigns item to slot, closes sheet.
- The **active card stays visible** at the left of the timeline area (the sheet covers ~540px on the right, the rest of the timeline remains untouched). The targeted slot stays in `Active` state during the sheet's lifetime.
- Close: `Esc`, click outside the sheet on the timeline area, or click the × in the header (omitted here for brevity but should exist on the right of the title).

## Class picker — modal

Triggered by clicking the class logo on **any** card. The picker affects **only that card** (per-card class model).

- Centered modal, max-width 720px, on top of a backdrop `rgba(0,0,0,0.6) + blur(2px)`.
- Header: `Choisir une classe` in Bebas Neue 16px uppercase + `esc` kbd hint.
- Body: 6×3 grid of class cells.
  - 18 classes in fixed order: Iop, Cra, Sram, Eniripsa, Sadida, Enutrof, Sacrieur, Ecaflip, Féca, Xélor, Pandawa, Osamodas, Roublard, Zobal, Steamer, Eliotrope, Huppermage, Ouginak.
  - Cell: aspect 1, `#0f0f0f` bg, 10px radius, 1px `#1f1f1f` border. Inside: hexagonal class icon (36×36) above class name in Bebas Neue 11px uppercase tracking 0.18em.
  - Hover: mint border, faint mint bg, lift `translateY(-2px)`, color shifts mint.
  - Selected (current class of the targeted card): mint border, mint bg `rgba(91,211,168,0.08)`, mint glow.
- Footer text: `Sélection appliquée à <accent>cette card</accent> uniquement · les vrais logos sont chargés depuis DofusDB`.
- Click a class → updates only the card whose logo was clicked. Modal closes.

## Initial empty state (first launch)

- One card on the timeline: `Lv 1`, class unset.
- Class logo shows `?` glyph in mint, hexagon stroke pulses (2s ease-in-out infinite, opacity 0.4 ↔ 0.9, glow strengthens at peak).
- Title area shows mint CTA `Choisir une classe` (replacing the optional title).
- Card body: subtle prompt block in muted text `Cliquez sur le logo pour choisir votre classe.` (no propagation claim — class is per-card).

Once the class is set, the body renders the standard empty equipment + dofus sections.

## Class model — per card

- Each card has its own `classId` (or `null` if unset).
- "+ Card vide" → class default = inherit `classId` from previous card; slots all empty; level default = `null` (placeholder).
- "+ Copier la précédente" → class + all slots + level + title cloned, level then `+ 1`.
- Changing a card's class via picker affects only that card.
- Invariant: a card's `classId` may be `null` only on the very first card before initial class selection. After that, every card always has a class set (initial defaulting on creation guarantees it).

## Persistence

`localStorage` key `dofus-planner.build.v1` storing JSON:

```json
{
  "version": 1,
  "cards": [
    {
      "id": "uuid",
      "classId": "iop",
      "level": 1,
      "title": null,
      "slots": {
        "coiffe": null,
        "cape": null,
        "amulette": null,
        "anneau1": null,
        "anneau2": null,
        "ceinture": null,
        "bottes": null,
        "arme": null,
        "familier": null
      },
      "dofus": [null, null, null, null, null, null]
    }
  ]
}
```

Slot values when set: `{ "itemId": 12345 }` (resolved against DofusDB cache).
Auto-save on every mutation (debounced 250ms).

DofusDB item cache: separate key `dofus-planner.cache.items.v1` mapping `itemId → { name, icon, levelRequired, stats, slotType, fetchedAt }`. Used to render slot/picker items without re-fetching. TTL: V1 = none (cache forever, refresh when user manually clears).

## Out of scope for V1

These are explicit non-goals. Do not implement them in V1:

- Multi-build support (saving + switching between several builds).
- Import / Export of build JSON (no `Importer`/`Exporter` buttons in V1 top bar).
- Backend / cloud sync.
- Sharing / export to URL or image.
- Drag-and-drop (slot reordering, dragging items from picker, dragging cards to reorder).
- Stat aggregation summary (total vita, total force, etc. across all equipped items).
- Sub-stats configuration (e.g., parchos, runes, Forgemagie).
- Spell or characteristic point planning.
- Authentication / user accounts.

## Open implementation questions to resolve during plan writing

These are not visual decisions but will surface during the implementation plan and may need a quick check-in:

- DofusDB API endpoints + rate limits + auth (does the public API need a key? How do we paginate large item lists per slot type for the picker?).
- Class/item icon assets — are they served from DofusDB or do we ship our own assets?
- Bebas Neue licensing for production (Google Fonts is fine; ensure self-host or import URL is in place).
- Insertion of cards *between* existing ones (the design implies "+" exists between every pair, so insertion is supported — confirm Pinia store action `insertCardAt(index)`).
