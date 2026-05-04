# Dofus level planner — V1 As-Built

Status: shipped + V1.1 polish in. 30 tests passing, typecheck clean, prod build green (127 KB JS / 26 KB CSS, 46 KB / 5 KB gzipped).
Last updated: 2026-05-04.

This document reflects what was actually built. The original design spec at `superpowers/specs/2026-05-03-v1-visual-design.md` is preserved for design intent. Where the two disagree, this doc wins.

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
│   └── ui.ts                        activeCardId, itemPickerTarget, classPickerCardId,
│                                    viewMode ('build' | 'switch') + setters
├── composables/
│   ├── usePersistence.ts            load + debounced 250ms save to localStorage
│   ├── useItemCatalog.ts            useItemSearch (SearchTarget = SlotType | 'dofus' | null),
│   │                                ensureItem, getCachedItem, isOverLeveled
│   └── useDragScroll.ts             generic pointer drag-to-scroll (currently unused)
├── components/
│   ├── AppTopBar.vue                brand + Build/Switch toggle + Importer / Exporter / Nouveau build
│   ├── AppTimeline.vue              horizontal scroll area, exposes scrollRef, conditional
│   │                                EquipmentCard / EquipmentCardDiff based on viewMode
│   ├── AppMiniMap.vue               clickable cells (Lv N), centers card via scrollTo
│   ├── EquipmentCard.vue            full card (Build mode + first card always)
│   ├── EquipmentCardDiff.vue        diff card (Switch mode, idx >= 1)
│   ├── CardHeader.vue               class logo + editable level + optional title + delete
│   ├── ClassLogo.vue                hex frame, pulse on null classId, configurable size
│   ├── EquipmentSlot.vue            full slot row (6 states, dblclick clears)
│   ├── DofusCell.vue                small slot variant (div+role, dblclick or Del/Backspace clears)
│   ├── Connector.vue                "+" pill (36×36 circle), useElementBounding
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
| dofus / trophée | 23, 151 |

## View modes

The app has two view modes selected from the top bar segmented control (`Build` / `Switch`). Default: `build`.

### Build mode
Each card renders as `EquipmentCard`: full equipment list (10 slot rows + 6 dofus cells). All slots clickable to open the item picker; double-click clears.

### Switch mode (planning view)
The first card always renders as `EquipmentCard` (it's the baseline). Cards 1+ render as `EquipmentCardDiff`, comparing against the previous card:

- **Same vertical layout as Build** (10 slot rows + 6 dofus cells), so card heights stay consistent across modes.
- **Unchanged slots**: dimmed at `opacity-35` (hover lifts to `opacity-60`). Standard single-item layout.
- **Changed slots**: full opacity, side-by-side `[icon] OldName → [icon] NewName`.
  - Old item: red (`text-danger-soft #f87171`), red border on icon, line-through on name
  - Arrow `→`: mint accent
  - New item: green (`text-accent #5BD3A8`), mint border on icon
- **Class change** (rare since class is per-card): a compact hint at the top of the card body with the same red/green pattern.
- **Dofus row**: same 6-cell layout as Build. Unchanged dimmed, changed get a mint border + `0 0 0 1px` mint glow. Tooltip on hover shows the previous item.
- **All rows clickable** in Switch mode too — clicking a slot (changed or unchanged) opens the picker, double-click clears, same as Build.

## Interactions

| Action | Result |
|---|---|
| Click a slot/dofus (any mode) | Opens the item picker side sheet |
| Double-click a slot/dofus (any mode) | Clears the slot. If picker was opened by the first click, it auto-closes. |
| Hover a filled slot | Reveals × clear button on the right |
| Hover a filled dofus cell | Reveals × clear button at top-right corner |
| Focus a dofus cell + Delete/Backspace | Clears |
| Click "+" between cards | Opens popover: `Card vide` (slots empty, class inherited) / `Copier la précédente` (clone with level+1) |
| Click class logo (any card) | Opens class picker modal — affects only that card |
| Click level number | Inline edit (text input, inputmode numeric, 1–200, auto-focus + select-all). Enter / blur commits, Esc cancels. |
| Click title (or empty title CTA) | Inline edit, max 30 chars |
| Click × in card header | Confirm dialog → removes the card. Last card removed → store re-inits a fresh Lv 1 card. |
| Click a mini-map cell | Smooth-scrolls the timeline so that card is centered in the viewport |
| Click Importer in top bar | File picker → JSON validate → confirm replace |
| Click Exporter in top bar | Downloads `dofus-build-YYYY-MM-DD.json` |
| Click Nouveau build | Confirm → resets to single empty Lv 1 card |
| Esc | Closes picker / modal |

The card root has `select-none` so casual clicks don't grab text. Inputs (level/title) override and remain selectable for editing.

## DofusDB integration

Public API: `https://api.dofusdb.fr` (Feathers-style query string).

Two gotchas verified at runtime:
1. **`name.fr[$search]` returns HTTP 400** — locked server-side. We use `slug.fr[$search]` with a normalized search string (lowercase + NFD + diacritic strip).
2. **`effects[]` does NOT have a `description` field on the live API** — items have `{from, to, characteristic, elementId, ...}` per effect. Our `mapItem` filters to `description.fr` strings; this returns an empty `stats` array in production. Item picker still works (icon + name + level), but stats lines stay empty. **V1.2 candidate**: compose stat strings from raw effect fields + a characteristic ID lookup table.

Per-item localStorage cache (`dofus-planner.cache.items.v1`) populated on every search; never invalidated in V1.

## Persistence

- Key: `dofus-planner.build.v1`
- Schema: `{ version: 1, cards: Card[] }`
- Debounced 250ms write on any store mutation, `flush: 'sync'` on `$subscribe` so rapid mutations coalesce correctly
- Loose validation on load — corrupt JSON or wrong version falls back to default Lv 1 card
- Card slots without a key (e.g., older payloads pre-Bouclier) load fine: missing keys read as undefined → rendered as empty slot

**Importer / Exporter** in the top bar.

Export payload schema (self-contained):
```json
{
  "version": 1,
  "cards": [ /* Card[] */ ],
  "items": [ /* Item[] — all items used in the build, snapshotted from the local cache */ ]
}
```

The `items` array is a snapshot of every `itemId` referenced by `cards.slots` and `cards.dofus` at export time, pulled from the local item cache (`dofus-planner.cache.items.v1`). This means imports work on a fresh device or after a wiped cache.

Import flow:
1. File picker (`<input type="file">` is appended to DOM with off-screen positioning so Firefox/Safari fire `change`).
2. JSON.parse + version/cards validation.
3. Confirm prompt with card count.
4. `populateCache(parsed.items)` if the export included an items snapshot.
5. `ensureItems(allItemIds)` fires async fetches for any ids not in cache (back-compat with old exports without `items`, or partial cache misses). Cards render reactively as items resolve.
6. `replaceCards(parsed.cards)` swaps the build.

Robustness tweaks: `JSON.parse(JSON.stringify(build.cards))` flattens any Pinia/Vue reactive proxies before serialization; `<a>` element kept in DOM for 250ms after click so the browser can start the download; `try/catch` shows the actual error via `alert` if anything fails.

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
- **Card content sizes bumped ~30% from spec defaults** (per user feedback): slot icons 32×32 (was 24), slot row text 14px (was 11), section headers 14px (was 11), Lv prefix 16px (was 9), Lv number 36px (was 28), title 16px (was 12), class logo 62×62 (was 48), card body padding 16px (was 14). Card width itself stays 320px — text truncates if needed.
- Connector: 52px wide, `flex-shrink-0`, contains a 36×36 round pill button.
- Connector pill: outline mint idle (with subtle mint glow ring), filled mint on hover/open with stronger glow + scale 1.08.
- Connector popover: Teleport to `body` (escapes timeline-area's `overflow-x: auto` clipping), `position: fixed`, viewport-clamped horizontally with 12px margin, follows the pill via `useElementBounding` if anchored DOM moves.
- Timeline row: `pl-16` (64px) + cards/connectors interleaved + trailing `<div class="w-[50vw] flex-shrink-0">` spacer (NOT `pr-[50vw]`, because flex padding-right is not honored in `scrollWidth`).
- Mini-map: cells are clickable, content `Lv N`, click → smooth `scrollTo` centering the corresponding card. No drag-scroll, no viewport indicator.
- Background: dual radial gradients (mint + deep mint) + subtle 1px dot grid.

## Visual deviations from original spec

- **No global zoom**. Tried `zoom: 1.2` on body (broke popover positioning) then on `#app` (clipped content off-viewport) and reverted. Cards instead use bumped CSS values (~+30%) directly on relevant elements.
- **`Lv` prefix uses `font-display` (Bebas Neue) at 16px** (after bump) instead of Inter 9px semibold — more legible at small size.
- **Mini-map shows level inside each cell** (`Lv N`), no viewport indicator, no drag-to-scroll. Click on cell smooth-scrolls the timeline so the card is at viewport center.
- **Connector pill is a 36×36 circle**, no level node, no chip, no "Ajouter" label expansion. Just `+`. Click opens popover.
- **DofusCell wrapper is a `<div role="button">` not a `<button>`** — fixed nested-button HTML invalidity that was preventing the × clear handler from firing reliably.
- **Per-card delete (×)** in the header top-right with confirm prompt. Clears active/picker UI state if it pointed at the deleted card. Build store re-initializes a fresh Lv 1 card if the last card is removed.

## Features added beyond original V1 spec

- **Bouclier slot** (typeId 82) inserted between Arme and Familier
- **Switch mode** with red/green per-slot diff visualization, full editing affordances
- **Importer / Exporter** JSON in top bar (self-contained — items snapshot bundled in export, cache repopulated + missing fetched on import)
- **Per-card delete** with confirm
- **Double-click to clear** slots and dofus
- **Delete/Backspace shortcut** on focused dofus cells
- **Editable level / title** with proper focus management (template ref + nextTick + select-all + anti-double-commit guards)
- **Class picker modal** (per-card scope with explicit footer note)

## Known limitations / V1.2 candidates

1. **DofusDB stats lines are empty** in production (effects shape mismatch). Compose from raw fields when V1.2.
2. **Class images not loaded from DofusDB** — the hex frame shows a class abbreviation as fallback. Wire to real image URLs when available.
3. **Single build only** — V1 stores one build under `dofus-planner.build.v1`. Multi-build / named builds is V2.
4. **No undo/redo** — once an item is set, the only way back is manual re-edit (or import a saved JSON).
5. **No keyboard shortcuts** for Vide/Copier popover (planned `N`/`D` in original spec, not wired).
6. **Stats aggregation** (total Vita, Force, etc. across all equipped items) — not in V1.
7. **Sub-stats** (parchos, runes, Forgemagie, exos) — out of scope.
8. **Item icons** — DofusDB `img` URLs render correctly when present; some items may have empty/missing icons.
9. **`useDragScroll` composable is dead code** since we removed the mini-map drag interaction. Kept for now (might be useful later); can be deleted if not.
10. **Switch mode dofus diff** shows the new item with a mint border but doesn't visually surface the old item the way slot rows do (icon-only cells too small for side-by-side). Tooltip on hover shows the old name. Acceptable for V1; could rework with overlay if it becomes a pain point.

## How to run

```bash
npm install            # one-time
npm run dev            # http://localhost:5173/
npm run typecheck      # vue-tsc, must exit 0
npm run test:run       # vitest, 30 tests
npm run build          # vue-tsc + vite build, dist/ → 127 KB JS / 26 KB CSS
npm run preview        # serve dist/
```
