# Shopping custom import — design

## Goal

Add an "Import custom" action to the Shopping view: paste a free list of item
names (plain one-per-line OR a `nom;type;niveau` CSV — only the name is used),
batch-validate their existence against DofusDB, and inject the found items into
the right room/NPC tables (alongside the timeline-derived items). Names not found
go into a dedicated "Inconnu" section at the bottom. There is a single,
persistent custom list. An "Analyser" button reports valid/invalid counts without
importing; "Importer" applies the import.

## Input examples

Plain list (one name per line):
```
Anneau d'Allister
Anneau des Matougarous
Masque de Klime
Dofus Nebuleux
```

CSV `nom;type;niveau` (only the name column is used; the header line is ignored):
```
nom;type;niveau
Alliance de Silimelle;Anneau;26
Baguette de Sagesse;Baguette;27
Dragolyre;Amulette;32
```

## Locked decisions

1. **One persistent list.** Pasting replaces the previous custom list. Persisted
   to localStorage (survives F5). A "Vider" action clears it.
2. **Resolve once at validation.** Names are resolved in one batched request when
   the user validates; the result `{ name, itemId | null }[]` is persisted — no
   re-fetch on each Shopping render.
3. **Found items merge into the room/NPC tables**, routed by typeId + level like
   the timeline items. **Dedup:** if a resolved custom item's id is already in the
   list (from a card), it is NOT added again (and stays a normal card item, no
   custom badge). Names are de-duplicated among themselves.
4. **Custom badge.** Items that come from the custom import (and aren't already
   card-derived) get a small turquoise marker to distinguish them.
5. **"Inconnu" section.** Names not found in DofusDB — and resolved items whose
   typeId maps to no room/NPC — are listed flat (just names, no columns/icons) in
   a dedicated panel after the rooms. Hidden when empty.
6. **Counts.** Each custom item counts as 1 (no ×N). Totals (units/perRoom)
   include custom items.

## Architecture

### Store — `src/stores/customShopping.ts` (new Pinia setup store)

```ts
export interface CustomEntry { name: string; itemId: number | null }

export const useCustomShoppingStore = defineStore('customShopping', () => {
  const entries = ref<CustomEntry[]>(loadEntries()); // rehydrated from localStorage
  watch(entries, (v) => save(v), { deep: true });    // persist on change
  function setEntries(next: CustomEntry[]): void { entries.value = next; }
  function clear(): void { entries.value = []; }
  return { entries, setEntries, clear };
});
```

- localStorage key `dofus-planner.shopping.custom.v1`. `loadEntries` parses +
  validates the array (each item `{ name: string, itemId: number|null }`), falls
  back to `[]` on any error.

### Routing helper — `src/types/rooms.ts` (new export)

```ts
/** Route a resolved item to its shopping room + NPC by typeId + levelRequired.
 *  Returns null when the typeId maps to no shopping slot (→ treated as unknown). */
export function routeItemByType(item: { typeId: number; levelRequired: number }):
  { room: RoomId; npc: NpcId } | null;
```

Logic (mirrors the existing `useShoppingList` bucketing, keyed on typeId):
- `TYPE_ID_DOFUS` (23) → `{ room: '200', npc: 'dofus' }`.
- `TYPE_ID_TROPHEE` (151) → `{ room: levelToRoom(level) bumped 1-49→50-99, npc: 'trophee' }`.
- familier typeIds (`FAMILIER_TYPE_IDS`) → `{ room: 'hub', npc: 'familier' }`.
- monture typeIds (`MONTURE_TYPE_IDS`) → `{ room: 'hub', npc: 'monture' }`.
- else `TYPE_ID_TO_SLOT[typeId]` (from `@/utils/typeIdSlots`): if a slot → `{ room:
  levelToRoom(level), npc: slotToNpc(slot) }`; else `null`.

(`useShoppingList`'s dofus/familier branches can optionally be refactored to use
this helper later; not required for this feature — keep the change focused.)

### Parsing + Resolution — `src/composables/useCustomShopping.ts` (new)

```ts
/** Extract item names from pasted text. Accepts a plain "one name per line" list
 *  AND a CSV-like "nom;type;niveau" format — we only keep the NAME (first ; field),
 *  since resolution is name-based. */
export function parseCustomLines(text: string): string[];

export async function resolveCustomNames(names: string[]): Promise<CustomEntry[]>;
```

`parseCustomLines`:
- Split on newlines; for each line take the part before the first `;` (a plain
  line with no `;` yields the whole line), then trim.
- Drop empty results.
- Drop a header line: when the name field is `nom` (case-insensitive) — covers the
  `nom;type;niveau` header and a bare `nom`.
- De-dup by normalized name (preserve first-seen order).

Example: `Alliance de Silimelle;Anneau;26` → `Alliance de Silimelle`;
`nom;type;niveau` → dropped; `Anneau d'Allister` → `Anneau d'Allister`.

`resolveCustomNames` (takes the already-parsed names):
- `const pool = await fetchItemsByNames(names)` (one request).
- Group pool by normalized name; for each input name, pick an item whose
  normalized name matches (prefer one routable via `routeItemByType`, else first).
  → `itemId` if found, else `null`.
- `await ensureItems(foundIds)` so found items render with stats/icons.
- Return ordered `CustomEntry[]`.

### Shopping list integration — `src/composables/useShoppingList.ts`

Add a dependency on `useCustomShoppingStore`. After the card-derived bucketing
(the existing `seen` set is the dedup key):

```ts
const customItemIds = new Set<number>();
const unknown: string[] = [];
for (const entry of custom.entries) {
  if (entry.itemId === null) { unknown.push(entry.name); continue; }
  if (seen.has(entry.itemId)) continue;          // already a card item → no dup, no badge
  const item = getCachedItem(entry.itemId);
  if (!item) { void ensureItem(entry.itemId).catch(() => {}); continue; }
  const route = routeItemByType(item);
  if (!route) { unknown.push(entry.name); continue; } // resolved but unroutable
  bucket(result, route.room, route.npc, item);
  customItemIds.add(item.id);
  seen.add(item.id);
}
```

Then re-sort NPC lists (existing step) and compute totals (existing; custom items
naturally counted as 1 via `counts[id] ?? 1`). Extend `ShoppingList` with:

```ts
unknown: string[];            // names not found + resolved-but-unroutable
customItemIds: Set<number>;   // ids that came from the custom import (for the badge)
```

`emptyShoppingList()` initializes `unknown: []`, `customItemIds: new Set()`.

Note: custom injection runs inside the same `computed`, so it re-runs when either
`build.cards` or `custom.entries` change. Items pending fetch (`getCachedItem`
null) are skipped this pass and appear once `ensureItem` resolves (same pattern as
the card path).

### UI — `src/components/AppPurchasePlanner.vue`

- An **"Import custom"** button in the header row (near the global total pill).
  Opens a modal (new small component `CustomImportModal.vue`, or inline) with a
  `<textarea>` ("Un item par ligne, ou collez un CSV nom;type;niveau…") and, when
  a list exists, a **Vider** button.
- Two action buttons in the modal:
  - **Analyser**: `parseCustomLines` → `resolveCustomNames` (loading state), then
    show a non-committing preview in the modal: `"<valides> valides · <invalides>
    invalides"` plus the list of invalid names. Does NOT touch the stored list.
    The resolved result is cached against the current textarea content so a
    following **Importer** with unchanged text reuses it (no second fetch).
  - **Importer**: resolves (or reuses the cached analysis if the text is
    unchanged) → `customStore.setEntries(result)` → close → toast
    `"<valides>/<total> items reconnus" (+ " — <invalides> inconnus")`.
- **Vider**: `customStore.clear()` (clears the imported list).
- **Custom badge**: on each rendered item whose `id ∈ list.customItemIds`, a small
  turquoise pastille (reuse the existing item-row styling; add a marker element).
- **"Inconnu" panel**: rendered after the rooms when `list.unknown.length > 0` —
  same panel chrome as a room, title "Inconnu", listing the names flat (no NPC
  columns, no icons). Items are plain text (not clickable-to-copy is fine, or keep
  the copy affordance — optional; default: plain text rows).

The empty-state check `hasAnything` becomes
`list.totals.items > 0 || list.unknown.length > 0` so a custom-only list (or one
with only unknowns) still shows the planner instead of the empty placeholder.

## Edge cases

- **Empty paste / all blank** → `setEntries([])` (effectively clears) or show a
  hint; do not crash.
- **Name found but unroutable typeId** (consumable, quest item) → goes to Inconnu.
- **Custom name equals a card item** → not duplicated; shown once as the card item
  (no custom badge).
- **Same name pasted twice** → de-duped to one entry.
- **Network failure during validation** → surface an error in the modal; keep the
  previous list unchanged (don't wipe).
- **localStorage corrupt** → `loadEntries` falls back to `[]`.
- **Item id in the persisted list no longer cached after reload** → `ensureItem`
  re-fetches; appears on a later computed pass (or stays pending if offline).

## Testing (Vitest + Vue Test Utils)

### Store — `tests/stores/customShopping.spec.ts`
- Default empty; `setEntries` replaces; `clear` empties; survives reload
  (rehydrates from localStorage); corrupt storage → empty.

### Routing — `tests/types/rooms-route.spec.ts`
- dofus → 200/dofus; trophée lvl 30 → 50-99/trophee (bumped); familier → hub/familier;
  monture → hub/monture; coiffe typeId 16 lvl 60 → 50-99/coiffe; unknown typeId 99 → null.

### Parsing + Resolution — `tests/composables/useCustomShopping.spec.ts`
- `parseCustomLines`: plain list → names; CSV `nom;type;niveau` rows → first field
  only; the `nom;type;niveau` (and bare `nom`) header dropped; empty lines dropped;
  dedup by normalized name.
- `resolveCustomNames` (mock fetchItemsByNames + ensureItems): found names → itemId;
  missing → null; ensureItems called with found ids; one batched fetch.

### Shopping integration — `tests/composables/useShoppingList.spec.ts` (extend)
- A custom found item lands in the right room/NPC and is in `customItemIds`.
- A custom item whose id matches a card item is NOT duplicated and NOT in
  `customItemIds`.
- An unfound entry (itemId null) is in `unknown`.
- A resolved-but-unroutable item is in `unknown`.
- Totals include custom items (units/perRoom).

### Component smoke — `tests/components/AppPurchasePlanner-custom.spec.ts`
- "Import custom" opens the modal.
- **Analyser** calls resolve (mock) and shows the valid/invalid counts WITHOUT
  calling `setEntries` (the stored list is untouched).
- **Importer** calls `setEntries` with the resolved entries + toast + closes.
- The Inconnu panel renders names from `list.unknown`; a custom-badged item
  renders the marker.

No Playwright E2E.

## Out of scope (V1)

- Editing individual custom entries (only replace / clear the whole list).
- Quantities (×N) for custom items.
- Re-resolving unknowns automatically over time.
- Per-card custom lists (there is exactly one global list).
- Routing custom items by anything other than DofusDB typeId/level.

## File layout summary

- New: `src/stores/customShopping.ts` (persistent custom list store).
- New: `src/composables/useCustomShopping.ts` (`resolveCustomNames`).
- New: `src/components/CustomImportModal.vue` (paste UI) — or inline in the planner.
- Modify: `src/types/rooms.ts` (`routeItemByType`).
- Modify: `src/composables/useShoppingList.ts` (inject custom + `unknown` +
  `customItemIds`).
- Modify: `src/components/AppPurchasePlanner.vue` (button, badge, Inconnu panel,
  empty-state tweak).
- New tests: store, routing, resolution, shopping integration, component smoke.
