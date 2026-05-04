# Dofus level planner — V1 As-Built

Status: shipped. 30 tests passing, typecheck clean, prod build green.
Date: 2026-05-04.

This document reflects what was actually built. The original design spec is at `superpowers/specs/2026-05-03-v1-visual-design.md` — read it for design intent. Where the two disagree, this doc wins.

## Stack

- Vue 3.5 + Vite 6 + TypeScript 5
- Pinia 2 (build store + UI store)
- Tailwind 3 (custom theme tokens)
- VueUse 11 (`useElementBounding`, `useEventListener`, `useDebounceFn`, `onClickOutside`, `useWindowSize`)
- Vitest 2 + @vue/test-utils + jsdom (30 unit/component tests)
- Fonts: Bebas Neue + Inter via Google Fonts
- No `uuid` dep — `crypto.randomUUID()` with fallback

## File map

```
src/
├── App.vue                          root layout (TopBar + Timeline + MiniMap + Pickers)
├── main.ts                          createApp + Pinia + usePersistence bootstrap
├── style.css                        tailwind + base layer
├── env.d.ts                         vite client + .vue module decl
├── types/
│   ├── classes.ts                   ClassId union (18 classes), ClassDef
│   ├── slots.ts                     SlotType union (10 slots), SLOT_ORDER, DOFUS_COUNT, SLOT_LABEL
│   └── build.ts                     ItemRef, Card, Build (version: 1)
├── data/
│   ├── classes.ts                   18 ClassDef entries
│   ├── slot-icons.ts                10 inline SVG glyphs per slot type
│   └── dofusdb.ts                   client: fetchItemsBySlot, fetchDofusOrTrophees,
│                                    fetchItem, SLOT_TO_TYPE_IDS, DOFUS_TROPHEE_TYPE_IDS
├── stores/
│   ├── build.ts                     cards[] + setClass/setLevel/setTitle/setSlot/setDofus
│   │                                + addEmptyCardAfter/addCopyCardAfter/removeCard/
│   │                                resetBuild/replaceCards + makeFreshFirstCard
│   └── ui.ts                        activeCardId, itemPickerTarget, classPickerCardId
│                                    + setActiveCard/openItemPicker/closeItemPicker/
│                                    openClassPicker/closeClassPicker
├── composables/
│   ├── usePersistence.ts            load + debounced 250ms save to localStorage
│   ├── useItemCatalog.ts            useItemSearch, ensureItem, getCachedItem,
│   │                                isOverLeveled, SearchTarget = SlotType | 'dofus' | null
│   └── useDragScroll.ts             generic pointer drag-to-scroll (currently unused)
├── components/
│   ├── AppTopBar.vue                brand + Importer / Exporter / Nouveau build
│   ├── AppTimeline.vue              horizontal scroll area, exposes scrollRef
│   ├── AppMiniMap.vue               clickable cells (Lv N), centers card via scrollTo
│   ├── EquipmentCard.vue            composes header + 10 slots + 6 dofus cells
│   ├── CardHeader.vue               class logo + editable level + optional title + delete
│   ├── ClassLogo.vue                hex frame, pulse on null classId
│   ├── EquipmentSlot.vue            full slot row (6 states)
│   ├── DofusCell.vue                small slot variant
│   ├── Connector.vue                "+" pill (36×36 circle), uses useElementBounding
│   ├── ConnectorPopover.vue         Teleport to body, viewport-clamped fixed position
│   ├── ItemPickerSheet.vue          right side sheet 540px (search + filters + list)
│   └── ClassPickerModal.vue         centered modal 6×3 grid of 18 classes
└── utils/
    └── id.ts                        randomId() wrapper

tests/
├── setup.ts                         jsdom + localStorage.clear() between tests
├── stores/build.spec.ts             11 tests covering all mutations
├── composables/usePersistence.spec  5 tests on load/save/debounce/version/corrupt
├── composables/useDragScroll.spec   4 tests on pure scroll math
├── data/dofusdb.spec.ts             6 tests on URL building + mapping + dofus fetch
└── components/EquipmentSlot.spec    4 tests on over-leveled state
```

## Slots

10 equipment slots in this fixed order: `coiffe, cape, amulette, anneau1, anneau2, ceinture, bottes, arme, bouclier, familier`. Plus 6 dofus/trophée cells in a single horizontal row.

DofusDB typeIds verified against the live `/item-types` endpoint:

| Slot | typeId(s) |
|---|---|
| coiffe | 16 (Chapeau) |
| cape | 17 |
| amulette | 1 |
| anneau1 / anneau2 | 9 |
| ceinture | 10 |
| bottes | 11 |
| arme | 2, 3, 4, 5, 6, 7, 8, 19, 20, 21, 22 (Arc, Baguette, Bâton, Dague, Épée, Marteau, Pelle, Hache, Outil, Pioche, Faux) |
| bouclier | 82 |
| familier | 18, 121 (Familier + Montilier) |
| dofus / trophée | 23, 25, 151 (Dofus, Trophée) |

## DofusDB integration

Public API: `https://api.dofusdb.fr` (Feathers-style query string).

Two gotchas verified at runtime:
1. **`name.fr[$search]` returns HTTP 400** — locked server-side. We use `slug.fr[$search]` with a normalized search string (lowercase + NFD + diacritic strip).
2. **`effects[]` does NOT have a `description` field on the live API** — items have `{from, to, characteristic, elementId, ...}` per effect. Our `mapItem` filters to `description.fr` strings; this returns an empty `stats` array in production. Item picker still works (icon + name + level), but stats lines stay empty. **V1.1 candidate**: compose stat strings from raw effect fields + a characteristic ID lookup table.

Per-item localStorage cache (`dofus-planner.cache.items.v1`) populated on every search; never invalidated in V1.

## Persistence

- Key: `dofus-planner.build.v1`
- Schema: `{ version: 1, cards: Card[] }`
- Debounced 250ms write on any store mutation, `flush: 'sync'` on `$subscribe` so rapid mutations coalesce correctly
- Loose validation on load — corrupt JSON or wrong version falls back to default Lv 1 card
- Card slots without a key (e.g., older payloads pre-Bouclier) load fine: missing keys read as undefined → rendered as empty slot

**Importer / Exporter** added in the top bar: Export downloads `dofus-build-YYYY-MM-DD.json`, Import takes a JSON file (validates version + cards), confirms before replacing the in-memory build.

## Visual identity

Tailwind theme tokens in `tailwind.config.ts`:

| Token | Hex |
|---|---|
| `bg-page` | `#050505` |
| `bg-surface` | `#0a0a0a` |
| `bg-elev` | `#0f0f0f` |
| `bg-slot-empty` | `#0f0f0f` |
| `bg-slot-filled` | `#1f2937` |
| `border-default` | `#262626` |
| `border-subtle` | `#1a1a1a` |
| `border-dashed-empty` | `#2a2a2a` |
| `border-slot-filled` | `#374151` |
| `accent` (`DEFAULT`/`deep`/`deeper`) | `#5BD3A8` / `#2a8568` / `#1a3d2e` |
| `danger` (`DEFAULT`/`soft`) | `#b91c1c` / `#f87171` |
| `text` (`default`/`muted`/`dim`/`faint`/`ghost`) | `#fafafa` / `#a3a3a3` / `#737373` / `#525252` / `#404040` |

Fonts: `font-display` = Bebas Neue (level numbers, section headers, brand wordmark, slot empty labels), `font-sans` = Inter (item names, body), `font-mono` = ui-monospace (level prefix, item level badges, kbd hints).

## Layout & sizing

- Card: 320px wide, content-driven height. 1px `border-default` border, `rounded-xl`, `shadow-[0_4px_32px_rgba(0,0,0,0.4)]`. Active card adds mint ring + glow.
- Connector: 52px wide, `flex-shrink-0`, contains a 36×36 round pill button.
- Connector pill: outline mint idle (with subtle mint glow ring), filled mint on hover/open with stronger glow + scale 1.08.
- Connector popover: Teleport to `body` (escapes timeline-area's `overflow-x: auto` clipping), `position: fixed`, viewport-clamped horizontally with 12px margin, follows the pill via `useElementBounding` if anchored DOM moves.
- Timeline row: `pl-16` (64px) + cards/connectors interleaved + trailing `<div class="w-[50vw] flex-shrink-0">` spacer (NOT `pr-[50vw]`, because flex padding-right is not honored in `scrollWidth`).
- Mini-map: cells are `<button>` with `Lv N` content, click → smooth `scrollTo` centering the corresponding card. No drag-scroll, no viewport indicator.
- Background: dual radial gradients (mint + deep mint) + subtle 1px dot grid.

## Visual deviations from original spec

- **No global zoom**. The spec didn't ask for one. We tried `zoom: 1.2` on body (broke popover positioning) then on `#app` (clipped content off-viewport) and reverted. Remains at default size; bumping individual sizes is the path forward if the user wants larger.
- **`Lv` prefix uses `font-display` (Bebas Neue) at 12px** instead of Inter 9px semibold — more legible at small size.
- **Mini-map shows level inside each cell** (`Lv N`), no viewport indicator, no drag-to-scroll. Click on cell smooth-scrolls the timeline so the card is at viewport center.
- **Connector pill is a 36×36 circle**, no level node, no chip, no "Ajouter" label expansion. Just `+`. Click opens popover.
- **Title/objective field** is the only free-text per-card field; level is a numeric input (1-200, clamped, focus + select-all on edit, anti-double-commit guard on Enter).
- **Per-card delete (×)** in the header top-right with confirm prompt. Clears active/picker UI state if it pointed at the deleted card. Build store re-initializes a fresh Lv 1 card if the last card is removed.

## Known limitations / V1.1 candidates

1. **DofusDB stats lines are empty** in production (effects shape mismatch). Compose from raw fields when V1.1.
2. **Class images not loaded from DofusDB** — the hex frame shows a class abbreviation as fallback. Wire to real image URLs when available.
3. **Single build only** — V1 stores one build under `dofus-planner.build.v1`. Multi-build / named builds is V2.
4. **No undo/redo** — once an item is set, the only way back is manual re-edit.
5. **No keyboard shortcuts** for Vide/Copier (planned `N`/`D` in original spec, not wired).
6. **Stats aggregation** (total Vita, Force, etc. across all equipped items) — not in V1.
7. **Sub-stats** (parchos, runes, Forgemagie, exos) — out of scope.
8. **Item icons** — DofusDB `img` URLs render correctly when present; some items may have empty/missing icons.
9. **`useDragScroll` composable is dead code** since we removed the mini-map drag interaction. Kept for now (might be useful in V1.1); can be deleted if not.

## How to run

```bash
npm install            # one-time
npm run dev            # http://localhost:5173/
npm run typecheck      # vue-tsc, must exit 0
npm run test:run       # vitest, 30 tests
npm run build          # vue-tsc + vite build, dist/ → 118 KB JS / 24 KB CSS
npm run preview        # serve dist/
```
