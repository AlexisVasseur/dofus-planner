# Build profiles — design

## Goal

Turn the single persisted build into a system of **named profiles**. "Nouveau
build" prompts for a name and creates a new profile (instead of destroying the
current one); a profile dropdown in the top bar lets the user switch, rename, and
delete profiles. Each profile bundles the timeline **and** the shopping state.

## Locked decisions

1. **A profile contains:** the build (cards) + the shopping custom list + the
   acquired ("green") checks. The DofusDB item cache stays global (shared).
2. **UI:** a profile dropdown in the top bar — shows the active profile name,
   lists profiles (click to switch), with rename + delete. "Nouveau build" prompts
   a name and creates + activates a new (empty) profile.
3. **Migration:** on first run of the profile system, the existing persisted build
   (+ its custom list + checks) becomes the active profile named "Build 1".
4. Export/Import JSON is unchanged — it operates on the **active** profile's cards.

## Architecture

### One source of persistence

Today three stores self-persist to three keys: `dofus-planner.build.v1`
(`usePersistence`), `dofus-planner.shopping.custom.v1` (`customShopping` watch),
`dofus-planner.shopping.checked.v1` (`shoppingChecked` watch). With profiles, the
**profiles store becomes the single persistence owner**; the three working stores
hold only the *active* profile's live state and no longer self-persist.

- `usePersistence` is removed (its load/save responsibility moves into the
  profiles store). `customShopping` and `shoppingChecked` drop their own
  `watch → localStorage` blocks (they keep their in-memory state + actions).

### Store — `src/stores/profiles.ts` (new)

```ts
export interface Profile {
  id: string;
  name: string;
  cards: Card[];
  custom: CustomEntry[];  // customShopping entries
  checked: string[];      // shoppingChecked keys (Set serialized to array)
}

export const useProfilesStore = defineStore('profiles', () => {
  const profiles = ref<Profile[]>([]);
  const activeId = ref<string>('');
  const activeName = computed(() => profiles.value.find(p => p.id === activeId.value)?.name ?? '');
  // actions below
});
```

Persisted under `dofus-planner.profiles.v1` as `{ version: 1, activeId, profiles }`.

Internal helpers (not exported):
- `snapshotActive()`: copy the live working stores into the active profile entry —
  `cards = JSON-cloned build.cards`, `custom = [...customShopping.entries]`,
  `checked = [...shoppingChecked.checked]`.
- `hydrate(p: Profile)`: push a profile into the working stores — set a `hydrating`
  guard, then `build.replaceCards(clone(p.cards))`,
  `customShopping.setEntries([...p.custom])`, `shoppingChecked.setChecked([...p.checked])`,
  then clear `hydrating`.

Actions:
- `createProfile(name: string)`: `snapshotActive()`; build a fresh profile
  `{ id: randomId(), name, cards: [makeFreshFirstCard()], custom: [], checked: [] }`;
  push; `activeId = new.id`; `hydrate(new)`. Returns the new id.
- `switchTo(id)`: no-op if `id === activeId`; else `snapshotActive()`; `activeId = id`;
  `hydrate(target)`.
- `rename(id, name)`: set the profile's name (trimmed; ignore empty).
- `remove(id)`: if only one profile, ignore. Else remove it; if it was active,
  `switchTo(firstRemaining.id)` (which hydrates).
- `init()`: see below.

### Init + migration — `init()` (called once at startup, before mount)

```ts
function init(): void {
  const raw = localStorage.getItem('dofus-planner.profiles.v1');
  const loaded = raw ? parseProfiles(raw) : null;   // validates shape
  if (loaded && loaded.profiles.length > 0) {
    profiles.value = loaded.profiles;
    activeId.value = loaded.profiles.some(p => p.id === loaded.activeId)
      ? loaded.activeId : loaded.profiles[0].id;
  } else {
    // Migrate the legacy single-build keys into "Build 1".
    profiles.value = [{
      id: randomId(),
      name: 'Build 1',
      cards: readLegacyCards(),       // parse dofus-planner.build.v1 or [makeFreshFirstCard()]
      custom: readLegacyCustom(),     // dofus-planner.shopping.custom.v1 or []
      checked: readLegacyChecked(),   // dofus-planner.shopping.checked.v1 or []
    }];
    activeId.value = profiles.value[0].id;
  }
  hydrate(active profile);
  // Keep the active profile + persistence in sync with the working stores.
  watch([() => build.cards, () => customShopping.entries, () => shoppingChecked.checked],
        () => { if (!hydrating) { snapshotActive(); save(); } },
        { deep: true });
  // also save() after create/switch/rename/remove (they call snapshotActive/hydrate).
}
```

- `save()` is debounced (~250ms) and writes `{ version: 1, activeId, profiles }`.
- `parseProfiles` validates: `version === 1`, `Array.isArray(profiles)`, each
  profile has string `id`/`name`, array `cards`/`custom`/`checked` (lenient — drops
  the file to null on shape errors → triggers migration/fresh).
- `readLegacyCards`: reuse the existing build-parse logic (move `parseBuild` from
  `usePersistence` into a small shared util `src/utils/buildStorage.ts`, or inline a
  minimal parse). `readLegacyCustom` / `readLegacyChecked` read + validate the two
  shopping keys (same validation the stores' `load()` already had).

### Working-store changes

- `shoppingChecked`: add `setChecked(keys: string[])` (replaces the Set); remove the
  self-persist `watch`.
- `customShopping`: remove the self-persist `watch` (keep `setEntries`/`clear`).
- `build`: unchanged (already has `replaceCards`); `usePersistence` deleted.
- `main.ts`: replace `usePersistence()` with `useProfilesStore().init()` (pinia must
  be installed first — it already is before the call).

### UI — top bar (`src/components/AppTopBar.vue`)

- Replace the current "Nouveau build" → confirm-reset flow with the profile system:
  - A **profile dropdown** (new small component `ProfileMenu.vue`, or inline):
    a button showing `activeName` + a chevron; opens a list of profiles (click =
    `switchTo`), each row with a rename affordance (inline text input on a pencil
    click, commits on Enter/blur via `rename`) and a delete (trash → `ConfirmPopover`
    → `remove`, hidden when only one profile remains).
  - **"Nouveau build"** button: opens a small name prompt (a `ProfileNameModal.vue`
    or a popover with a text input + "Créer"); on submit → `createProfile(name)`
    (default name like `Build N` pre-filled). Then `ui.setActiveCard(firstCardId)` +
    close pickers, like the old reset did.
- Export/Import buttons stay as-is.

Switching/creating a profile also resets transient UI: `ui.setActiveCard(<first
card of the now-active profile>)`, `ui.closeItemPicker()`, `ui.closeClassPicker()`,
`ui.closeCustomImport()`.

## Edge cases

- **Corrupt `profiles.v1`** → `parseProfiles` returns null → migrate-from-legacy (or
  fresh "Build 1" if no legacy either).
- **Delete the active profile** → switch to the first remaining; never allow zero
  profiles (delete is a no-op when only one remains).
- **Empty / whitespace name** on create/rename → fall back to a default `Build N`
  (create) or ignore (rename).
- **Hydration loop**: the `hydrating` guard prevents the sync watch from
  snapshotting back during `hydrate`.
- **Item cache**: shared/global — switching profiles may reference item ids not yet
  cached on this device; `App.vue`'s on-mount `ensureItems` + the per-row
  `ensureItem` already backfill (unchanged).
- The legacy keys (`build.v1`, `shopping.custom.v1`, `shopping.checked.v1`) are read
  once for migration and then left in place (harmless; not written to anymore).

## Testing (Vitest + Vue Test Utils)

### Store — `tests/stores/profiles.spec.ts`
- `init` with no storage → one "Build 1" profile, active, working stores hydrated
  to a fresh card.
- `init` migrates legacy build.v1 (+ custom + checked) into "Build 1".
- `createProfile('PvP')` snapshots the current build, adds + activates an empty
  profile, hydrates a fresh card; the previous profile keeps its cards.
- `switchTo` round-trip: build A, switch to B (empty), edit B, switch back to A →
  A's cards intact, B's edits preserved.
- `rename` updates the name; `remove` deletes and re-activates another; `remove`
  is a no-op with a single profile.
- Persistence: after a mutation, `dofus-planner.profiles.v1` holds the map; a fresh
  store `init()` rehydrates it (survives reload).
- Profile bundles shopping: a profile carries its own custom list + checks (switch
  swaps them).

### Component — `tests/components/AppTopBar-profiles.spec.ts`
- The dropdown shows the active profile name and lists profiles; clicking another
  switches (`switchTo` / build cards change).
- "Nouveau build" → name prompt → `createProfile` called with the typed name; new
  profile active.
- Rename + delete wired (delete hidden when only one profile).

No Playwright E2E.

## Out of scope (V1)

- Per-profile export/import (export stays active-build only).
- Reordering profiles.
- Duplicating a profile (only fresh-create).
- Cloud sync.

## File layout summary

- New: `src/stores/profiles.ts` (profiles map + active + actions + init/migration).
- New: `src/utils/buildStorage.ts` (shared legacy build parse, extracted from usePersistence).
- New: `src/components/ProfileMenu.vue` (dropdown: switch/rename/delete) and a name
  prompt (`ProfileNameModal.vue` or inline popover).
- Modify: `src/stores/customShopping.ts` (drop self-persist watch), `src/stores/shoppingChecked.ts`
  (drop self-persist watch + add `setChecked`).
- Delete: `src/composables/usePersistence.ts` (responsibility moved); update `main.ts`.
- Modify: `src/components/AppTopBar.vue` (profile dropdown + name prompt, replace reset).
- New tests: profiles store, top-bar profiles component.
