# EquipmentCard redesign — header hero, action row XXL, kebab menu

**Date:** 2026-05-23
**Scope:** Visual rework of `EquipmentCard` (Builder + Reader views). Functional behaviour
preserved — only the header layout, central stats panel proportions, and the action
button placement change.

## Motivation

The current card design has three visible polish issues flagged by the user:

1. The class thumbnail (top-left image) doesn't bleed flush to the card's rounded corner
   — `<header>` has `pl-[4px] py-[2px]` padding, so a 2–4px gap shows above and to the
   left of the image.
2. The central stats panel uses `justify-center` on the stats table, leaving visible
   vertical gaps between the PA/PM/PO action row and the stats grid, plus dead space
   under the last row.
3. The three header buttons (Copier le code, Ouvrir dans Dofusbook, Supprimer) sit as
   three identical w-8 circles tightly packed against the corner. They feel unbalanced
   against the large NIV {level} text and don't read as a unified group.

## Goals

- Make the class thumbnail feel integrated with the card frame.
- Eliminate the vertical dead space in the central panel.
- Consolidate the header actions so they don't fight the title for attention.
- Preserve every existing behaviour: click-image-to-open-class-picker, click-title-to-edit,
  click-NIV-to-edit, in-place delete confirmation, readonly mode, class accent theming.

## Non-goals

- The cruciform slot layout (left column + center panel + right column + dofus row) stays
  identical.
- The slot picker, dofus picker, item tooltip, and stat investment modal are untouched.
- No new card-level features (no new actions, no new stats, no new data fields).

## Design

### 1. Header — hero banner

The class thumbnail becomes a full-width background of the header band instead of a
left-hugging 64×64 square.

**Layout:**
- `<header>` is `relative`, height fixed at 76px (was 64+padding ≈ 68px), no padding around
  edges. The card's `rounded-xl overflow-hidden` clips the corners naturally.
- The class image renders as an absolutely-positioned `<div>` (or `<img>`) covering the
  full header rect: `inset-0`, `object-cover` / `background-size: cover`,
  `background-position: center 20%` to keep the portrait's face roughly in frame.
- A horizontal gradient overlay (`background: linear-gradient(to right,
  rgba(8,18,26,0.55) 0%, rgba(8,18,26,0.95) 65%)`) sits over the image to guarantee
  text contrast on the left side.
- Image opacity is dropped to `0.6` and `background-blend-mode: multiply` is applied
  with the class-accent tint underneath, so the hero reads as "tinted class art" rather
  than a plain photo.
- When no class is picked (`showCta` state, `classId === null`), no image is rendered.
  The header band shows the dark base colour (no gradient overlay needed) and the
  inline "Choisir une classe" CTA appears in the title slot. The whole header band
  remains clickable to open the class picker.

**Text:**
- Title: top-left, `left-3 top-3`. Same uppercase, `font-display text-[10px]
  font-light tracking-[0.16em]`, in the class accent colour (cyan default).
- NIV: directly below, `top-8`. `font-display text-[26px] font-bold` in white. The
  existing inline edit input keeps its dashed-bottom underline style.
- Both are click-to-edit just like today — they catch their own clicks.
- The "Choisir une classe" CTA replaces the title slot when classId is null.

**Class picker trigger:**
- The header itself (excluding the text inputs and the kebab) is clickable to open the
  class picker. Implementation: an absolutely-positioned `<button>` overlay covering the
  hero `inset-0`, z-indexed BELOW the text + kebab buttons, transparent background, so
  clicks on empty header space open the picker. Title/NIV/kebab catch their clicks via
  natural stacking.

### 2. Header — kebab menu

The three action buttons collapse into a single `⋮` button at the top-right of the
hero.

**Trigger:**
- 28×28 circle, top-right `top-3 right-3`, translucent backdrop
  (`bg-black/45 border border-white/15 backdrop-blur-sm`), neutral icon colour
  `text-white/75`, hover `text-[#8AE0EE]`.

**Dropdown:**
- Opens DOWNWARD from the kebab, anchored top-right.
- Width 180px, dark panel matching the modal vocabulary (`bg-[rgba(8,12,16,0.95)]
  border border-[#5DCFE0]/40 rounded-md backdrop-blur-md shadow-lg`).
- Items (top to bottom):
  1. **Copier le code** — neutral text, emits `copy-code` like today.
  2. **Ouvrir dans Dofusbook** — neutral text, emits `open-dofusbook`.
  3. **Supprimer** — danger-tinted (`text-danger-soft`), only rendered when `!readonly`.
- Each item: icon (existing SVGs) + label, `flex items-center gap-2 px-3 py-2 text-[11px]
  font-sans`. Hover: `bg-[#5DCFE0]/[0.08]` (danger row: `bg-danger/10`).
- Outside-click and Escape close the menu — wire through the existing
  `onClickOutside` + `useEventListener('keydown')` patterns used by other popovers.

**Behaviour preserved:**
- "Supprimer" click → same `confirmingDelete` toggle that swaps the card body to
  `CardDeleteConfirm`. The kebab menu closes when the panel opens.
- In readonly mode, only Copier + Ouvrir Dofusbook show; the menu still uses a kebab.
- Existing `aria-label`s migrate to the menu items so screen readers keep the same vocab.

### 3. Central panel — XXL action row

The PA/PM/PO row keeps its top-of-panel position but grows so it absorbs the dead space
that `justify-center` used to create around the stats table.

**Action row:**
- `.action-icon` clamp bumped from `clamp(28px, 8cqb, 56px)` to
  `clamp(36px, 11cqb, 72px)`. Icons gain ~28% in container-aware sizes.
- `.action-value` font from `clamp(15px, 4cqb, 22px)` to `clamp(18px, 5cqb, 28px)`.
- Inter-icon gap from `gap-6` (24px) to `gap-8` (32px). The three icons now read as a
  feature row, not a header strip.

**Stats table:**
- Outer flex container switches from `justify-center` to `justify-between`. The action
  row sticks to the top of the panel area, the stats table sticks to the bottom of the
  panel area, and the visible gap between them is the natural breathing room — no longer
  a centered-blob with empty bands above and below.
- Internal row gap stays `clamp(2px, 1.6cqb, 16px)` — already capped per earlier user
  request.

**Why this fills the void:** the old layout had three sources of vertical air —
`gap-2` on the aside, the centered stats table, and a small action row. By enlarging
the action row (which scales with cqb) and pinning the stats table to the bottom edge,
the panel reads as two anchored bands with a single natural gap between them. No empty
bands remain.

## Component changes

- `src/components/CardHeader.vue` — full template rewrite of the header. Script keeps
  identical state (editingLevel/Title, refs, commit/cancel handlers) plus a new
  `menuOpen` ref + `menuRef` for the kebab dropdown + `onClickOutside(menuRef, ...)`.
  Emits unchanged (`open-class-picker`, `update:level`, `update:title`, `remove`,
  `open-dofusbook`, `copy-code`).
- `src/components/CardStatsPanel.vue` — CSS clamps for `.action-icon` and
  `.action-value` bumped, outer flex changed to `justify-between`. No JS / template
  structural changes.
- `EquipmentCard.vue` / `EquipmentCardDiff.vue` — no API changes; they keep wiring the
  same emits.

## Visual targets (reference)

Mockup file: `.superpowers/brainstorm/1431-1779555989/content/04-integrated.html`.
Header height 76px. Hero gradient `linear-gradient(to right, rgba(8,18,26,0.55) 0%,
rgba(8,18,26,0.95) 65%)`. Action icons up to 72px, values up to 28px.

## Risks / open items

- **Image cropping per class** — `background-position: center 20%` is tuned for
  portrait-style thumbnails. If some class assets are landscape or off-centre the face
  may sit awkwardly. Mitigation: rely on the existing `getClassAssets()` thumbnail URLs
  which are already 64×64 square portraits; this works at any aspect ratio.
- **Kebab discoverability** — going from three always-visible icons to one kebab means
  users need one extra click to copy/share. Accepted: every action keeps a discoverable
  text label inside the menu.
- **Readonly mode menu** — kebab still renders even when only two items are inside.
  That's intentional; the user shouldn't have to learn two distinct layouts.

## Out of scope (future work, not for this spec)

- Reader-mode card variant (`EquipmentCardDiff.vue`) — same header pattern applies but
  may want differentiated styling. Punted until the redesign lands on the Builder.
- Hero image sourcing — currently `ClassAssets.thumbnail`. A future enhancement could
  swap in a wider hero asset per class if better art becomes available.
