# Dofus level planner — As-Built

Status: V1 + V2 shipped. **41 tests** passing (30 V1 + 7 useShoppingList + 4 ItemRow), typecheck clean, prod build green (137 KB JS / 26 KB CSS, gzipped 49 KB / 5 KB).
Last updated: 2026-05-04.

This document reflects what was actually built. Original design specs:
- `superpowers/specs/2026-05-03-v1-visual-design.md` — V1 timeline + Switch
- `superpowers/specs/2026-05-04-purchase-planner-design.md` — V2 purchase planner

Where any spec disagrees with this doc, **this doc wins**.

## Stack

- Vue 3.5 + Vite 6 + TypeScript 5
- Pinia 2 (build store + UI store)
- Tailwind 3 (custom theme tokens)
- VueUse 11 (`useElementBounding`, `useEventListener`, `useDebounceFn`, `onClickOutside`, `useWindowSize`)
- Vitest 2 + @vue/test-utils + jsdom (41 unit/component tests)
- Fonts: Bebas Neue + Inter via Google Fonts
- No `uuid` dep — `crypto.randomUUID()` with fallback

## File map

```
src/
├── App.vue                          root layout (TopBar + conditional Timeline+MiniMap | Planner + Pickers)
├── main.ts                          createApp + Pinia + usePersistence bootstrap
├── style.css                        tailwind + base layer
├── env.d.ts                         vite client + .vue module decl
├── types/
│   ├── classes.ts                   ClassId union (18 classes), ClassDef
│   ├── slots.ts                     SlotType union (10 slots), SLOT_ORDER, DOFUS_COUNT, SLOT_LABEL
│   ├── build.ts                     ItemRef, Card, Build (version: 1)
│   └── rooms.ts                     RoomId, NpcId, ROOM_ORDER, NPC_ORDER, NPC_LABEL,
│                                    ROOM_NPCS, TYPE_ID_DOFUS, TYPE_ID_TROPHEE, slotToNpc, levelToRoom
├── data/
│   ├── classes.ts                   18 ClassDef entries
│   ├── slot-icons.ts                10 inline SVG glyphs per slot type
│   ├── npc-icons.ts                 11 NPC SVG glyphs (reuse slot ones + bespoke trophée/dofus)
│   └── dofusdb.ts                   client: fetchItemsBySlot, fetchDofusOrTrophees,
│                                    fetchItem, SLOT_TO_TYPE_IDS, DOFUS_TROPHEE_TYPE_IDS;
│                                    Item now includes `typeId: number`
├── stores/
│   ├── build.ts                     cards[] + setClass/setLevel/setTitle/setSlot/setDofus
│   │                                + addEmptyCardAfter/addCopyCardAfter/removeCard/
│   │                                resetBuild/replaceCards + makeFreshFirstCard
│   └── ui.ts                        activeCardId, itemPickerTarget, classPickerCardId,
│                                    viewMode ('build' | 'switch' | 'purchase') + setters
├── composables/
│   ├── usePersistence.ts            load + debounced 250ms save to localStorage
│   ├── useItemCatalog.ts            useItemSearch, ensureItem, ensureItems,
│   │                                getCachedItem, populateCache, isOverLeveled
│   ├── useDragScroll.ts             generic pointer drag-to-scroll (currently unused)
│   └── useShoppingList.ts           bucketing computed: ShoppingList from build cards
├── components/
│   ├── AppTopBar.vue                brand + Build|Switch|Achats toggle + Importer/Exporter/Nv build
│   ├── AppTimeline.vue              Build-only horizontal scroll area, exposes scrollRef
│   ├── AppSwitchView.vue            Switch carousel: peek-prev | active card | peek-next
│   ├── AppMiniMap.vue               clickable cells (Lv N), always sets active card; scrollTo only if scrollRef
│   ├── AppPurchasePlanner.vue       V2 screen: header + room tabs + NPC grid
│   ├── EquipmentCard.vue            full card (Build mode + first card in Switch carousel)
│   ├── EquipmentCardDiff.vue        diff card (Switch carousel, idx >= 1)
│   ├── CardHeader.vue               class logo + editable level + optional title + delete
│   ├── ClassLogo.vue                hex frame, pulse on null classId, configurable size
│   ├── EquipmentSlot.vue            full slot row (6 states, dblclick clears)
│   ├── DofusCell.vue                small slot variant (div+role, dblclick or Del/Backspace clears)
│   ├── Connector.vue                "+" pill (36×36 circle), useElementBounding
│   ├── ConnectorPopover.vue         Teleport to body, viewport-clamped fixed position
│   ├── ItemPickerSheet.vue          right side sheet 540px (search + filters + list)
│   ├── ClassPickerModal.vue         centered modal 6×3 grid of 18 classes
│   ├── NpcCard.vue                  V2 NPC header + count + ItemRow list
│   └── ItemRow.vue                  V2 item line with copy-to-clipboard ⧉ + ✓ feedback
└── utils/
    └── id.ts                        randomId() wrapper

tests/
├── setup.ts                         jsdom + localStorage.clear() between tests
├── stores/build.spec.ts             11 tests covering all mutations
├── composables/usePersistence.spec  5 tests on load/save/debounce/version/corrupt
├── composables/useDragScroll.spec   4 tests on pure scroll math
├── composables/useShoppingList.spec 7 tests on V2 bucketing rules
├── data/dofusdb.spec.ts             6 tests on URL building + mapping + dofus fetch
└── components/
    ├── EquipmentSlot.spec.ts        4 tests on over-leveled state
    └── ItemRow.spec.ts              4 tests on copy-to-clipboard + feedback
```

## View modes

The app has three top-level view modes selected from the segmented control in the top bar (`Build | Switch | Achats`). Default: `build`. State lives in `useUiStore`'s `viewMode` ref.

### Build mode
Each card renders as `EquipmentCard`: full equipment list (10 slot rows + 6 dofus cells). All slots clickable to open the item picker; double-click clears.

### Switch mode (carousel planning view)
Switch is **not** the timeline. It's a **carousel** centered on the active card with peeks of prev/next on either side, navigated with arrow buttons, the keyboard, or the mini-map.

- **Active card** centered, **576px wide** (vs 320px in Build), rendered as `EquipmentCard` for the first card (the baseline) or `EquipmentCardDiff` (vs the previous card) for any other.
- **Prev / Next peeks**: same card content, `transform: scale(0.55)` + `opacity-40` (60% on hover), clickable to navigate. Peek labels above each: `‹ Précédent · Lv X` / `Suivant · Lv Y ›` in Bebas Neue 20px mint.
- **Active card is `pointer-events-none`**: purely visual in Switch mode. No editing, no slot clicks, no header clicks. The × delete button is hidden (`:deep(.card-delete-btn) { display: none }`).
- **Slide+fade transition** between cards (260ms slide on entering with z-index 2, 100ms fade-out on leaving with z-index 1, no transform on leaving). Direction inferred via a `flush: 'sync'` watch on `activeIndex` so it's correct for both arrow clicks AND mini-map jumps.
- **Card width is CSS-var driven** (`--card-width`), set on the carousel container. Build mode keeps the default 320px.
- **Mini-map at the bottom** (same component as Build mode, click to jump): the `gotoCard` action always calls `ui.setActiveCard` and only scrolls if a `scrollRef` was passed (Build), so it natively works in Switch with `:scroll-ref="null"`.
- **Diff card content**: same red-old/green-new visual as before — `[icon] OldName → [icon] NewName` for changed slots, dimmed `opacity-35` for unchanged ones, dofus changes flagged with mint border + tooltip.
- **Card text always left-aligned** (`text-left` on the card root) — fixes a default `text-align: center` inheritance from the peek `<button>` parent that was centering item names in the side cards.

### Achats mode (V2 purchase planner)
Replaces the timeline area entirely (mini-map hidden). Layout:
- **Header strip**: title `Planificateur d'achat` (Bebas Neue 18px) + global stat in mono (`X items · Y salles actives`).
- **Room tabs strip**: 5 tabs `1-50 | 51-100 | 101-150 | 151-199 | 200`, each with a `(N)` count badge. Empty rooms (count = 0) disabled with `opacity-40`. Default active tab = first non-empty room. A `watchEffect` reroutes selection if the current tab becomes empty.
- **Tab content**: `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))` of `<NpcCard>`s for the active room.
- **Empty global state**: when the build has zero items, a centered CTA `Ajoute des items à ta timeline pour générer la liste de courses` + button `← Retour à Build`.

## V2 — Purchase planner architecture

### Event model

5 rooms gated by character level: `1-50, 51-100, 101-150, 151-199, 200`. Each room has one NPC per equipment type, with two exceptions:
- **1-50**: no trophée NPC (9 NPCs total).
- **200**: trophée NPC replaced by dofus/prysmardites NPC (10 NPCs).
- **51-100, 101-150, 151-199**: 10 NPCs each (the 9 + trophée).

Configuration lives in `ROOM_NPCS` in `src/types/rooms.ts`.

### NPCs and slot mapping

11 distinct NPC ids (`NpcId` union):
- 9 equipment NPCs: `coiffe`, `cape`, `amulette`, `anneau` (collapses anneau1 + anneau2), `ceinture`, `bottes`, `arme`, `bouclier`, `familier`
- `trophee` (rooms 51-199)
- `dofus` (room 200 only — labeled "Dofus / Prysm." in UI)

Mapping from `SlotType` → `NpcId` via `slotToNpc(slot)`. Mapping from `card.level` → candidate `RoomId` via `levelToRoom(level)`.

### Bucketing logic (`useShoppingList`)

Pure-function `computed` returning a `ShoppingList`:
```ts
interface ShoppingList {
  rooms: Record<RoomId, Partial<Record<NpcId, Item[]>>>;
  totals: { items: number; activeRooms: number; perRoom: Record<RoomId, number>; };
}
```

Algorithm:
1. Walk timeline left→right. Skip cards with `level === null`.
2. For each filled slot/dofus cell, get the `itemId` and its cached `Item` (via `getCachedItem`). If not cached, fire `ensureItem(id)` async (the computed re-runs when the cache fills).
3. **First-occurrence wins**: each `itemId` is bucketed once, in the room of the first card it appears on.
4. Equipment slots → `slotToNpc(slot)` + `levelToRoom(card.level)` for the room.
5. Dofus[] cells (mixed dofus + trophée) disambiguated by `item.typeId`:
   - `typeId === 23` (TYPE_ID_DOFUS) → NPC `dofus`, room **forced** to `200`.
   - `typeId === 151` (TYPE_ID_TROPHEE) → NPC `trophee`, room **bumped** from `1-50` to `51-100` (no trophée NPC in 1-50).
6. Items in each `(room, npc)` cell sorted by `levelRequired` ascending.

7 TDD tests in `tests/composables/useShoppingList.spec.ts` cover: empty timeline, single-card multi-slot, item kept across cards, trophée bump, dofus force, anneau1+anneau2 dedup, level sort.

### Copy interaction

`ItemRow` exposes both the item name (clickable) and a `⧉` button (`aria-label="Copier le nom"`). Click → `navigator.clipboard.writeText(item.name)` (with `<textarea> + execCommand('copy')` fallback for non-secure contexts). Visual feedback: button content swaps `⧉ → ✓` with mint background for 1.2s, then resets. 4 TDD tests cover the rendering and copy behavior.

## Interactions

| Action | Result |
|---|---|
| Click a slot/dofus (Build/Switch) | Opens the item picker side sheet |
| Double-click a slot/dofus (Build/Switch) | Clears the slot. If picker was opened by the first click, it auto-closes. |
| Hover a filled slot | Reveals × clear button on the right |
| Hover a filled dofus cell | Reveals × clear button at top-right corner |
| Focus a dofus cell + Delete/Backspace | Clears |
| Click "+" between cards | Popover: `Card vide` (slots empty, class inherited) / `Copier la précédente` (clone with level+1) |
| Click class logo (any card) | Opens class picker modal — affects only that card |
| Click level number | Inline edit (1–200, focus + select-all). Enter / blur commits, Esc cancels. |
| Click title (or empty title CTA) | Inline edit, max 30 chars |
| Click × in card header | Confirm dialog → removes the card |
| Click a mini-map cell (Build/Switch) | Smooth-scrolls the timeline so that card is centered |
| Click Build / Switch / Achats in top bar | Switches view mode |
| Click a room tab in Achats | Selects that room (no-op if empty) |
| Click ⧉ or item name in Achats | Copies item name to clipboard, ✓ feedback 1.2s |
| Click `Retour à Build` (empty Achats state) | Switches to Build mode |
| Click Importer in top bar | File picker → JSON validate → confirm replace → populate cache + ensureItems |
| Click Exporter in top bar | Downloads `dofus-build-YYYY-MM-DD.json` (cards + items snapshot) |
| Click Nouveau build | Confirm → resets to single empty Lv 1 card |
| Esc | Closes picker / modal |

## DofusDB integration

Public API: `https://api.dofusdb.fr` (Feathers-style query string).

Two gotchas verified at runtime:
1. **`name.fr[$search]` returns HTTP 400** — locked server-side. We use `slug.fr[$search]` with a normalized search string (lowercase + NFD + diacritic strip).
2. **`effects[]` does NOT have a `description` field on the live API** — items have `{from, to, characteristic, elementId, ...}` per effect. Our `mapItem` filters to `description.fr` strings; this returns an empty `stats` array in production. Item picker still works (icon + name + level), but stats lines stay empty.

`Item` interface includes `typeId: number` (V2 needed it to disambiguate dofus vs trophée in bucketing).

Per-item localStorage cache (`dofus-planner.cache.items.v1`) populated on every search; never invalidated. `populateCache(items: Item[])` and `ensureItems(ids: number[])` are exposed for the import flow.

## Persistence

- Key: `dofus-planner.build.v1`
- Schema: `{ version: 1, cards: Card[] }`
- Debounced 250ms write on any store mutation, `flush: 'sync'` on `$subscribe` so rapid mutations coalesce correctly
- Loose validation on load — corrupt JSON or wrong version falls back to default Lv 1 card

**Importer / Exporter** in the top bar.

Export payload schema (self-contained):
```json
{
  "version": 1,
  "cards": [ /* Card[] */ ],
  "items": [ /* Item[] — all items used in the build, snapshotted from the local cache */ ]
}
```

Import flow: file picker → JSON validate → confirm → `populateCache(parsed.items)` → `ensureItems(allItemIds)` async → `replaceCards(parsed.cards)`.

`viewMode` is in-memory only (resets to `'build'` on reload — intentional).

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

Fonts: `font-display` = Bebas Neue (level numbers, section headers, brand wordmark, slot empty labels, NPC labels, room tab labels), `font-sans` = Inter (item names, body), `font-mono` = ui-monospace (level prefix, item level badges, count badges, kbd hints).

## Layout & sizing

- Card: 320px wide, content-driven height. Border `border-default`, `rounded-xl`, drop shadow. Active card adds mint ring + glow.
- **Card content sizes bumped ~30%** from spec defaults: slot icons 32×32 (was 24), slot row text 14px (was 11), section headers 14px (was 11), Lv prefix 16px (was 9), Lv number 36px (was 28), title 16px (was 12), class logo 62×62 (was 48), card body padding 16px (was 14).
- Connector: 52px wide, `flex-shrink-0`, contains a 36×36 round pill button.
- Connector popover: Teleport to `body` (escapes `overflow-x: auto` clipping), `position: fixed`, viewport-clamped horizontally, follows the pill via `useElementBounding`.
- Timeline row: `pl-16` + cards/connectors interleaved + trailing `<div class="w-[50vw] flex-shrink-0">` spacer.
- Mini-map: `Lv N` clickable cells, smooth-scrolls the timeline. No drag-scroll, no viewport indicator.
- **V2 NpcCard**: `bg-bg-surface` border, `rounded-lg`, `p-3.5`. Header row 26×26 icon + Bebas Neue 12px label + mono `×N` count badge.
- **V2 ItemRow**: 24×24 icon + flex-1 truncated name + mono `lv N` badge + 24×24 ⧉/✓ button.
- Background: dual radial gradients (mint + deep mint) + subtle 1px dot grid.

## Deviations from original specs

- **No global zoom**. Tried `zoom: 1.2` on body (broke popover positioning) then on `#app` (clipped content off-viewport) and reverted. Cards instead use bumped CSS values directly.
- **`Lv` prefix uses Bebas Neue 16px** instead of Inter 9px — more legible at small size.
- **Mini-map shows `Lv N` inside each cell**, no viewport indicator, no drag-scroll. Click smooth-scrolls (Build) or just sets active (Switch).
- **Connector pill is a 36×36 circle**, no level node, no chip, no "Ajouter" label expansion.
- **DofusCell wrapper is a `<div role="button">`** not a `<button>` — fixes nested-button HTML invalidity.
- **Per-card delete (×)** in the header top-right with confirm prompt; hidden in Switch (read-only mode).
- **Switch is a carousel**, not a sub-mode of the timeline. The original spec assumed a horizontal-timeline-with-diff-cards; user feedback drove the redesign to a centered carousel + arrow nav.
- **No "Équipement" section header** inside the cards (the slot icons make it obvious).
- **No "Étape X / Y · Lv X" position label** in Switch view — the active card and mini-map are enough orientation.

## Features added beyond original V1 spec

- Bouclier slot (typeId 82) inserted between Arme and Familier
- Switch mode with red/green per-slot diff visualization, full editing affordances
- Importer / Exporter JSON in top bar (self-contained — items snapshot bundled in export)
- Per-card delete with confirm
- Double-click to clear slots and dofus
- Delete/Backspace shortcut on focused dofus cells
- Editable level / title with focus management
- Class picker modal (per-card scope)
- **V2 — Purchase planner (Achats mode)** with bucketing, room tabs, copy-to-clipboard
- **V2.1 — Switch redesigned as a carousel**: 576px central card (CSS-var width), peek-prev / peek-next, slide-fade transition, keyboard nav, mini-map jump, purely visual (read-only)

## Known limitations / future candidates

1. **DofusDB stats lines empty** in production (effects shape mismatch). Compose from raw fields if needed.
2. **Class images not loaded from DofusDB** — hex frame shows abbreviation as fallback.
3. **Single build only** — multi-build / named builds is V3.
4. **No undo/redo** — manual re-edit (or import a saved JSON).
5. **No keyboard shortcuts** for Vide/Copier popover.
6. **Stats aggregation** (total Vita, Force, etc.) — not implemented.
7. **Sub-stats** (parchos, runes, Forgemagie, exos) — out of scope.
8. **`useDragScroll` composable is dead code** since mini-map drag was removed. Kept for now.
9. **Switch mode dofus diff** shows the new item with a mint border but no inline old/new (cells too small). Tooltip on hover shows the old name.
10. **V2 cold-cache UX**: opening the planner right after import on a fresh device may show a partial list for ~1–3s while items fetch async.
11. **V2 quantity**: same item used twice on the same card is listed once. Players know to buy 2 copies. Quantity badge could be future polish.
12. **V2 no "Copy all"** per NPC or per room. Per-item copy only.
13. **V2 no "mark as bought" workflow** — the planner is a snapshot, not a tracker.

## How to run

```bash
npm install            # one-time
npm run dev            # http://localhost:5173/
npm run typecheck      # vue-tsc, must exit 0
npm run test:run       # vitest, 41 tests
npm run build          # vue-tsc + vite build, dist/ → 137 KB JS / 26 KB CSS
npm run preview        # serve dist/
```
