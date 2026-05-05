# V3 — Class-themed cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the equipment cards with per-class theming (hero image header background, class thumbnail in lieu of the hex logo, card tinted by per-class JSON colors). Swap fonts (Bebas Neue → Rowdies, Inter → Roboto). Strip the universal mint accent from the chrome (top bar, mini-map, pickers, Achats, Switch peek labels) — class colors become the only color statement in the app.

**Architecture:** Each class owns a folder under `src/assets/classes/<id>/` with `hero.jpg`, `thumbnail.jpg` and a `colors.json` (3 hex values: `dominant`, `soft`, `accent`). A `useClassAssets(classId)` composable bundles them via `import.meta.glob` and returns `{ thumbnailUrl, heroUrl, colors } | null`. The card root receives 3 CSS custom properties (`--class-dominant`, `--class-soft`, `--class-accent`) and themes itself via `color-mix(in srgb, var(--class-*) ...)`. The diff "added" green stays mint as a semantic color; everything else neutral becomes white.

**Tech Stack:** Vue 3.5, Vite 6, TypeScript 5, Tailwind 3, VueUse 11, Vitest 2. No new deps. Uses Vite's `import.meta.glob` and CSS `color-mix()` (Chrome 111+, Firefox 113+, Safari 16.2+).

---

## Spec reference

Authoritative spec: `docs/superpowers/specs/2026-05-05-class-themed-cards-design.md`. Read it before starting. As-built reference: `docs/as-built.md`.

---

## File map

```
src/
├── assets/classes/                    NEW (19 folders × 3 files = 57 new files)
│   ├── iop/{hero.jpg, thumbnail.jpg, colors.json}
│   ├── cra/{...}
│   └── ...                            (19 classes total — including Forgelance)
├── types/classes.ts                   MODIFY: add 'forgelance' to ClassId union
├── data/classes.ts                    MODIFY: append Forgelance entry
├── composables/
│   └── useClassAssets.ts              NEW: bundle + expose per-class assets
├── components/
│   ├── ClassThumbnail.vue             NEW: square thumbnail with ClassLogo fallback
│   ├── CardHeader.vue                 MODIFY: use ClassThumbnail, hero ::before, CSS vars, Rowdies typography
│   ├── EquipmentCard.vue              MODIFY: data-class-id + style vars + themed border/bg
│   ├── EquipmentCardDiff.vue          MODIFY: same root theming as EquipmentCard
│   ├── EquipmentSlot.vue              MODIFY: hover/active use --class-dominant
│   ├── DofusCell.vue                  MODIFY: same
│   ├── Connector.vue                  MODIFY: pill mint → neutral white
│   ├── ConnectorPopover.vue           MODIFY: hover items neutral
│   ├── AppTopBar.vue                  MODIFY: mode toggle + brand + buttons → neutral
│   ├── AppMiniMap.vue                 MODIFY: active cell white-on-dark
│   ├── AppPurchasePlanner.vue         MODIFY: room tabs + global stats → neutral
│   ├── NpcCard.vue                    MODIFY: label color → neutral
│   ├── ItemRow.vue                    MODIFY: copy ⧉/✓ → neutral white
│   ├── ItemPickerSheet.vue            MODIFY: pills + search + selected → neutral
│   ├── ClassPickerModal.vue           MODIFY: selected cell uses its own class colors
│   └── AppSwitchView.vue              MODIFY: peek labels → neutral
├── App.vue                            MODIFY: drop mint radial gradients in bg layers
└── style.css                          (no change)

index.html                              MODIFY: Google Fonts link → Rowdies + Roboto
tailwind.config.ts                      MODIFY: fontFamily.display = Rowdies, fontFamily.sans = Roboto
tests/composables/useClassAssets.spec.ts NEW: 2 tests (happy path + null)
```

---

## Task 1 — Asset preparation (19 classes × hero + thumbnail + colors.json)

Bulk file operation: copy assets from `inspiration/` and write 19 `colors.json` files with the proposed initial palette. The user may tune any hex value later.

**Files:**
- Create: 19× `src/assets/classes/<id>/hero.jpg` (copies from `inspiration/classes/hero/<id>-hero.jpg`)
- Create: 19× `src/assets/classes/<id>/thumbnail.jpg` (copies from `inspiration/classes/thumbnails/<id>-thumbnail.jpg`)
- Create: 19× `src/assets/classes/<id>/colors.json`

- [ ] **Step 1: Copy and rename hero + thumbnail images via Bash script**

```bash
cd "C:/Users/VASSE/projects/dofus-planner"
mkdir -p src/assets/classes
for class in iop cra sram eniripsa sadida enutrof sacrieur ecaflip feca xelor pandawa osamodas roublard zobal steamer eliotrope huppermage ouginak forgelance; do
  mkdir -p "src/assets/classes/$class"
  cp "inspiration/classes/hero/$class-hero.jpg" "src/assets/classes/$class/hero.jpg"
  cp "inspiration/classes/thumbnails/$class-thumbnail.jpg" "src/assets/classes/$class/thumbnail.jpg"
done
ls src/assets/classes/ | head -25
```

Expected: 19 directories created, each with `hero.jpg` + `thumbnail.jpg`.

- [ ] **Step 2: Write `src/assets/classes/iop/colors.json`**

```json
{
  "dominant": "#d96a2a",
  "soft": "#2a1d14",
  "accent": "#ffd9a8"
}
```

- [ ] **Step 3: Write `src/assets/classes/cra/colors.json`**

```json
{
  "dominant": "#3a8e6e",
  "soft": "#14241d",
  "accent": "#a8e0c8"
}
```

- [ ] **Step 4: Write `src/assets/classes/sram/colors.json`**

```json
{
  "dominant": "#5a3d8a",
  "soft": "#1a1424",
  "accent": "#c8a8e0"
}
```

- [ ] **Step 5: Write `src/assets/classes/eniripsa/colors.json`**

```json
{
  "dominant": "#d96aa6",
  "soft": "#2a1424",
  "accent": "#ffc8e0"
}
```

- [ ] **Step 6: Write `src/assets/classes/sadida/colors.json`**

```json
{
  "dominant": "#7a9c4a",
  "soft": "#1f2414",
  "accent": "#d8e8a8"
}
```

- [ ] **Step 7: Write `src/assets/classes/enutrof/colors.json`**

```json
{
  "dominant": "#c79b3a",
  "soft": "#2a2014",
  "accent": "#f0d8a0"
}
```

- [ ] **Step 8: Write `src/assets/classes/sacrieur/colors.json`**

```json
{
  "dominant": "#a83838",
  "soft": "#2a1414",
  "accent": "#f0a8a8"
}
```

- [ ] **Step 9: Write `src/assets/classes/ecaflip/colors.json`**

```json
{
  "dominant": "#d6a838",
  "soft": "#2a2114",
  "accent": "#f0d8a0"
}
```

- [ ] **Step 10: Write `src/assets/classes/feca/colors.json`**

```json
{
  "dominant": "#3a7ec7",
  "soft": "#14202a",
  "accent": "#a0c8f0"
}
```

- [ ] **Step 11: Write `src/assets/classes/xelor/colors.json`**

```json
{
  "dominant": "#5a7ac7",
  "soft": "#14182a",
  "accent": "#b0c0f0"
}
```

- [ ] **Step 12: Write `src/assets/classes/pandawa/colors.json`**

```json
{
  "dominant": "#5a8d4a",
  "soft": "#14201a",
  "accent": "#c0e0a8"
}
```

- [ ] **Step 13: Write `src/assets/classes/osamodas/colors.json`**

```json
{
  "dominant": "#9a5a3a",
  "soft": "#241814",
  "accent": "#e0c0a8"
}
```

- [ ] **Step 14: Write `src/assets/classes/roublard/colors.json`**

```json
{
  "dominant": "#3a6b6b",
  "soft": "#14201f",
  "accent": "#a8d0d0"
}
```

- [ ] **Step 15: Write `src/assets/classes/zobal/colors.json`**

```json
{
  "dominant": "#a8783a",
  "soft": "#241c14",
  "accent": "#e8d0a8"
}
```

- [ ] **Step 16: Write `src/assets/classes/steamer/colors.json`**

```json
{
  "dominant": "#7a7a8a",
  "soft": "#1c1c20",
  "accent": "#c8c8d8"
}
```

- [ ] **Step 17: Write `src/assets/classes/eliotrope/colors.json`**

```json
{
  "dominant": "#5a8aaa",
  "soft": "#141c20",
  "accent": "#b0d0e0"
}
```

- [ ] **Step 18: Write `src/assets/classes/huppermage/colors.json`**

```json
{
  "dominant": "#7a3aa8",
  "soft": "#1c1424",
  "accent": "#d0a8e8"
}
```

- [ ] **Step 19: Write `src/assets/classes/ouginak/colors.json`**

```json
{
  "dominant": "#9a3a3a",
  "soft": "#241414",
  "accent": "#e0a8a8"
}
```

- [ ] **Step 20: Write `src/assets/classes/forgelance/colors.json`**

```json
{
  "dominant": "#a8682a",
  "soft": "#241a14",
  "accent": "#e8c0a0"
}
```

- [ ] **Step 21: Verify 19 folders × 3 files**

```bash
find src/assets/classes/ -type f | wc -l
```

Expected: 57 (19 × 3). If different, locate the missing files via `for c in iop cra sram eniripsa sadida enutrof sacrieur ecaflip feca xelor pandawa osamodas roublard zobal steamer eliotrope huppermage ouginak forgelance; do for f in hero.jpg thumbnail.jpg colors.json; do [ -f "src/assets/classes/$c/$f" ] || echo "missing $c/$f"; done; done`.

- [ ] **Step 22: Commit**

```bash
git add src/assets/classes/
git commit -m "feat(assets): per-class hero + thumbnail + colors.json (19 classes)"
```

---

## Task 2 — Add Forgelance to ClassId + CLASSES

The asset folder includes `forgelance` (a 2024 Dofus class). Add it to the type union and the class table.

**Files:**
- Modify: `src/types/classes.ts`
- Modify: `src/data/classes.ts`

- [ ] **Step 1: Add `'forgelance'` to `ClassId` union**

In `src/types/classes.ts`, replace:
```ts
export type ClassId =
  | 'iop' | 'cra' | 'sram' | 'eniripsa' | 'sadida' | 'enutrof'
  | 'sacrieur' | 'ecaflip' | 'feca' | 'xelor' | 'pandawa'
  | 'osamodas' | 'roublard' | 'zobal' | 'steamer' | 'eliotrope'
  | 'huppermage' | 'ouginak';
```

with:
```ts
export type ClassId =
  | 'iop' | 'cra' | 'sram' | 'eniripsa' | 'sadida' | 'enutrof'
  | 'sacrieur' | 'ecaflip' | 'feca' | 'xelor' | 'pandawa'
  | 'osamodas' | 'roublard' | 'zobal' | 'steamer' | 'eliotrope'
  | 'huppermage' | 'ouginak' | 'forgelance';
```

- [ ] **Step 2: Append Forgelance entry to `CLASSES`**

In `src/data/classes.ts`, find the `CLASSES` array and append before the closing `] as const;`:

```ts
{ id: 'forgelance', name: 'Forgelance', abbrev: 'FGL' },
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0 (the new id is referenced where ClassId is used; all other places already iterate over CLASSES).

- [ ] **Step 4: Commit**

```bash
git add src/types/classes.ts src/data/classes.ts
git commit -m "feat(classes): add Forgelance (19 classes total)"
```

---

## Task 3 — Font swap (Rowdies + Roboto)

**Files:**
- Modify: `index.html`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Update `index.html` `<link>` tags**

Find the existing Google Fonts link in `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
```

Replace with:
```html
<link href="https://fonts.googleapis.com/css2?family=Rowdies:wght@300;400;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Update `tailwind.config.ts` `fontFamily`**

In the `theme.extend.fontFamily` object, replace:
```ts
display: ['"Bebas Neue"', 'sans-serif'],
sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
```

with:
```ts
display: ['Rowdies', 'sans-serif'],
sans: ['Roboto', 'ui-sans-serif', 'system-ui', 'sans-serif'],
```

Keep `mono` unchanged.

- [ ] **Step 3: Verify build picks up the new fonts**

```bash
npm run build
```

Expected: exit 0, no warnings. Bundled CSS contains `font-family:Rowdies` (verify with `grep -c Rowdies dist/assets/index-*.css` → should be > 0).

- [ ] **Step 4: Commit**

```bash
git add index.html tailwind.config.ts
git commit -m "ui(fonts): swap Bebas Neue → Rowdies, Inter → Roboto"
```

---

## Task 4 — `useClassAssets` composable (TDD)

Loader composable that returns `{ thumbnailUrl, heroUrl, colors } | null` for any `ClassId`. Uses `import.meta.glob` to bundle all class assets eagerly.

**Files:**
- Create: `src/composables/useClassAssets.ts`
- Test: `tests/composables/useClassAssets.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/composables/useClassAssets.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { useClassAssets } from '@/composables/useClassAssets';

describe('useClassAssets', () => {
  it('returns null for null classId', () => {
    expect(useClassAssets(null)).toBeNull();
  });

  it('returns thumbnail/hero URLs and colors for a known class (iop)', () => {
    const assets = useClassAssets('iop');
    expect(assets).not.toBeNull();
    expect(assets!.thumbnailUrl).toMatch(/iop.*thumbnail/);
    expect(assets!.heroUrl).toMatch(/iop.*hero/);
    expect(assets!.colors.dominant).toBe('#d96a2a');
    expect(assets!.colors.soft).toBe('#2a1d14');
    expect(assets!.colors.accent).toBe('#ffd9a8');
  });
});
```

- [ ] **Step 2: Verify tests fail**

```bash
npx vitest run tests/composables/useClassAssets.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/composables/useClassAssets.ts`**

```ts
import type { ClassId } from '@/types/classes';

export interface ClassColors {
  dominant: string;
  soft: string;
  accent: string;
}

export interface ClassAssets {
  thumbnailUrl: string;
  heroUrl: string;
  colors: ClassColors;
}

// Eagerly bundle all per-class assets via Vite glob imports.
const heroModules = import.meta.glob<string>(
  '@/assets/classes/*/hero.jpg',
  { eager: true, query: '?url', import: 'default' },
);
const thumbModules = import.meta.glob<string>(
  '@/assets/classes/*/thumbnail.jpg',
  { eager: true, query: '?url', import: 'default' },
);
const colorModules = import.meta.glob<ClassColors>(
  '@/assets/classes/*/colors.json',
  { eager: true, import: 'default' },
);

// Build a single ClassId-keyed map. Path looks like
// "/src/assets/classes/iop/hero.jpg" → extract "iop".
function indexByClassId<T>(modules: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [path, value] of Object.entries(modules)) {
    const match = path.match(/\/classes\/([^/]+)\//);
    if (match) out[match[1]] = value;
  }
  return out;
}

const heros = indexByClassId(heroModules);
const thumbs = indexByClassId(thumbModules);
const colors = indexByClassId(colorModules);

export function useClassAssets(classId: ClassId | null): ClassAssets | null {
  if (classId === null) return null;
  const hero = heros[classId];
  const thumb = thumbs[classId];
  const c = colors[classId];
  if (!hero || !thumb || !c) return null;
  return { thumbnailUrl: thumb, heroUrl: hero, colors: c };
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npx vitest run tests/composables/useClassAssets.spec.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Run full suite + typecheck**

```bash
npm run typecheck
npm run test:run
```

Expected: typecheck 0 errors; full suite 43/43 (41 from before + 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/composables/useClassAssets.ts tests/composables/useClassAssets.spec.ts
git commit -m "feat(assets): useClassAssets composable bundling per-class hero/thumb/colors"
```

---

## Task 5 — `ClassThumbnail` component

Renders a 56×56 square thumbnail. Falls back to the existing `ClassLogo` (hex frame) when `classId === null`.

**Files:**
- Create: `src/components/ClassThumbnail.vue`

- [ ] **Step 1: Create `src/components/ClassThumbnail.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { ClassId } from '@/types/classes';
import { useClassAssets } from '@/composables/useClassAssets';
import { CLASSES_BY_ID } from '@/data/classes';
import ClassLogo from './ClassLogo.vue';

const props = withDefaults(defineProps<{
  classId: ClassId | null;
  size?: number;
  pulse?: boolean;
}>(), {
  size: 56,
  pulse: false,
});

const assets = computed(() => useClassAssets(props.classId));
const className = computed(() => props.classId ? CLASSES_BY_ID[props.classId]?.name ?? props.classId : 'classe');
</script>

<template>
  <!-- With a class set: square thumbnail with rounded corners + subtle white edge + drop shadow -->
  <div
    v-if="assets"
    class="class-thumbnail relative flex-shrink-0 rounded-[10px] overflow-hidden"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 4px 12px rgba(0,0,0,0.5)',
    }"
  >
    <img
      :src="assets.thumbnailUrl"
      :alt="className"
      class="w-full h-full object-cover block"
      draggable="false"
    />
  </div>
  <!-- Fallback: hex frame with pulse for the unset (Lv 1 first card) state -->
  <ClassLogo
    v-else
    :class-id="classId"
    :size="size"
    :pulse="pulse"
  />
</template>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/ClassThumbnail.vue
git commit -m "feat(ui): ClassThumbnail (square portrait + ClassLogo hex fallback)"
```

---

## Task 6 — Update `CardHeader.vue`

Use `ClassThumbnail` instead of `ClassLogo`. Add a `::before` hero background. Apply CSS vars from `useClassAssets`. Update typography (Rowdies for level + title, Roboto inherited).

**Files:**
- Modify: `src/components/CardHeader.vue`

- [ ] **Step 1: Replace the script setup imports + add hero/colors computed**

Find the existing `<script setup lang="ts">` block. Replace its TOP imports + add a new computed for assets:

```ts
import { ref, computed, nextTick } from 'vue';
import ClassThumbnail from './ClassThumbnail.vue';
import { useClassAssets } from '@/composables/useClassAssets';
import type { ClassId } from '@/types/classes';
```

(Drop the `import ClassLogo from './ClassLogo.vue';` if present — `ClassThumbnail` handles the fallback internally.)

Right after the existing `defineProps`, add:
```ts
const assets = computed(() => useClassAssets(props.classId));
```

The rest of the script (refs, edit functions, commit guards, `onRemove`) stays unchanged.

- [ ] **Step 2: Replace the `<header>` template**

Find the existing `<header>` in the template and replace it entirely with:

```vue
<header
  class="header relative flex items-center gap-4 p-4 border-b border-border-subtle overflow-hidden"
  :style="assets ? {
    '--hero-url': `url(${JSON.stringify(assets.heroUrl)})`,
  } : undefined"
>
  <!-- Hero background layer (only when class is set) -->
  <div
    v-if="assets"
    aria-hidden="true"
    class="hero-bg absolute inset-0 pointer-events-none"
    :style="{
      backgroundImage: `url(${assets.heroUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: '70% 30%',
      opacity: 0.55,
      maskImage: 'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
      WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
    }"
  ></div>

  <button
    type="button"
    class="relative z-10"
    @click="emit('open-class-picker')"
    aria-label="Choisir une classe"
  >
    <ClassThumbnail :class-id="classId" :pulse="classId === null" :size="56" />
  </button>

  <div class="right relative z-10 flex-1 min-w-0">
    <div class="flex items-baseline">
      <span
        class="font-display text-[16px] uppercase tracking-[0.25em] mr-2 leading-none"
        style="color: rgba(255,255,255,0.55);"
      >Lv</span>
      <input
        v-if="editingLevel"
        ref="levelInputRef"
        v-model="levelDraft"
        type="text"
        inputmode="numeric"
        maxlength="3"
        class="font-display text-[36px] leading-none bg-transparent w-20 outline-none border-b border-dashed"
        :style="{
          color: assets ? 'var(--class-accent)' : '#fafafa',
          borderColor: assets ? 'var(--class-dominant)' : 'rgba(255,255,255,0.4)',
          textShadow: '0 2px 8px rgba(0,0,0,0.7)',
        }"
        @blur="commitLevel"
        @keydown.enter.prevent="commitLevel"
        @keydown.esc.prevent="cancelLevel"
      />
      <button
        v-else
        type="button"
        @click="startEditLevel"
        class="font-display text-[36px] leading-none border-b border-dashed cursor-text"
        :style="{
          color: assets ? 'var(--class-accent)' : '#fafafa',
          borderColor: 'rgba(255,255,255,0.2)',
          textShadow: '0 2px 8px rgba(0,0,0,0.7)',
        }"
      >{{ level ?? '—' }}</button>
    </div>
    <input
      v-if="editingTitle"
      ref="titleInputRef"
      v-model="titleDraft"
      maxlength="30"
      class="block mt-1.5 bg-transparent font-display text-[16px] tracking-[0.18em] uppercase outline-none w-full border-b border-dashed border-white/40"
      style="color: rgba(255,255,255,0.85);"
      @blur="commitTitle"
      @keydown.enter.prevent="commitTitle"
      @keydown.esc.prevent="cancelTitle"
    />
    <button
      v-else-if="showCta"
      type="button"
      class="block mt-1.5 font-display text-[16px] tracking-[0.18em] uppercase text-left"
      style="color: rgba(255,255,255,0.85);"
      @click="emit('open-class-picker')"
    >Choisir une classe</button>
    <button
      v-else
      type="button"
      class="block mt-1.5 font-display text-[16px] tracking-[0.18em] uppercase text-left w-full truncate"
      style="color: rgba(255,255,255,0.7);"
      @click="startEditTitle"
    >{{ title ?? 'Ajouter un titre' }}</button>
  </div>
  <button
    type="button"
    class="card-delete-btn absolute top-2 right-2 w-7 h-7 rounded-full text-text-faint hover:text-danger-soft hover:bg-danger/10 border border-transparent hover:border-danger/40 flex items-center justify-center text-[18px] leading-none transition-colors z-20"
    @click="onRemove"
    aria-label="Supprimer cette étape"
    title="Supprimer cette étape"
  >×</button>
</header>
```

Notes:
- The `bg-gradient-to-b from-bg-elev to-bg-surface` from the previous version is dropped — the hero now provides the background; without it, transparent on the themed card root.
- The thumbnail click target is now a `<button>` wrapping `ClassThumbnail` (which handles its own fallback).
- The hero `::before`-style layer is now a sibling div (Vue templates can't author pseudo-elements with inline styles cleanly).

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/CardHeader.vue
git commit -m "ui(card): CardHeader uses ClassThumbnail + hero background + class accent typography"
```

---

## Task 7 — Update `EquipmentCard.vue` root theming

The card root receives `data-class-id` + 3 CSS custom properties from `useClassAssets`. Border + background gradient use `color-mix()` against the class colors.

**Files:**
- Modify: `src/components/EquipmentCard.vue`

- [ ] **Step 1: Add the assets computed in `<script setup>`**

In `src/components/EquipmentCard.vue`, find the existing imports and add:
```ts
import { useClassAssets } from '@/composables/useClassAssets';
```

Right after the other computed/refs at the top of `<script setup>`, add:
```ts
const assets = computed(() => useClassAssets(props.card.classId));
```

- [ ] **Step 2: Replace the `<article>` opening tag**

Find:
```vue
<article
  class="equipment-card select-none text-left flex-shrink-0 bg-bg-surface border border-border-default rounded-xl shadow-[0_4px_32px_rgba(0,0,0,0.4)] overflow-hidden transition-all"
  :class="{ 'ring-1 ring-accent shadow-[0_0_0_1px_rgba(91,211,168,0.4),0_0_32px_rgba(91,211,168,0.15)]': isActive }"
  @mouseenter="ui.setActiveCard(card.id)"
  :style="{ width: 'var(--card-width, 320px)' }"
>
```

Replace with:
```vue
<article
  class="equipment-card select-none text-left flex-shrink-0 rounded-xl shadow-[0_4px_32px_rgba(0,0,0,0.4)] overflow-hidden transition-all"
  :class="{ 'is-active': isActive }"
  :data-class-id="card.classId ?? ''"
  :style="{
    width: 'var(--card-width, 320px)',
    ...(assets ? {
      '--class-dominant': assets.colors.dominant,
      '--class-soft': assets.colors.soft,
      '--class-accent': assets.colors.accent,
    } : {}),
    border: '1px solid ' + (assets ? `color-mix(in srgb, ${assets.colors.dominant} 40%, transparent)` : '#262626'),
    background: assets
      ? `linear-gradient(180deg, ${assets.colors.soft} 0%, color-mix(in srgb, ${assets.colors.soft} 70%, #050505) 100%)`
      : '#0a0a0a',
  }"
  @mouseenter="ui.setActiveCard(card.id)"
>
```

- [ ] **Step 3: Add active-state CSS in the component's `<style>` block (or create one)**

After the closing `</template>`, add (or append to the existing `<style scoped>`):

```vue
<style scoped>
.equipment-card.is-active {
  box-shadow:
    0 4px 32px rgba(0,0,0,0.4),
    0 0 0 1px var(--class-dominant, #5BD3A8),
    0 0 24px color-mix(in srgb, var(--class-dominant, #5BD3A8) 30%, transparent);
}
</style>
```

(If the file has no `<style scoped>` yet, add it after the closing `</template>`.)

- [ ] **Step 4: Typecheck + visually-impossible smoke**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/EquipmentCard.vue
git commit -m "ui(card): EquipmentCard root themed by class colors (CSS vars + color-mix)"
```

---

## Task 8 — Update `EquipmentCardDiff.vue` root theming

Same change as Task 7. Diff red/green internals stay as-is (semantic).

**Files:**
- Modify: `src/components/EquipmentCardDiff.vue`

- [ ] **Step 1: Add the assets computed in `<script setup>`**

In `src/components/EquipmentCardDiff.vue`, find the existing imports and add:
```ts
import { useClassAssets } from '@/composables/useClassAssets';
```

After the existing computed/refs near the top of `<script setup>`, add:
```ts
const assets = computed(() => useClassAssets(props.card.classId));
```

- [ ] **Step 2: Replace the `<article>` opening tag**

Find the article tag (the one with `equipment-card select-none text-left flex-shrink-0`...). Replace with:

```vue
<article
  class="equipment-card select-none text-left flex-shrink-0 rounded-xl shadow-[0_4px_32px_rgba(0,0,0,0.4)] overflow-hidden transition-all"
  :class="{ 'is-active': isActive }"
  :data-class-id="card.classId ?? ''"
  :style="{
    width: 'var(--card-width, 320px)',
    ...(assets ? {
      '--class-dominant': assets.colors.dominant,
      '--class-soft': assets.colors.soft,
      '--class-accent': assets.colors.accent,
    } : {}),
    border: '1px solid ' + (assets ? `color-mix(in srgb, ${assets.colors.dominant} 40%, transparent)` : '#262626'),
    background: assets
      ? `linear-gradient(180deg, ${assets.colors.soft} 0%, color-mix(in srgb, ${assets.colors.soft} 70%, #050505) 100%)`
      : '#0a0a0a',
  }"
  @mouseenter="ui.setActiveCard(card.id)"
>
```

- [ ] **Step 3: Add active-state CSS in the existing `<style scoped>` block**

Append to the existing `<style scoped>` (or create one):

```css
.equipment-card.is-active {
  box-shadow:
    0 4px 32px rgba(0,0,0,0.4),
    0 0 0 1px var(--class-dominant, #5BD3A8),
    0 0 24px color-mix(in srgb, var(--class-dominant, #5BD3A8) 30%, transparent);
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/EquipmentCardDiff.vue
git commit -m "ui(card): EquipmentCardDiff root themed (diff red/green semantic kept)"
```

---

## Task 9 — `EquipmentSlot` + `DofusCell` hover/active use `--class-dominant`

The slot icon hover/active states currently use `theme('colors.accent.DEFAULT')` (mint). Switch them to `var(--class-dominant)` so each card's slots inherit the class theme.

**Files:**
- Modify: `src/components/EquipmentSlot.vue`
- Modify: `src/components/DofusCell.vue`

- [ ] **Step 1: Update `src/components/EquipmentSlot.vue` `<style scoped>`**

Find the existing `<style scoped>` block. Replace its content with:

```css
.slot-row.is-empty:hover .icon {
  border-style: solid;
  border-color: var(--class-dominant, theme('colors.accent.DEFAULT'));
  color: var(--class-dominant, theme('colors.accent.DEFAULT'));
  background-color: color-mix(in srgb, var(--class-dominant, #5BD3A8) 6%, transparent);
}
.slot-row.is-empty:hover .label {
  color: theme('colors.text.muted');
}
.slot-row.is-filled:hover .icon {
  border-color: var(--class-dominant, theme('colors.accent.DEFAULT'));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--class-dominant, #5BD3A8) 40%, transparent);
}
.slot-row.is-over-lvl .icon {
  background-color: #2a1414;
  border-color: theme('colors.danger.DEFAULT');
  color: theme('colors.danger.soft');
  box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25), 0 0 8px rgba(220, 38, 38, 0.15);
}
.slot-row.is-active {
  background-color: color-mix(in srgb, var(--class-dominant, #5BD3A8) 5%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--class-dominant, #5BD3A8) 50%, transparent);
}
.slot-row.is-active .icon {
  border-color: var(--class-dominant, theme('colors.accent.DEFAULT'));
  background-color: theme('colors.bg-slot-filled');
  box-shadow:
    0 0 0 1px var(--class-dominant, theme('colors.accent.DEFAULT')),
    0 0 16px color-mix(in srgb, var(--class-dominant, #5BD3A8) 40%, transparent);
}
```

- [ ] **Step 2: Update `src/components/DofusCell.vue` `<style scoped>`**

Find the existing `<style scoped>` block. Replace its content with:

```css
.dofus-cell:hover:not([data-active='true']) {
  border-style: solid;
  border-color: var(--class-dominant, theme('colors.accent.DEFAULT'));
  background-color: color-mix(in srgb, var(--class-dominant, #5BD3A8) 6%, transparent);
}
.dofus-cell[data-over-lvl='true'] {
  background-color: #2a1414;
  border-color: theme('colors.danger.DEFAULT');
  box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25);
}
.dofus-cell[data-active='true'] {
  border-color: var(--class-dominant, theme('colors.accent.DEFAULT'));
  box-shadow:
    0 0 0 1px var(--class-dominant, theme('colors.accent.DEFAULT')),
    0 0 12px color-mix(in srgb, var(--class-dominant, #5BD3A8) 40%, transparent);
}
```

- [ ] **Step 3: Typecheck + tests still 41/41**

```bash
npm run typecheck
npm run test:run
```

Expected: 0 typecheck errors; 43/43 (existing 41 + 2 from Task 4).

- [ ] **Step 4: Commit**

```bash
git add src/components/EquipmentSlot.vue src/components/DofusCell.vue
git commit -m "ui(slots): hover/active use --class-dominant (mint fallback when no class)"
```

---

## Task 10 — `Connector` + `ConnectorPopover` neutralization

Pill button mint → neutral white. Popover hover items → neutral.

**Files:**
- Modify: `src/components/Connector.vue`
- Modify: `src/components/ConnectorPopover.vue`

- [ ] **Step 1: Update `src/components/Connector.vue` `:class` binding on the pill button**

Find the `<button type="button" class="pill-plus relative z-20 w-9 h-9 ...">` and replace its `:class` block with:

```vue
:class="open
  ? 'bg-text-default text-bg-page shadow-[0_0_0_3px_#050505,0_4px_12px_rgba(0,0,0,0.55)] scale-[1.08]'
  : 'bg-bg-surface border border-text-muted text-text-muted shadow-[0_0_0_3px_#050505] hover:bg-text-default hover:text-bg-page hover:border-text-default hover:scale-[1.08]'"
```

(All mint shadow / glow / accent references removed; `bg-text-default` is white, `text-bg-page` is the dark page color.)

- [ ] **Step 2: Update `src/components/ConnectorPopover.vue` button hover classes**

Find both `<button class="text-left px-3 py-2 rounded text-text-default text-[12px] flex items-center justify-between hover:bg-bg-elev hover:text-accent">` instances. Replace each with:

```vue
<button
  type="button"
  class="text-left px-3 py-2 rounded text-text-default text-[12px] flex items-center justify-between hover:bg-bg-elev hover:text-text-default"
  @click="emit('empty')"
>
```

(Replace `hover:text-accent` with `hover:text-text-default`. Keep the rest of each block — labels, click handlers — exactly as-is.)

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/Connector.vue src/components/ConnectorPopover.vue
git commit -m "ui(chrome): connector pill + popover hovers → neutral white"
```

---

## Task 11 — `AppTopBar` neutralization

Mode toggle, brand dot, action buttons → all neutral white.

**Files:**
- Modify: `src/components/AppTopBar.vue`

- [ ] **Step 1: Drop the brand dot**

Find:
```vue
<div class="brand flex items-center gap-2.5 font-display text-base text-text-default tracking-[0.18em] uppercase">
  <span class="dot w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_rgba(91,211,168,0.6)]"></span>
  Dofus level planner
</div>
```

Replace with:
```vue
<div class="brand flex items-center gap-2.5 font-display text-base text-text-default tracking-[0.18em] uppercase">
  Dofus level planner
</div>
```

- [ ] **Step 2: Update mode toggle buttons (3×)**

For each of the three mode toggle buttons (Build / Switch / Achats), replace the `:class` binding from:
```vue
:class="ui.viewMode === 'build' ? 'bg-accent text-[#061a13]' : 'text-text-muted hover:text-text-default'"
```

with:
```vue
:class="ui.viewMode === 'build' ? 'bg-text-default text-bg-page' : 'text-text-muted hover:text-text-default'"
```

Apply the same swap on the `'switch'` and `'purchase'` buttons. (Replace `bg-accent text-[#061a13]` with `bg-text-default text-bg-page` in each — three places total.)

- [ ] **Step 3: Update outline action buttons (Importer + Exporter)**

For each of the two outline buttons:
```vue
class="bg-transparent text-text-muted border border-border-default rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:border-accent hover:text-accent"
```

Replace with:
```vue
class="bg-transparent text-text-muted border border-border-default rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:border-text-default hover:text-text-default"
```

- [ ] **Step 4: Update "Nouveau build" primary button**

Find:
```vue
class="bg-accent text-[#061a13] border border-accent rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:brightness-110"
```

Replace with:
```vue
class="bg-text-default text-bg-page border border-text-default rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:brightness-90"
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppTopBar.vue
git commit -m "ui(chrome): AppTopBar mode toggle + brand + buttons → neutral white"
```

---

## Task 12 — `AppMiniMap` neutralization

Active cell white-on-dark. Hover neutral. Drop mint glow.

**Files:**
- Modify: `src/components/AppMiniMap.vue`

- [ ] **Step 1: Update active/hover classes on each cell button**

Find the `<button v-for="(card, idx) in build.cards"` block. Replace its `:class` binding from:
```vue
:class="idx === activeIndex
  ? 'bg-accent text-[#061a13] shadow-[0_0_8px_rgba(91,211,168,0.5)] font-semibold'
  : 'bg-border-default text-text-muted hover:bg-bg-elev hover:text-text-default'"
```

with:
```vue
:class="idx === activeIndex
  ? 'bg-text-default text-bg-page font-semibold'
  : 'bg-border-default text-text-muted hover:bg-bg-elev hover:text-text-default'"
```

(Drop the mint shadow glow; the white background + dark text gives sufficient prominence.)

- [ ] **Step 2: Update the stats line**

Find:
```vue
<div class="font-mono text-[10px] text-text-dim shrink-0">
  <span class="text-accent">Lv {{ lastLevel }}</span>
  · {{ build.cards.length }} cards · {{ lastLevel }} lvls
</div>
```

Replace with:
```vue
<div class="font-mono text-[10px] text-text-dim shrink-0">
  <span class="text-text-default">Lv {{ lastLevel }}</span>
  · {{ build.cards.length }} cards · {{ lastLevel }} lvls
</div>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppMiniMap.vue
git commit -m "ui(chrome): AppMiniMap active cell white-on-dark, drop mint glow"
```

---

## Task 13 — `ClassPickerModal` selected cell uses its own class colors

Each cell hovers neutral, but on selection (the picker's current class for the targeted card) the cell highlights with that class's own colors via `useClassAssets`.

**Files:**
- Modify: `src/components/ClassPickerModal.vue`

- [ ] **Step 1: Add `useClassAssets` import in `<script setup>`**

Find the existing imports and add:
```ts
import { useClassAssets } from '@/composables/useClassAssets';
```

- [ ] **Step 2: Update the cell `:class` and `:style` bindings**

Find the `<button v-for="c in CLASSES"` block. Replace it entirely with:

```vue
<button
  v-for="c in CLASSES"
  :key="c.id"
  class="cell aspect-square bg-bg-elev border rounded-[10px] flex flex-col items-center justify-center gap-1.5 px-1.5 py-2.5 transition-all"
  :class="card?.classId === c.id
    ? 'is-selected'
    : 'border-border-subtle hover:border-text-muted hover:-translate-y-0.5 hover:bg-bg-elev'"
  :style="card?.classId === c.id && useClassAssets(c.id) ? {
    borderColor: useClassAssets(c.id)!.colors.dominant,
    backgroundColor: `color-mix(in srgb, ${useClassAssets(c.id)!.colors.soft} 80%, #050505)`,
    boxShadow: `0 0 16px color-mix(in srgb, ${useClassAssets(c.id)!.colors.dominant} 25%, transparent)`,
  } : undefined"
  @click="pick(c.id)"
>
  <ClassLogo :class-id="c.id" :size="36" />
  <span class="font-display text-[11px] tracking-[0.18em] uppercase">{{ c.name }}</span>
</button>
```

(Note: `ClassLogo` is intentionally kept here — the modal grid uses the small abstract hex glyph at 36px, not the photographic thumbnail. If you'd rather show the thumbnails in the picker too, swap `ClassLogo` for `ClassThumbnail` — both accept the same `:class-id` and `:size` props. For V3 we keep ClassLogo as a stylistic distinction between the picker grid and the cards.)

- [ ] **Step 3: Update the footer text**

Find:
```vue
<footer class="border-t border-border-subtle px-5 py-2.5 text-center text-[10px] text-text-faint">
  Sélection appliquée à <span class="text-accent">cette card</span> uniquement · les vrais logos sont chargés depuis DofusDB
</footer>
```

Replace with:
```vue
<footer class="border-t border-border-subtle px-5 py-2.5 text-center text-[10px] text-text-faint">
  Sélection appliquée à <span class="text-text-default">cette card</span> uniquement
</footer>
```

(Drop the now-misleading "logos chargés depuis DofusDB" since we ship the assets locally.)

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ClassPickerModal.vue
git commit -m "ui(chrome): ClassPickerModal selected cell highlights with its own class colors"
```

---

## Task 14 — `ItemPickerSheet` neutralization

Filter pills, search input focus, item selected state — all neutral white.

**Files:**
- Modify: `src/components/ItemPickerSheet.vue`

- [ ] **Step 1: Update the sheet header title color**

Find:
```vue
<h2 class="font-display text-[11px] tracking-[0.2em] uppercase text-accent font-semibold">{{ sheetTitle }}</h2>
```

Replace with:
```vue
<h2 class="font-display text-[11px] tracking-[0.2em] uppercase text-text-default font-semibold">{{ sheetTitle }}</h2>
```

- [ ] **Step 2: Update the search input focus border**

Find:
```vue
<input
  v-model="search"
  placeholder="Rechercher…"
  class="w-full bg-bg-page border border-border-default rounded-md px-3 py-2 text-xs text-text-default outline-none focus:border-accent"
  autofocus
/>
```

Replace with:
```vue
<input
  v-model="search"
  placeholder="Rechercher…"
  class="w-full bg-bg-page border border-border-default rounded-md px-3 py-2 text-xs text-text-default outline-none focus:border-text-default"
  autofocus
/>
```

- [ ] **Step 3: Update the 5 filter pills (Tous / ≤ Lv / Au-dessus / Trier · niveau / Trier · nom)**

For each of the 5 pill buttons, replace the active-state class:
```vue
:class="filterMode === 'all' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-bg-page border-border-subtle text-text-dim'"
```

with:
```vue
:class="filterMode === 'all' ? 'bg-text-default/10 text-text-default border-text-muted' : 'bg-bg-page border-border-subtle text-text-dim'"
```

Apply the same swap to the other four pills (`'eligible'`, `'over'`, `sortMode === 'level'`, `sortMode === 'name'`). In each, replace `bg-accent/10 text-accent border-accent/40` with `bg-text-default/10 text-text-default border-text-muted`.

- [ ] **Step 4: Update the item-row "selected" state**

Find:
```vue
:class="{
  'bg-accent/[0.06] shadow-[inset_0_0_0_1px_rgba(91,211,168,0.4)]':
    target?.kind === 'slot'
      ? card?.slots[target.slot]?.itemId === it.id
      : target?.kind === 'dofus' ? card?.dofus[target.index]?.itemId === it.id : false
}"
```

Replace with:
```vue
:class="{
  'bg-text-default/5 shadow-[inset_0_0_0_1px_rgba(250,250,250,0.4)]':
    target?.kind === 'slot'
      ? card?.slots[target.slot]?.itemId === it.id
      : target?.kind === 'dofus' ? card?.dofus[target.index]?.itemId === it.id : false
}"
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/ItemPickerSheet.vue
git commit -m "ui(chrome): ItemPickerSheet pills + search + selected → neutral white"
```

---

## Task 15 — `AppPurchasePlanner` + `NpcCard` + `ItemRow` neutralization

Achats screen: room tabs, NPC labels, copy button — all neutral.

**Files:**
- Modify: `src/components/AppPurchasePlanner.vue`
- Modify: `src/components/NpcCard.vue`
- Modify: `src/components/ItemRow.vue`

- [ ] **Step 1: Update `AppPurchasePlanner.vue` "Retour à Build" button**

Find:
```vue
<button
  type="button"
  class="bg-accent text-[#061a13] border border-accent rounded-md px-4 py-2 font-sans text-[12px] font-semibold hover:brightness-110"
  @click="backToBuild"
>← Retour à Build</button>
```

Replace with:
```vue
<button
  type="button"
  class="bg-text-default text-bg-page border border-text-default rounded-md px-4 py-2 font-sans text-[12px] font-semibold hover:brightness-90"
  @click="backToBuild"
>← Retour à Build</button>
```

- [ ] **Step 2: Update `AppPurchasePlanner.vue` room-tab active state**

Find the room-tab `:class` block:
```vue
:class="[
  activeRoom === room
    ? 'bg-bg-surface text-text-default border-b-2 border-accent -mb-[1px]'
    : 'text-text-faint hover:text-text-default',
  list.totals.perRoom[room] === 0 && 'opacity-40 cursor-not-allowed hover:text-text-faint',
]"
```

Replace with:
```vue
:class="[
  activeRoom === room
    ? 'bg-bg-surface text-text-default border-b-2 border-text-default -mb-[1px]'
    : 'text-text-faint hover:text-text-default',
  list.totals.perRoom[room] === 0 && 'opacity-40 cursor-not-allowed hover:text-text-faint',
]"
```

- [ ] **Step 3: Update `NpcCard.vue` label color**

Find:
```vue
<h3 class="font-display text-[12px] text-accent/85 tracking-[0.2em] uppercase flex-1 min-w-0 truncate">{{ label }}</h3>
```

Replace with:
```vue
<h3 class="font-display text-[12px] text-text-default tracking-[0.2em] uppercase flex-1 min-w-0 truncate">{{ label }}</h3>
```

- [ ] **Step 4: Update `ItemRow.vue` copy-button hover and ✓ feedback**

Find the copy `<button>`:
```vue
<button
  type="button"
  class="w-6 h-6 rounded border bg-bg-page text-text-muted text-[12px] flex items-center justify-center transition-colors"
  :class="copied
    ? 'bg-accent text-[#061a13] border-accent'
    : 'border-border-default hover:border-accent hover:text-accent'"
  aria-label="Copier le nom"
  @click="copyName"
>{{ copied ? '✓' : '⧉' }}</button>
```

Replace with:
```vue
<button
  type="button"
  class="w-6 h-6 rounded border bg-bg-page text-text-muted text-[12px] flex items-center justify-center transition-colors"
  :class="copied
    ? 'bg-text-default text-bg-page border-text-default'
    : 'border-border-default hover:border-text-default hover:text-text-default'"
  aria-label="Copier le nom"
  @click="copyName"
>{{ copied ? '✓' : '⧉' }}</button>
```

Find the item-name `<span>`:
```vue
<span
  data-testid="item-name"
  class="flex-1 min-w-0 truncate text-text-default cursor-pointer hover:text-accent"
  :title="item.name"
  @click="copyName"
>{{ item.name }}</span>
```

Replace with:
```vue
<span
  data-testid="item-name"
  class="flex-1 min-w-0 truncate text-text-default cursor-pointer hover:opacity-80"
  :title="item.name"
  @click="copyName"
>{{ item.name }}</span>
```

- [ ] **Step 5: Run tests + typecheck**

```bash
npm run typecheck
npm run test:run
```

Expected: 0 typecheck errors; 43/43 tests still passing (`ItemRow.spec.ts` tests assert on `text` content + `clipboard.writeText` + visual feedback — none on the mint class names — so they continue to pass).

- [ ] **Step 6: Commit**

```bash
git add src/components/AppPurchasePlanner.vue src/components/NpcCard.vue src/components/ItemRow.vue
git commit -m "ui(chrome): purchase planner + NpcCard + ItemRow → neutral white"
```

---

## Task 16 — `AppSwitchView` peek labels neutralization

Switch view's left/right peek labels go from mint to neutral white.

**Files:**
- Modify: `src/components/AppSwitchView.vue`

- [ ] **Step 1: Update the prev peek label color**

Find:
```vue
<div class="peek-label flex items-center gap-3 font-display text-[20px] tracking-[0.18em] uppercase text-accent">
  <span class="text-[28px] leading-none">‹</span>
  <span>Précédent · {{ prevLevelLabel }}</span>
</div>
```

Replace with:
```vue
<div class="peek-label flex items-center gap-3 font-display text-[20px] tracking-[0.18em] uppercase text-text-default">
  <span class="text-[28px] leading-none">‹</span>
  <span>Précédent · {{ prevLevelLabel }}</span>
</div>
```

- [ ] **Step 2: Update the next peek label color**

Find:
```vue
<div class="peek-label flex items-center gap-3 font-display text-[20px] tracking-[0.18em] uppercase text-accent">
  <span>Suivant · {{ nextLevelLabel }}</span>
  <span class="text-[28px] leading-none">›</span>
</div>
```

Replace with:
```vue
<div class="peek-label flex items-center gap-3 font-display text-[20px] tracking-[0.18em] uppercase text-text-default">
  <span>Suivant · {{ nextLevelLabel }}</span>
  <span class="text-[28px] leading-none">›</span>
</div>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppSwitchView.vue
git commit -m "ui(switch): peek labels → neutral white"
```

---

## Task 17 — Drop mint radial gradients from `App.vue` background

The page background currently has two radial mint gradients. With class colors now driving the visual, the global gradients distract.

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Remove the bg-fx layer**

In the template, find and remove this block:
```vue
<div class="bg-fx absolute inset-0 pointer-events-none -z-0"
  :style="{
    background: `radial-gradient(ellipse at 30% 20%, rgba(91, 211, 168, 0.05) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(42, 133, 104, 0.04) 0%, transparent 50%)`
  }"
></div>
```

Keep the `bg-grain` layer (the dot grid stays — it's class-agnostic).

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "ui(bg): drop mint radial gradients (class colors carry the chroma now)"
```

---

## Task 18 — Final verification

**Files:**
- (none — verification only)

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 2: Run full test suite**

```bash
npm run test:run
```

Expected: 43/43 tests pass (41 existing + 2 from `useClassAssets.spec.ts`).

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: success, no warnings about missing imports. The dist size will grow due to bundled per-class images (~150-300KB × 38 = ~5–10MB total). Acceptable for a single-page app.

- [ ] **Step 4: Headless dev-server smoke**

```bash
npm run dev > ./vite-dev.log 2>&1 &
PID=$!
sleep 5
cat ./vite-dev.log
echo "---"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:5173/ || curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:5174/ || true
kill $PID 2>/dev/null
wait $PID 2>/dev/null
rm -f ./vite-dev.log
```

Expected: server starts, no console errors, HTTP 200. Manual user validation in browser is the final acceptance gate (verify hero shows in header, thumbnail replaces hex, card colors differ per class, fonts loaded, mint absent from chrome).

- [ ] **Step 5: Quick mint audit**

```bash
grep -rn 'text-accent\|bg-accent\|border-accent\|hover:text-accent\|hover:border-accent\|hover:bg-accent\|5BD3A8' src/components/ src/App.vue 2>&1 | grep -v 'EquipmentCardDiff' | head -30
```

Expected: only matches in `ConnectorPopover.vue` (none — should be clean) or as fallback values like `theme('colors.accent.DEFAULT')` and `var(--class-dominant, #5BD3A8)` in `EquipmentSlot.vue`/`DofusCell.vue` (intentional fallbacks). The diff red/green green stays in `EquipmentCardDiff.vue` (semantic, intentional). All other matches must be addressed.

If unexpected mint references remain, fix and recommit before declaring done.

---

## Self-review

- **Spec coverage**:
  - Asset folder layout: Task 1.
  - `colors.json` schema: Task 1 (19 files written).
  - Forgelance class: Task 2.
  - Font swap (Rowdies + Roboto): Task 3.
  - `useClassAssets` composable + tests: Task 4.
  - `ClassThumbnail` + `ClassLogo` fallback: Task 5.
  - `CardHeader` hero ::before + thumbnail + Rowdies: Task 6.
  - Card root border/bg gradient using class vars: Tasks 7 + 8.
  - Active card ring uses class-dominant: Tasks 7 + 8 (CSS in style block).
  - Slot/Dofus hover/active using class-dominant: Task 9.
  - Connector + popover neutral: Task 10.
  - AppTopBar neutral: Task 11.
  - AppMiniMap neutral: Task 12.
  - ClassPickerModal selected uses own class colors: Task 13.
  - ItemPickerSheet neutral: Task 14.
  - AppPurchasePlanner + NpcCard + ItemRow neutral: Task 15.
  - AppSwitchView peek labels neutral: Task 16.
  - App.vue mint radial gradients removed: Task 17.
  - Final verify: Task 18.

- **Placeholder scan**: every step has concrete code or commands; no TBD/TODO; commit messages explicit.

- **Type consistency**: `ClassAssets` and `ClassColors` defined in Task 4 are consumed unchanged in Tasks 5, 6, 7, 8, 13. CSS variables `--class-dominant` / `--class-soft` / `--class-accent` defined in Tasks 7+8 are consumed by selectors in Tasks 9, plus inherited by descendant elements in CardHeader (Task 6).

- **Known soft spot**: the hero `background-position: 70% 30%` is hardcoded for the Iop hero composition. Other class heros may center the character differently. If a specific class looks bad after rendering, the spec's "Out of scope" section calls out a future `colors.json` extension with a `heroPosition` field — not blocking V3.
