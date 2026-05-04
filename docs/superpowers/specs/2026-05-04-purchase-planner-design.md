# Purchase planner (planificateur d'achat) — V2 design

Status: design complete, awaiting user review before implementation planning.
Date: 2026-05-04.

## Concept

A 3rd top-level view of the Dofus level planner, dedicated to **shopping for an event with 5 level-gated rooms**. The screen reads the user's existing build timeline and produces a per-room, per-NPC list of unique items to buy, with one-click copy of each item name (for pasting into the in-game market search).

## Event model

The event has **5 rooms** gated by character level range:

- `1-50`
- `51-100`
- `101-150`
- `151-199`
- `200`

Each room has one NPC per equipment type (one NPC sells coiffes, one sells capes, etc.). The slot-to-NPC map collapses both anneau slots into a single "Anneau" NPC. The dofus[] array splits into "Trophée" NPC and "Dofus / Prysmardites" NPC based on `item.typeId` (23 = dofus, 151 = trophée — verified against the live DofusDB `/item-types` endpoint).

NPC availability per room:

| Room | Available NPCs |
|---|---|
| 1-50 | coiffe, cape, amulette, anneau, ceinture, bottes, arme, bouclier, familier (9 — **no trophée**) |
| 51-100 | the 9 above + trophée (10) |
| 101-150 | same as 51-100 (10) |
| 151-199 | same as 51-100 (10) |
| 200 | the 9 above + dofus/prysmardites (trophée NPC **replaced** by dofus NPC, 10) |

## Bucketing logic

Input: the build's `cards: Card[]` (timeline order, left to right).
Output: a `ShoppingList` value (see the `useShoppingList` composable section below for the type).

Algorithm:

1. **Walk the timeline left-to-right**. For each card:
   - Skip cards with `level === null`.
   - For each filled slot in `card.slots` (the 10 equipment slots) and each filled cell in `card.dofus[]` (6 cells), get the `itemId`.
   - Look up the cached `Item` for that id (`getCachedItem` from `useItemCatalog`). If the item isn't cached, trigger an async `ensureItem(id)` so it lands in the cache reactively. For the current bucketing pass, the item is skipped (the row would be missing data needed to determine the NPC for dofus[] entries and the level for sorting); the computed re-runs when the cache updates and the item then appears. **Cold-cache UX note**: opening the planner right after import on a fresh device may show a partial list for ~1–3s while items fetch in the background. Acceptable for V2; a discrete loading indicator on the global stat line could be added in V2.1 if it feels rough.
2. **First-occurrence wins**. For each unique `itemId`, only the first card it appears on counts. Subsequent appearances are ignored. This produces a `(itemId, firstCardLevel, slotOrigin, item.typeId)` record per unique item.
3. **Determine the candidate NPC**:
   - From a slot (`coiffe`, `cape`, `amulette`, `anneau1`, `anneau2`, `ceinture`, `bottes`, `arme`, `bouclier`, `familier`) → the equivalent NPC name (`anneau1`/`anneau2` collapse into `'anneau'`, others map 1:1).
   - From a dofus[] cell → `'dofus'` if `item.typeId === 23`, `'trophee'` if `item.typeId === 151`. Anything else from the dofus[] array (unexpected typeId) is logged and silently dropped.
4. **Determine the candidate room** from the first-card level:
   - `level === 200` → room `200`
   - `level >= 151` → room `151-199`
   - `level >= 101` → room `101-150`
   - `level >= 51` → room `51-100`
   - `level >= 1` → room `1-50`
5. **Apply exceptions** (the items go to the room where they are actually buyable, no warnings):
   - If candidate NPC is `trophee` and candidate room is `1-50` → room is bumped to `51-100`.
   - If candidate NPC is `dofus` → room is forced to `200`, regardless of the candidate room.
6. **Bucket** the item into the resulting `(room, npc)` cell.

Within each `(room, npc)` cell, items are sorted by `levelRequired` ascending.

A `useShoppingList` composable exposes the reactive `ShoppingList` value derived via `computed` from `useBuildStore().cards` + `useItemCatalog`'s cache. It also exposes per-room totals and a global total for badges/labels.

## Layout

### Top bar — extended mode toggle

The existing `Build | Switch` segmented control becomes `Build | Switch | Achats`. `useUiStore`'s `viewMode` type is widened from `'build' | 'switch'` to `'build' | 'switch' | 'purchase'`. Default stays `'build'`. The mode persists with the rest of the UI state across reloads (Pinia store is in-memory; it resets to default on reload, which is fine since the user's primary state is the build).

### Achats screen (`viewMode === 'purchase'`)

Replaces the timeline area entirely (the AppMiniMap is hidden in this mode). Layout:

1. **Header strip** (~64px tall, `bg-bg-surface` border-bottom):
   - Left: title `Planificateur d'achat` in Bebas Neue 18px uppercase tracking-[0.2em].
   - Right: global stat in mono 11px — `{X} items à acheter · {Y} PNJ · {Z} salles actives`.

2. **Room tabs strip** (sticky below header, ~44px tall):
   - 5 tabs in fixed order: `1-50`, `51-100`, `101-150`, `151-199`, `200`.
   - Each tab: room label in Bebas Neue 13px tracking-[0.18em] uppercase + a count badge `(N)` in mono 10px right-aligned. Active tab gets a 2px mint underline + bg `bg-bg-surface`.
   - Empty rooms (count = 0) render with `opacity-40` + `cursor-not-allowed` and don't react to clicks.
   - Default active tab on enter: the **first non-empty room** in fixed order. If all are empty, `1-50` is shown with empty state.

3. **Tab content** (the active room's NPCs):
   - `display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; padding: 24px`
   - One `<NpcCard>` per NPC that has at least one item in this room. NPCs with zero items are not rendered.
   - NPC order within the grid follows the canonical slot order (coiffe, cape, amulette, anneau, ceinture, bottes, arme, bouclier, familier, trophée|dofus).

4. **Empty states**:
   - **No items in active room (rare since empty tabs aren't clickable, but defensive)**: `<div>Aucun item à acheter dans cette salle.</div>` centered, muted.
   - **Build has zero items at all** (every slot empty across all cards): instead of the tab strip + grid, render a centered call-to-action `Ajoute des items à ta timeline pour générer la liste de courses` with a button `← Retour à Build` that flips `viewMode` back.

## Components

### `NpcCard` (`src/components/NpcCard.vue`)

Renders one NPC + its items.

```
┌─────────────────────────────────────────────────┐
│ [⛑] COIFFE                              ×3      │  ← header
├─────────────────────────────────────────────────┤
│ [icon] Item A             lv 21  [⧉]            │  ← ItemRow ×N
│ [icon] Item B             lv 35  [⧉]            │
│ [icon] Item C             lv 48  [⧉]            │
└─────────────────────────────────────────────────┘
```

- Container: `bg-bg-surface`, border `border-default`, `rounded-lg`, padding 14px, `flex flex-col gap-2`.
- Header: flex row, gap 10px:
  - 26×26 square with the NPC's icon glyph, `bg-bg-slot-filled` + border `border-slot-filled`, color `text-muted`. Icon resolution: a small map `NPC_ICON_SVG: Record<NpcId, string>` lives in a new module `src/data/npc-icons.ts` and reuses entries from `slot-icons.ts` for the slot NPCs (`anneau` → reuses `anneau1`'s circle glyph) plus two new entries: `dofus` (a small diamond `◇` SVG) and `trophee` (a star/medal SVG). This keeps `slot-icons.ts` slot-typed and adds an NPC-typed sibling.
  - NPC name: Bebas Neue 12px uppercase tracking-[0.2em] color `accent` at 85% opacity.
  - Count badge: pushed to the right via `ml-auto`. Mono 10px, `bg-bg-page` + `border-border-default`, padding 1px 7px, rounded-full. Format `×{N}`.
- Body: vertical list of `<ItemRow>`s.

Props: `{ npcId: NpcId, items: Item[] }`. Emits nothing (copy is handled internally by `ItemRow`).

### `ItemRow` (`src/components/ItemRow.vue`)

Renders one item line with copy affordance.

- Container: `flex items-center gap-2.5 py-1.5 px-1`, `text-[12px]`.
- Icon: 24×24, `bg-bg-slot-filled` + border `border-slot-filled`, `rounded-[4px]`. `<img>` from `item.iconUrl` if set, else fallback SVG glyph from the parent NPC's slot type (passed as a prop or resolved in setup).
- Name: `flex-1 min-w-0 truncate text-text-default`, with `title="{full name}"` for tooltip on truncation. **Click on name** = copy (alias of the ⧉ button).
- Level badge: mono 10px, `bg-bg-page` + `border-border-default`, padding 1px 6px, rounded. Format `lv {item.levelRequired}`. **No over-leveled red treatment in V2** (the planner is event-bucketed; the level is just a sort key, not a constraint).
- Copy button (`⧉`): 24×24 square, `bg-bg-page` + `border-border-default`, hover → `border-accent text-accent`. `aria-label="Copier le nom"`.
  - On click: `await navigator.clipboard.writeText(item.name)`. If the API isn't available (HTTP without HTTPS, very old browsers), fall back to the `<textarea> + execCommand('copy')` pattern.
  - Visual feedback: replace `⧉` with `✓` and apply `bg-accent text-[#061a13]` for 1200ms via a local `copied` ref + `setTimeout`. Same animation if the copy was triggered by clicking the name.

Props: `{ item: Item, fallbackSlot?: SlotType }`.

### `AppPurchasePlanner` (`src/components/AppPurchasePlanner.vue`)

The screen root. Reads `useShoppingList()`, `useBuildStore`, `useUiStore`. Renders header strip + tabs + grid as described in Layout.

Internal state:
- `activeRoom: Ref<RoomId>` — initialized to first non-empty room on mount; persisted in `useUiStore` if we want to remember between mode switches (V2.1 polish, optional in V2).

Event handlers:
- Click a tab → `activeRoom.value = tabId` (no-op if empty).
- Click `Retour à Build` (empty-state CTA) → `ui.setViewMode('build')`.

### `AppTimeline.vue` & `AppMiniMap.vue` adjustments

Both must be hidden when `viewMode === 'purchase'` (rendered conditionally in `App.vue`). The mini-map is timeline-specific and has no purpose in the planner view.

In `App.vue`:

```vue
<AppTopBar />
<AppPurchasePlanner v-if="ui.viewMode === 'purchase'" />
<template v-else>
  <AppTimeline ref="timelineRef" />
  <AppMiniMap :scroll-ref="scrollEl" />
</template>
<ItemPickerSheet />
<ClassPickerModal />
```

Pickers (item + class) remain mounted globally — they shouldn't be triggerable from the purchase planner, but mounting them is harmless and keeps the state machine simple.

## Composables

### `useShoppingList` (`src/composables/useShoppingList.ts`)

```ts
export type RoomId = '1-50' | '51-100' | '101-150' | '151-199' | '200';

export type NpcId =
  | 'coiffe' | 'cape' | 'amulette' | 'anneau'
  | 'ceinture' | 'bottes' | 'arme' | 'bouclier' | 'familier'
  | 'trophee' | 'dofus';

export interface ShoppingList {
  rooms: Record<RoomId, Partial<Record<NpcId, Item[]>>>;
  totals: {
    items: number;
    activeRooms: number;     // rooms that have at least one item
    perRoom: Record<RoomId, number>;
  };
}

export function useShoppingList(): ComputedRef<ShoppingList>;
```

The `rooms` map uses `Partial<Record<...>>` because not every room contains every NPC (1-50 has no trophée, only 200 has dofus). NPC entries with zero items are simply absent from the inner map.

The returned `computed` reads `build.cards` and the item cache. Items not yet in the cache are excluded from the snapshot for that pass but trigger `ensureItem(itemId)` calls to fill the cache; the computed re-runs when the cache updates and items appear.

The room-availability map and exception logic live in this module as private constants (RoomDef table) so it's the single source of truth for "what's where".

## Persistence

No new persisted state in V2. The build store, item cache, and persistence composable from V1 are unchanged. `viewMode` lives in the in-memory UI store as before.

## Tests

- `tests/composables/useShoppingList.spec.ts` (new) — TDD on the bucketing pure function:
  1. Empty timeline → empty rooms / totals all zero.
  2. Single card Lv 1 with 3 filled slots → 3 items in room `1-50`, distributed to the right NPCs.
  3. Multi-card timeline with item kept across cards → item appears once, in the first card's room.
  4. Trophée on a card Lv 30 → bumped to room `51-100`.
  5. Dofus item on card Lv 12 → bucketed in room `200` regardless.
  6. Same item on anneau1 + anneau2 of the same card → listed once under "Anneau" NPC.
  7. Item on card with `level: null` → excluded.
- `tests/components/ItemRow.spec.ts` (new) — minimal: clicking the copy button calls `navigator.clipboard.writeText` with the item name; clicking the name does the same; visual feedback toggles after click.

The existing 30 tests continue to pass unchanged.

## Out of scope for V2

- **No quantity badges**. If the same item is required twice on the same card (anneau1 = anneau2 = same Bouftou), we list it once. Players know to buy 2 copies. Quantity badge can be V2.1 if it becomes a pain point.
- **No over-leveled red treatment** in the planner (kept in Build/Switch only).
- **No "Copy all"** per NPC or per room.
- **No exporting the shopping list** (Importer/Exporter handles the build only; the shopping list is a computed view).
- **No backend / sharing** — the planner is local to the user's session like the rest of V1/V2.
- **No filter or search** within the planner — the lists are short enough per NPC that scanning is fast.
- **No "mark as bought" checkbox state** — the planner is a snapshot, not a workflow tracker.
