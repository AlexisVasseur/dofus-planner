# V3 — Class-themed card design

Status: design complete, awaiting user review before implementation planning.
Date: 2026-05-05.

## Concept

Replace the uniform dark/mint visual identity of the equipment cards with a **per-class themed** design. Each card uses the class's hero illustration as a subtle background in the header, its thumbnail in place of the abstract hexagon logo, and a tinted card background derived from the class's dominant color. The universal mint accent is dropped from the chrome (top bar, mini-map, pickers, Achats) and replaced with a neutral white treatment so that **the class colors are the only color statement** in the app. Fonts switch from Bebas Neue + Inter to **Rowdies + Roboto** (the typography Dofus.com uses).

Layout intensity is **medium**: hero visible only in the header (faded into the body via a mask gradient), card background tinted ~10% with the class's "soft" tone. Body content stays neutral-dark for legibility. The 19 classes get a recognizable but not saturating identity.

## Assets

### Source layout

The class assets are bundled into the source tree, one folder per class:

```
src/assets/classes/
├── iop/
│   ├── thumbnail.jpg     square portrait (~470×470)
│   ├── hero.jpg          wide banner (~2000×724)
│   └── colors.json       class palette
├── cra/
│   ├── thumbnail.jpg
│   ├── hero.jpg
│   └── colors.json
... (19 folders)
```

Source images already exist under `inspiration/classes/{hero,thumbnails}/<id>-{hero,thumbnail}.jpg`. Implementation copies them into the per-class subfolders. The `inspiration/` folder stays untouched as the original reference.

### `colors.json` schema

```json
{
  "dominant": "#d96a2a",
  "soft": "#2a1d14",
  "accent": "#ffd9a8"
}
```

- `dominant` — the class's signature color, used for borders, active glow, the level number text, and the class picker selected state.
- `soft` — the dark tinted version (mix of dominant + near-black), used for the card background gradient.
- `accent` — the bright/desaturated version, used for highlights (level number text-shadow, section headers in the body).

Hand-picked one set per class. Initial palette proposed for the 19 classes (final values will be tuned during implementation; the exact hex per class is part of the implementation, not blocking the spec):

| Class | dominant (preview) |
|---|---|
| iop | `#d96a2a` ambre |
| cra | `#3a8e6e` vert sapin |
| sram | `#5a3d8a` violet sombre |
| eniripsa | `#d96aa6` rose éclat |
| sadida | `#7a9c4a` vert mousse |
| enutrof | `#c79b3a` or |
| sacrieur | `#a83838` rouge sang |
| ecaflip | `#d6a838` doré chaud |
| feca | `#3a7ec7` bleu protecteur |
| xelor | `#5a7ac7` bleu glace |
| pandawa | `#5a8d4a` jade |
| osamodas | `#9a5a3a` cuivre brun |
| roublard | `#3a6b6b` teal sombre |
| zobal | `#a8783a` ocre masque |
| steamer | `#7a7a8a` acier |
| eliotrope | `#5a8aaa` bleu portail |
| huppermage | `#7a3aa8` magenta arcanique |
| ouginak | `#9a3a3a` rouge canin |
| forgelance | `#a8682a` cuivre forge |

(Final values picked at implementation time by sampling the hero images.)

### Loader

A composable `useClassAssets(classId)` exposes:

```ts
interface ClassAssets {
  thumbnailUrl: string;
  heroUrl: string;
  colors: { dominant: string; soft: string; accent: string };
}

export function useClassAssets(classId: ClassId | null): ClassAssets | null;
```

Implementation uses `import.meta.glob` to bundle all class folders eagerly:
```ts
const heros = import.meta.glob('@/assets/classes/*/hero.jpg', { eager: true, query: '?url', import: 'default' });
const thumbs = import.meta.glob('@/assets/classes/*/thumbnail.jpg', { eager: true, query: '?url', import: 'default' });
const colors = import.meta.glob('@/assets/classes/*/colors.json', { eager: true });
```

The class id is parsed from each path key. Returns `null` when `classId` is null (the unset-class first card in the empty state). Components render the legacy hex frame fallback in that case.

### Forgelance class added

The asset folder includes `forgelance` (a 2024 Dofus class). Add to `ClassId` union and `CLASSES` array:

```ts
// types/classes.ts
export type ClassId = ... | 'forgelance';

// data/classes.ts
{ id: 'forgelance', name: 'Forgelance', abbrev: 'FGL' }
```

19 classes total.

## Typography

Replace fonts globally:
- `font-display` (Tailwind token): Bebas Neue → **Rowdies** (Google Fonts; weights 400 default, 700 bold)
- `font-sans` (Tailwind token): Inter → **Roboto** (Google Fonts; weights 400, 500, 700)
- `font-mono` (ui-monospace): unchanged

Font import in `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Rowdies:wght@400;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
```

Usage stays the same: titles/levels/labels use `font-display`, body/items use `font-sans`. No class consumers change beyond the typography swap.

## Card visual recipe

Each card receives the class theme via CSS custom properties applied on the card root:

```vue
<article
  class="equipment-card"
  :data-class-id="card.classId"
  :style="card.classId ? {
    '--class-dominant': colors.dominant,
    '--class-soft': colors.soft,
    '--class-accent': colors.accent,
  } : undefined"
>
```

When `classId === null` (initial empty state), variables are unset and the card falls back to neutral defaults (`var(--class-dominant, #5BD3A8)` style fallbacks in the CSS).

### Layout (320px Build / 576px Switch — same template)

```
┌──────────────────────────────────────────────────┐  border 1px color-mix(--class-dominant 40%, transparent)
│ HERO IMAGE (header background, mask gradient)   │
│  ┌─[thumb]─┐   Lv  50                            │  header padding 14px
│  │ 56×56   │   (Rowdies, --class-accent)         │
│  │ rounded │   PETIT TITRE EN ROWDIES            │
│  └─────────┘                                     │
├──────────────────────────────────────────────────┤
│ BODY (bg gradient: --class-soft → page-bg)       │
│  [⛑] Coiffe Bouftou           (Roboto 14px)      │
│  [○] CAPE                     (slot empty)       │
│  ...                                             │
│  ─── DOFUS & TROPHÉES ───     (Rowdies, --accent)│
│  [◇][◆][◇][◇][◇][◇]                              │
└──────────────────────────────────────────────────┘
```

### Element-by-element

**Card border**: `border: 1px solid color-mix(in srgb, var(--class-dominant) 40%, transparent)`. Subtle but visible from afar.

**Card background**: `background: linear-gradient(180deg, var(--class-soft) 0%, color-mix(in srgb, var(--class-soft) 70%, #050505) 100%)`. Top of body warmer (close to the hero), bottom darker (closer to page).

**Hero in header**:
```css
.card-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url(/* heroUrl from useClassAssets */);
  background-size: cover;
  background-position: 70% 30%;
  opacity: 0.55;
  mask-image: linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%);
  -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%);
  pointer-events: none;
}
```
Position `70% 30%` puts the character (right side of the hero) under the level number area, with empty atmospheric space behind the thumbnail.

**Thumbnail header (replaces ClassLogo hex)**:
- Size 56×56, `border-radius: 10px`, `overflow: hidden`
- `box-shadow: 0 0 0 1px rgba(255,255,255,0.12), 0 4px 12px rgba(0,0,0,0.5)` (subtle white edge + drop shadow lifts it from the hero)
- `<img>` `object-fit: cover`, full size

When `classId === null`: render the legacy hex frame with pulsing `?` (existing `ClassLogo` component, used as fallback only).

**Level number "Lv 50"**:
- Font: Rowdies 30px weight 700
- Color: `var(--class-accent)` 
- Text-shadow: `0 2px 8px rgba(0,0,0,0.7)` for legibility on the hero

**Title (optional, below level)**:
- Font: Rowdies 12px, uppercase, `letter-spacing: 0.15em`
- Color: `rgba(255,255,255,0.7)`

**Slot rows (body)**:
- Font: Roboto 14px
- Icon container: 36×36, neutral `bg-bg-slot-filled` + neutral border
- Hover: `border-color: var(--class-dominant)`, light `box-shadow: 0 0 0 1px color-mix(--class-dominant 30%, transparent)`
- Active (picker open on this slot): full ring of `var(--class-dominant)` + soft glow

**Section headers ("DOFUS & TROPHÉES")**:
- Font: Rowdies 14px uppercase tracking-[0.3em]
- Color: `color-mix(in srgb, var(--class-accent) 80%, white)` — slightly desaturated accent

**Active card ring** (when `ui.activeCardId === card.id`):
- `box-shadow: 0 0 0 1px var(--class-dominant), 0 0 24px color-mix(in srgb, var(--class-dominant) 30%, transparent)`

### Switch carousel adaptations

- Active centered card gets full theming as above.
- Peeks (scale 0.55, opacity 0.4): same template — the lower opacity naturally desaturates them.
- Diff red/green (changed slot rows in `EquipmentCardDiff`): **stays semantic** — `text-danger-soft #f87171` for the old item, the existing universal mint `#5BD3A8` for the new item. This is the one place mint is intentionally kept (semantic diff color, recognized by users as "added/positive").

### Build mode timeline

Same per-card theming. Cards next to each other show different class palettes if the user switched class between cards. Connectors between cards stay neutral (see chrome neutralization).

## Chrome neutralization

The mint `#5BD3A8` accent is dropped from everywhere outside the cards. Replaced by neutral `text-default` (`#fafafa`) and `text-muted` (`#a3a3a3`).

The `accent` Tailwind tokens (`accent.DEFAULT`, `accent.deep`, `accent.deeper`) are kept in `tailwind.config.ts` for backward-compat (the diff "new item" green still uses them, and we may revive a discrete accent later) but are **not used** in the listed chrome elements below.

### Top bar (`AppTopBar.vue`)
- Brand dot mint glow → **removed** (just the wordmark in Rowdies)
- Mode toggle Build/Switch/Achats: active `bg-text-default text-bg-page`, inactive `text-text-muted hover:text-text-default`
- Importer/Exporter outline: hover border `border-text-muted`, hover text `text-text-default`
- "Nouveau build" primary: `bg-text-default text-bg-page hover:brightness-90`

### Mini-map (`AppMiniMap.vue`)
- Cell active: `bg-text-default text-bg-page` (no shadow glow)
- Cell hover: `bg-bg-elev text-text-default`
- Stats line: all `text-text-dim` mono

### Connector (`Connector.vue`)
- Pill idle: `bg-bg-surface border border-text-muted text-text-muted shadow-[0_0_0_3px_#050505]` (no mint glow)
- Pill open/hover: `bg-text-default text-bg-page` (no mint glow)
- Popover: same neutral, hover items `text-text-default` (no mint)

### Class picker modal (`ClassPickerModal.vue`)
- Cell hover: `border-text-muted bg-bg-elev` (lift)
- **Cell selected** (current class of the targeted card): `border-color: var(--class-dominant)` + `bg: color-mix(--class-soft, page-bg, 80%)` — each cell highlights with its OWN class color when selected. Adds a moment of delight when picking.
- Modal title in Rowdies, no mint
- Footer text neutral grey

### Item picker sheet (`ItemPickerSheet.vue`)
- Header title: `text-text-default` (no mint)
- Search input focus border: `border-text-default`
- Filter pills active: `bg-text-default/10 text-text-default border-text-muted`
- Item row hover: `bg-bg-elev`
- Item row selected (item currently equipped on this slot): `border-text-muted bg-text-default/5` (no mint)

### Purchase planner (`AppPurchasePlanner.vue` + `NpcCard.vue` + `ItemRow.vue`)
- Room tab active: bottom-border 2px `border-text-default`
- Room tab badge `(N)`: `text-text-dim`
- NPC card label: `text-text-default` (Rowdies, no `text-accent/85`)
- Item count badge `×N`: `text-text-dim border-border-default`
- Copy button (`⧉`) hover: `border-text-default text-text-default`
- Copy ✓ feedback: `bg-text-default text-bg-page`

### Switch view (`AppSwitchView.vue`)
- Peek labels `‹ Précédent · Lv X` / `Suivant · Lv Y ›`: `text-text-default` (no mint)
- Active card ring: uses `var(--class-dominant)` from the theme (already covered in Card section)

### Backgrounds (`App.vue`)
- The mint radial gradients on the page background (`rgba(91, 211, 168, 0.05)` etc.) are **removed**. Background becomes plain `bg-bg-page` + the existing 1px dot grid (kept). Cleaner.

## Components touched

| File | Change |
|---|---|
| `src/types/classes.ts` | Add `'forgelance'` to `ClassId` union |
| `src/data/classes.ts` | Add `Forgelance` entry to `CLASSES` |
| `src/assets/classes/<id>/{hero.jpg,thumbnail.jpg,colors.json}` | NEW — 19 folders, 57 files total |
| `src/composables/useClassAssets.ts` | NEW — loader exposing `{ thumbnailUrl, heroUrl, colors }` |
| `src/components/ClassThumbnail.vue` | NEW — replaces `ClassLogo` in CardHeader. Falls back to `ClassLogo` (hex) when `classId === null` |
| `src/components/CardHeader.vue` | Use `ClassThumbnail` instead of `ClassLogo`. Apply hero background via `::before`. Apply CSS vars from `useClassAssets`. Update typography (Rowdies). |
| `src/components/EquipmentCard.vue` | Apply CSS vars from `useClassAssets` on the article root. Update class-themed border + bg gradient. |
| `src/components/EquipmentCardDiff.vue` | Same theming as `EquipmentCard` on root. Diff red/green stays. |
| `src/components/EquipmentSlot.vue` | Hover/active states use `var(--class-dominant)` instead of `theme('colors.accent.DEFAULT')`. |
| `src/components/DofusCell.vue` | Same. |
| `src/components/Connector.vue` | Pill mint → neutral white. |
| `src/components/ConnectorPopover.vue` | Hover items neutral. |
| `src/components/AppTopBar.vue` | Mode toggle, brand dot, action buttons → neutral. |
| `src/components/AppMiniMap.vue` | Active cell white-on-dark. |
| `src/components/AppPurchasePlanner.vue` | Room tabs / labels → neutral. |
| `src/components/NpcCard.vue` | Label color → neutral. |
| `src/components/ItemRow.vue` | Copy ⧉/✓ → neutral white. |
| `src/components/ItemPickerSheet.vue` | Pills, search, item selected → neutral. |
| `src/components/ClassPickerModal.vue` | Cell selected uses class's own colors via `useClassAssets`. |
| `src/components/AppSwitchView.vue` | Peek labels → neutral. |
| `src/App.vue` | Remove mint radial gradients in backgrounds. |
| `src/style.css` | (no change needed beyond Tailwind tokens) |
| `tailwind.config.ts` | Update `fontFamily.display` → `Rowdies`, `fontFamily.sans` → `Roboto`. Keep `accent` tokens (used by diff green). |
| `index.html` | Update Google Fonts `<link>` to import Rowdies + Roboto (drop Bebas Neue + Inter). |

## Tests

No new tests required — this is a pure visual refactor. Existing 41 tests should keep passing:
- `useClassAssets` is a thin loader — could add a unit test that confirms it returns null for unknown class id and an object for `iop`. Optional, low-value.

If the existing tests hardcode class color expectations (they don't — they test slot mechanics, build store, persistence, dofusdb URL building), nothing breaks.

Manual smoke test after implementation:
1. Open Build mode with a multi-card timeline using different classes — verify each card has its theme.
2. Open Switch carousel — verify peeks are themed too.
3. Open class picker — hover/select cells and verify each cell highlights in its own class color.
4. Open Achats mode — verify chrome is fully neutral, no mint anywhere.
5. Toggle the universal mint check: `grep -rn "5BD3A8\|accent" src/components/` should only return the diff-row green spots in `EquipmentCardDiff.vue` (intentional kept).

## Out of scope

- **Per-class accent in the diff red/green** — the green stays the universal mint as a recognized "diff added" color. Class-specific green would dilute the semantic.
- **Animation of card theme changes** when the user changes a card's class — instant swap is fine, no morph.
- **Hero image cropping per class** — we accept the default `background-position: 70% 30%` which works for the Iop sample. If a specific class hero looks bad, the per-class `colors.json` could later be extended with a `heroPosition` field.
- **Webp / image optimization** — keep JPGs for now. Hero images are ~150-300KB each. With 19 classes × 2 images = ~5MB total bundled. Acceptable for a single-page app. Lazy-loading per visible card could be a V3.1 pass if it becomes a problem.
- **Accent color recovery** — if dropping mint makes the chrome feel too cold after rendering, a single discrete accent (e.g., warm white `#fff6e8`) could replace it. Skip for V3, address only if needed.
- **Dark/light mode** — out of scope. App stays dark-only.
