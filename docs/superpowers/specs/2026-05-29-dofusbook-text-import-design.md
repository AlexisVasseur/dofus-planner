# Dofusbook text import — design

## Goal

Let the user paste the raw text of a Dofusbook build page (Ctrl+A → Ctrl+C) and
get a new card created with the build's class, level, title, and all equipped
items placed in their slots. Adapts the Python "Extracteur Dofusbook"
(`inspiration/script-dofusbook`) to the Vue/TS project — but for the build
*équipement* page, not the atelier list.

## Input reality

The pasted text is the full build page. Item data is name-only (no per-item
slot/type/level). Example fixture: `inspiration/dofusbook-extract` (copied to
`tests/fixtures/dofusbook-extract.txt`). Key structure:

- A header line `Feca 133 - Draegnerys` = class + level + build name.
- A long stats block (PdV, PA, PM, Vitalité, …).
- Two contiguous blocks of equipped-item NAMES:
  - Block 1: the non-empty lines immediately preceding the `Forgemagie` label.
  - Block 2: the non-empty lines between `Boosts actifs (…)` and
    `Résumé du stuff`.
- Panoplie sections (after `Résumé du stuff`) repeat some item names with their
  slots — IGNORED here (they fall after the Block-2 end anchor, so no dupes).

For the fixture, the 16 names are: Torque Ancestral, Bouclier des Brigandins,
Anneau Ancestral, Cacture, Protège-Tibias Ancestraux (block 1) + Cascterre,
Dagues du Dragoeuf, Anneau de Fraktale, Capterre, Bulbisou, Dofus Cawotte,
Dolmanax, Dofus Pourpre, Forcené, Saccageur Terre, Ravageur Terre (block 2) =
10 equipment + 6 dofus/trophée.

## Locked decisions

1. **Resolution:** each name is resolved against the DofusDB API by name; the
   item's `typeId` determines its slot. (The text has no slots — this is the
   only viable path.)
2. **Input:** always a full-page Ctrl+A. The parser relies on the stable FR
   anchors `Forgemagie`, `Boosts actifs`, `Résumé du stuff`, and the
   `<Class> <level> - <title>` header.
3. **Dofus order:** irrelevant — the 6 dofus/trophée fill the 6 `dofus[]` slots
   in encounter order.
4. **Card content:** class + level + title + equipment (full card).
5. **Entry point:** extend the existing `CardCodeImportModal` with a second mode
   ("Coller depuis Dofusbook"); creates a NEW card after the active/last card.
6. **Flow:** direct creation + summary toast (no preview step).
7. **Unresolved items:** skipped, listed in the toast; the card is still created
   with whatever resolved. If ZERO items resolve, do not insert; show an error.

## Architecture

### Parser — `src/utils/dofusbookParse.ts` (new, pure)

```ts
export interface ParsedDofusbook {
  classId: ClassId | null;
  level: number | null;
  title: string | null;
  itemNames: string[];
}
export function parseDofusbookText(text: string): ParsedDofusbook;
```

Algorithm on `text.split('\n').map(l => l.trim())`:

- **Header:** the first line matching `^(\p{L}+)\s+(\d{1,3})\s+-\s+(.+)$` (Unicode)
  whose group 1, normalized (lowercase + strip diacritics), is a valid `ClassId`.
  → `classId` (the normalized class), `level` (number, clamped 1–200),
  `title` (group 3, trimmed; null if empty). If no such line: all three null.
- **Item names:**
  - `idxForge` = first index where line === `Forgemagie`.
  - `idxBoosts` = first index where line starts with `Boosts actifs`.
  - `idxResume` = first index where line === `Résumé du stuff`.
  - Block 1: starting at `idxForge - 1`, skip blank lines upward, then collect
    consecutive non-empty lines upward until the next blank; reverse to source
    order. (Empty if `idxForge` not found.)
  - Block 2: the non-empty lines in `(idxBoosts, idxResume)`. (Empty if either
    anchor not found.)
  - `itemNames` = block1 ++ block2 in source order. Identical-name duplicates are
    dropped (distinct equipped items always have distinct names; an exact repeat
    would otherwise double-apply one item).
- Robustness: documented to depend on the FR anchors. No anchors found → empty
  `itemNames` (caller treats as "nothing to import").

Normalization helper reused from the existing `normalizeSearch` style
(lowercase, NFD, strip diacritics).

### Data — `src/data/dofusdb.ts`

New `searchItemsByName(name: string, limit = 5): Promise<Item[]>`:
`GET /items?slug.fr[$search]=<normalized name>&$limit=<limit>&$sort=-level`
(no typeId filter; reuses `mapItem` + the existing error/throw style).

### Resolver — `src/composables/useDofusbookImport.ts` (new)

```ts
export interface ResolvedBuild {
  slots: Record<SlotType, ItemRef | null>;
  dofus: (ItemRef | null)[]; // length DOFUS_COUNT
  unresolved: string[];      // names that matched nothing usable
  resolvedCount: number;
}
export async function resolveDofusbookItems(itemNames: string[]): Promise<ResolvedBuild>;
```

- `TYPE_ID_TO_SLOT`: reverse of `SLOT_TO_TYPE_IDS` excluding ring slots — share
  the existing one (extract to a small `src/utils/typeIdSlots.ts` so both the
  build store's `equipItemSet` and this resolver use one source). Ring typeId 9
  and dofus/trophée typeIds (23/151) handled explicitly.
- Resolve all names in parallel (`Promise.all`, ≤16 names → within the search
  budget), each wrapped so a rejection becomes a null/unresolved rather than
  aborting the batch. `Promise.all` preserves array order. Then do the slot
  assignment in a SECOND sequential pass over the results in `itemNames` order
  (so ring/dofus ordering is deterministic).
- Per name, pick the match: the result whose `name` normalized-equals the
  searched name; else the first result whose `typeId` maps to a known slot OR is
  9 / 23 / 151; else → `unresolved`.
- Assignment pass (in order):
    - ring (typeId 9) → first empty of `anneau1`, `anneau2`; if both full, skip
      (extra ring) → `unresolved`.
    - dofus/trophée (typeId 23 or 151) → next free `dofus[]` index; if all 6
      full → `unresolved`.
    - else slot from `TYPE_ID_TO_SLOT`; overwrite. If that slot is already
      filled by a prior item (shouldn't happen for a valid build) → keep first,
      push later to `unresolved`.
- `await ensureItems(resolvedIds)` so the catalog cache has them (stats /
  tooltips / panoplie bonus).
- `resolvedCount` = number of slots+dofus filled.

### Card building + insertion

In the modal handler (or a tiny store helper): build
`Card { id: randomId(), classId, level, title, slots, dofus }` from the parsed
header + `ResolvedBuild`, then `build.addCardAfter(afterCardId, card)` where
`afterCardId` = `ui.activeCardId ?? lastCardId`. (`addCardAfter` already falls
back classId to the previous card's when null — acceptable.)

### UI — `src/components/CardCodeImportModal.vue`

- Add a mode selector at the top: `Code` (existing) | `Dofusbook`.
- Dofusbook mode: a `<textarea>` ("Colle le texte de ta page Dofusbook — Ctrl+A")
  + the existing Import button.
- On import in Dofusbook mode:
  1. `parseDofusbookText(text)`.
  2. If no class AND no item names → error message ("Texte non reconnu").
  3. `await resolveDofusbookItems(parsed.itemNames)` (button shows loading).
  4. If `resolvedCount === 0` → error ("Aucun item reconnu"), do not insert.
  5. Else build the card, `addCardAfter`, close modal, and
     `toast.show("<n>/<total> items équipés" + (unresolved.length ? " — introuvables : <list>" : ""))`.
- The existing Code mode is untouched.

## Edge cases

- **No header match** → class/level/title null; equipment still imported.
- **Unknown class word** (accent variant) → normalize handles common cases; if
  still unmatched, classId null (card created classless).
- **Ambiguous name** (e.g. "Dofus Pourpre" vs "Réplique du Dofus Pourpre") →
  exact normalized-name match wins (id 694, typeId 23).
- **Network failure on a name** → that name → `unresolved` (caught per-name; one
  failure doesn't abort the others).
- **More than 2 rings / 6 dofus** in the text → extras → `unresolved`.
- **Item typeId with no slot** (cosmetic, etc.) → `unresolved`.
- **Empty / non-Dofusbook text** → error, nothing inserted.

## Testing (Vitest + Vue Test Utils)

### Parser — `tests/utils/dofusbookParse.spec.ts`

- On the real fixture (`tests/fixtures/dofusbook-extract.txt`, read via Node fs
  in the test): `classId === 'feca'`, `level === 133`, `title === 'Draegnerys'`,
  `itemNames` has the 16 expected names in order (assert a few key ones +
  length 16).
- Header parsing: "Iop 200 - Mon Iop" → iop/200/"Mon Iop".
- No anchors / empty text → `itemNames: []`, header null.
- Identical-name dupe dropped.

### Data — `tests/data/dofusdb-search.spec.ts`

- `searchItemsByName('dofus pourpre')` URL contains `slug.fr[$search]=dofus%20pourpre`
  and maps results (mock `fetch`).

### Resolver — `tests/composables/useDofusbookImport.spec.ts` (mock searchItemsByName + ensureItems)

- Exact-name match preferred over decoys (Dofus Pourpre case → id 694).
- Amulette/cape/etc. land in the right slot.
- Two rings → anneau1 then anneau2; a third ring → unresolved.
- Dofus + trophée → dofus[] in order; 7th → unresolved.
- Name with no result → unresolved; resolvedCount excludes it.
- typeId with no slot → unresolved.
- `ensureItems` called with the resolved ids.

### Component smoke — `tests/components/CardCodeImportModal-dofusbook.spec.ts`

- Switching to Dofusbook mode shows the textarea.
- Pasting the fixture + clicking Import calls parse + resolve (mocked) +
  `build.addCardAfter` with a card carrying the resolved slots, then closes and
  toasts the summary.
- Zero-resolved → no `addCardAfter`, error shown.

No Playwright E2E.

## Out of scope (V1)

- Parsing the atelier/shopping-list format (the original Python script's format).
- Fetching from the Dofusbook share link / API (Cloudflare-blocked).
- Importing stats/forgemagie values (only equipment + class/level/title).
- A preview/confirmation step before creation.
- Reading exo/scroll state from the page.

## File layout summary

- New: `src/utils/dofusbookParse.ts` (pure parser).
- New: `src/utils/typeIdSlots.ts` (shared `TYPE_ID_TO_SLOT` reverse map +
  ring/dofus typeId constants; `equipItemSet` refactored to use it).
- New: `src/composables/useDofusbookImport.ts` (resolver + card assembly).
- Modify: `src/data/dofusdb.ts` (`searchItemsByName`).
- Modify: `src/components/CardCodeImportModal.vue` (mode selector + Dofusbook UI).
- Modify: `src/stores/build.ts` (use shared `typeIdSlots`; possibly a helper to
  build+insert the imported card, or do it in the modal).
- New fixture: `tests/fixtures/dofusbook-extract.txt`.
- New tests: parser, data search, resolver, component smoke.
