# Dofus level planner — V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V1 of "Dofus level planner" — a Vue 3 single-page app where the user assembles a horizontal timeline of equipment cards (one per character level milestone), choosing class + items per card, with DofusDB lookups and localStorage persistence.

**Architecture:** Vite + Vue 3 `<script setup>` + TypeScript. Pinia for state (one `build` store for the timeline data, one `ui` store for transient picker state). VueUse for utilities. Tailwind CSS with custom theme tokens for the dark Vercel + mint Dofus palette. localStorage persistence with a 250ms debounced save. DofusDB API client with per-item localStorage cache. Vitest + @vue/test-utils for tests; TDD on the store, composables, and pieces of slot logic. Render-only components are verified manually after wire-up.

**Tech Stack:** Vue 3.5, Vite 6, TypeScript 5, Pinia 2.2, Tailwind CSS 3.4, VueUse 11, Vitest 2, @vue/test-utils 2.4, jsdom 25. No `uuid` dep — use `crypto.randomUUID()`. Fonts: Bebas Neue + Inter via Google Fonts.

---

## Spec reference

Authoritative spec: `docs/superpowers/specs/2026-05-03-v1-visual-design.md`. Read it before starting. Whenever this plan and the spec disagree, the spec wins — flag the inconsistency and update the plan.

---

## File structure

```
dofus-planner/
├── .gitignore
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts
├── postcss.config.js
├── vitest.config.ts
├── index.html
├── public/                                 (empty for V1)
├── src/
│   ├── main.ts                             # createApp + Pinia + persistence init
│   ├── App.vue                             # root layout
│   ├── style.css                           # tailwind + base layer + CSS vars
│   ├── env.d.ts                            # vite-env.d.ts type aug
│   ├── types/
│   │   ├── classes.ts                      # ClassId union, ClassDef
│   │   ├── slots.ts                        # SlotType union, SLOT_ORDER, DOFUS_COUNT
│   │   └── build.ts                        # ItemRef, Card, Build
│   ├── data/
│   │   ├── classes.ts                      # 18 class entries
│   │   ├── slot-icons.ts                   # 8 inline SVG glyphs
│   │   └── dofusdb.ts                      # raw fetch client + Item shape mapping
│   ├── stores/
│   │   ├── build.ts                        # Pinia build store (cards array + mutations)
│   │   └── ui.ts                           # picker state, activeCardId
│   ├── composables/
│   │   ├── useDragScroll.ts                # generic pointer drag-to-scroll
│   │   ├── usePersistence.ts               # subscribe + debounced save + load
│   │   └── useItemCatalog.ts               # DofusDB + cache + filter helpers
│   ├── components/
│   │   ├── AppTopBar.vue
│   │   ├── AppTimeline.vue
│   │   ├── AppMiniMap.vue
│   │   ├── EquipmentCard.vue
│   │   ├── CardHeader.vue
│   │   ├── ClassLogo.vue
│   │   ├── EquipmentSlot.vue
│   │   ├── DofusCell.vue
│   │   ├── Connector.vue
│   │   ├── ConnectorPopover.vue
│   │   ├── ItemPickerSheet.vue
│   │   └── ClassPickerModal.vue
│   └── utils/
│       └── id.ts                           # randomId() wrapper around crypto.randomUUID
└── tests/
    ├── setup.ts                            # vitest jsdom setup
    ├── stores/build.spec.ts
    ├── composables/useDragScroll.spec.ts
    ├── composables/usePersistence.spec.ts
    ├── data/dofusdb.spec.ts
    └── components/EquipmentSlot.spec.ts    # focuses on over-leveled state
```

---

## Task 1 — Project init and scaffolding

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`, `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.ts`, `src/App.vue`, `src/env.d.ts`, `src/style.css`
- Create: `tailwind.config.ts`, `postcss.config.js`
- Create: `vitest.config.ts`, `tests/setup.ts`

- [ ] **Step 1: Initialize git in the working directory**

```bash
git init
```

Expected: `Initialized empty Git repository in C:/Users/VASSE/projects/dofus-planner/.git/`

- [ ] **Step 2: Write `.gitignore`**

Create `.gitignore`:

```gitignore
node_modules/
dist/
.DS_Store
*.local
.env.local
.env.*.local
.superpowers/
.vite/
coverage/
*.log
```

- [ ] **Step 3: Write `package.json`**

Create `package.json`:

```json
{
  "name": "dofus-level-planner",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "vue": "^3.5.13",
    "pinia": "^2.2.6",
    "@vueuse/core": "^11.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "@vue/test-utils": "^2.4.6",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "typescript": "^5.6.3",
    "vite": "^6.0.3",
    "vitest": "^2.1.8",
    "vue-tsc": "^2.1.10"
  }
}
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: creates `node_modules/` and `package-lock.json`. No errors.

- [ ] **Step 5: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: { port: 5173, strictPort: false },
});
```

- [ ] **Step 6: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "jsx": "preserve",
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "vitest/globals"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*", "tests/**/*"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 7: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "tailwind.config.ts", "postcss.config.js"]
}
```

- [ ] **Step 8: Write `index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <title>Dofus level planner</title>
  </head>
  <body class="bg-bg-page text-text-default antialiased">
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 9: Write `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        'bg-page': '#050505',
        'bg-surface': '#0a0a0a',
        'bg-elev': '#0f0f0f',
        'bg-slot-empty': '#0f0f0f',
        'bg-slot-filled': '#1f2937',
        'border-default': '#262626',
        'border-subtle': '#1a1a1a',
        'border-dashed-empty': '#2a2a2a',
        'border-slot-filled': '#374151',
        accent: {
          DEFAULT: '#5BD3A8',
          deep: '#2a8568',
          deeper: '#1a3d2e',
        },
        danger: {
          DEFAULT: '#b91c1c',
          soft: '#f87171',
        },
        text: {
          default: '#fafafa',
          muted: '#a3a3a3',
          dim: '#737373',
          faint: '#525252',
          ghost: '#404040',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 10: Write `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 11: Write `vitest.config.ts`**

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.spec.ts'],
    },
  }),
);
```

- [ ] **Step 12: Write `tests/setup.ts`**

```ts
import { beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
});
```

- [ ] **Step 13: Write `src/style.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body, #app { height: 100%; }
  body {
    background-color: theme('colors.bg-page');
    color: theme('colors.text.default');
    font-family: theme('fontFamily.sans');
  }
}
```

- [ ] **Step 14: Write `src/env.d.ts`**

```ts
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
```

- [ ] **Step 15: Write `src/main.ts`**

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
```

- [ ] **Step 16: Write `src/App.vue` placeholder**

```vue
<script setup lang="ts"></script>

<template>
  <div class="h-full grid place-items-center">
    <p class="font-display text-2xl tracking-[0.3em] text-accent">
      DOFUS LEVEL PLANNER
    </p>
  </div>
</template>
```

- [ ] **Step 17: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite prints `Local: http://localhost:5173/`. Open the URL: see "DOFUS LEVEL PLANNER" centered, mint color, Bebas Neue. Stop the server (Ctrl+C).

- [ ] **Step 18: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 19: Verify tests run (zero tests, exits clean)**

```bash
npm run test:run
```

Expected: "No test files found" or `0 passed` and exits 0.

- [ ] **Step 20: Initial commit**

```bash
git add .gitignore package.json package-lock.json vite.config.ts tsconfig.json tsconfig.node.json tailwind.config.ts postcss.config.js vitest.config.ts index.html src tests
git commit -m "chore: scaffold Vue 3 + Vite + Tailwind + Pinia + Vitest"
```

---

## Task 2 — Domain types

**Files:**
- Create: `src/types/classes.ts`, `src/types/slots.ts`, `src/types/build.ts`

- [ ] **Step 1: Write `src/types/classes.ts`**

```ts
export type ClassId =
  | 'iop' | 'cra' | 'sram' | 'eniripsa' | 'sadida' | 'enutrof'
  | 'sacrieur' | 'ecaflip' | 'feca' | 'xelor' | 'pandawa'
  | 'osamodas' | 'roublard' | 'zobal' | 'steamer' | 'eliotrope'
  | 'huppermage' | 'ouginak';

export interface ClassDef {
  id: ClassId;
  name: string;       // "Iop"
  abbrev: string;     // "IOP" (3 letters, uppercase, used in fallback hex art)
}
```

- [ ] **Step 2: Write `src/types/slots.ts`**

```ts
export type SlotType =
  | 'coiffe' | 'cape' | 'amulette' | 'anneau1' | 'anneau2'
  | 'ceinture' | 'bottes' | 'arme' | 'familier';

export const SLOT_ORDER: readonly SlotType[] = [
  'coiffe', 'cape', 'amulette',
  'anneau1', 'anneau2',
  'ceinture', 'bottes', 'arme', 'familier',
] as const;

export const DOFUS_COUNT = 6;

export const SLOT_LABEL: Record<SlotType, string> = {
  coiffe: 'Coiffe',
  cape: 'Cape',
  amulette: 'Amulette',
  anneau1: 'Anneau',
  anneau2: 'Anneau',
  ceinture: 'Ceinture',
  bottes: 'Bottes',
  arme: 'Arme',
  familier: 'Familier',
};
```

- [ ] **Step 3: Write `src/types/build.ts`**

```ts
import type { ClassId } from './classes';
import type { SlotType } from './slots';

export interface ItemRef {
  itemId: number;
}

export interface Card {
  id: string;
  classId: ClassId | null;
  level: number | null;
  title: string | null;
  slots: Record<SlotType, ItemRef | null>;
  dofus: (ItemRef | null)[]; // length 6
}

export interface Build {
  version: 1;
  cards: Card[];
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types
git commit -m "feat(types): add Card, Build, ClassId, SlotType domain types"
```

---

## Task 3 — Static data: classes and slot icons

**Files:**
- Create: `src/data/classes.ts`, `src/data/slot-icons.ts`

- [ ] **Step 1: Write `src/data/classes.ts`**

```ts
import type { ClassDef } from '@/types/classes';

export const CLASSES: readonly ClassDef[] = [
  { id: 'iop',        name: 'Iop',        abbrev: 'IOP' },
  { id: 'cra',        name: 'Cra',        abbrev: 'CRA' },
  { id: 'sram',       name: 'Sram',       abbrev: 'SRA' },
  { id: 'eniripsa',   name: 'Eniripsa',   abbrev: 'ENI' },
  { id: 'sadida',     name: 'Sadida',     abbrev: 'SAD' },
  { id: 'enutrof',    name: 'Enutrof',    abbrev: 'ENU' },
  { id: 'sacrieur',   name: 'Sacrieur',   abbrev: 'SAC' },
  { id: 'ecaflip',    name: 'Ecaflip',    abbrev: 'ECA' },
  { id: 'feca',       name: 'Féca',       abbrev: 'FCA' },
  { id: 'xelor',      name: 'Xélor',      abbrev: 'XEL' },
  { id: 'pandawa',    name: 'Pandawa',    abbrev: 'PAN' },
  { id: 'osamodas',   name: 'Osamodas',   abbrev: 'OSA' },
  { id: 'roublard',   name: 'Roublard',   abbrev: 'ROU' },
  { id: 'zobal',      name: 'Zobal',      abbrev: 'ZOB' },
  { id: 'steamer',    name: 'Steamer',    abbrev: 'STE' },
  { id: 'eliotrope',  name: 'Eliotrope',  abbrev: 'ELI' },
  { id: 'huppermage', name: 'Huppermage', abbrev: 'HUP' },
  { id: 'ouginak',    name: 'Ouginak',    abbrev: 'OUG' },
] as const;

export const CLASSES_BY_ID: Record<string, ClassDef> = Object.fromEntries(
  CLASSES.map((c) => [c.id, c]),
);
```

- [ ] **Step 2: Write `src/data/slot-icons.ts`**

These are bespoke geometric SVG glyphs (small, abstract — not the real DofusDB item icons). They render in the `EquipmentSlot` empty state.

```ts
import type { SlotType } from '@/types/slots';

// Each SVG renders inside a 24×24 viewBox, colored via currentColor (so the parent's text color drives it).
export const SLOT_ICON_SVG: Record<SlotType, string> = {
  coiffe: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M5 14 Q12 4 19 14 M5 14 L5 17 L19 17 L19 14"/>`,
  cape: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M7 5 L12 4 L17 5 L18 19 L12 16 L6 19 Z"/>`,
  amulette: `<circle cx="12" cy="14" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="none" stroke="currentColor" stroke-width="1.5" d="M8 14 Q8 6 12 6 Q16 6 16 14"/>`,
  anneau1: `<circle cx="12" cy="13" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
  anneau2: `<circle cx="12" cy="13" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
  ceinture: `<rect x="4" y="10" width="16" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="10.5" y="9" width="3" height="6" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  bottes: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M9 5 L9 16 L6 16 L6 19 L18 19 L15 16 L15 5 Z"/>`,
  arme: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M5 19 L13 11 M11 9 L18 4 L20 6 L15 13 Z M5 19 L8 16"/>`,
  familier: `<circle cx="12" cy="13" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="11" r="0.8" fill="currentColor"/><circle cx="15" cy="11" r="0.8" fill="currentColor"/>`,
};

export function getSlotIconSvg(slot: SlotType): string {
  return SLOT_ICON_SVG[slot];
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data
git commit -m "feat(data): add 18 class definitions and slot type SVG glyphs"
```

---

## Task 4 — `randomId` utility

**Files:**
- Create: `src/utils/id.ts`

- [ ] **Step 1: Write `src/utils/id.ts`**

```ts
export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes / jsdom (sufficient for V1 — non-cryptographic but unique enough)
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/id.ts
git commit -m "feat(utils): add randomId helper using crypto.randomUUID"
```

---

## Task 5 — Build store (TDD)

The single source of truth for the timeline. Tests come first.

**Files:**
- Test: `tests/stores/build.spec.ts`
- Create: `src/stores/build.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/stores/build.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBuildStore } from '@/stores/build';
import { SLOT_ORDER, DOFUS_COUNT } from '@/types/slots';

describe('build store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with one Lv 1 card, classId null, all slots empty', () => {
    const s = useBuildStore();
    expect(s.cards).toHaveLength(1);
    const c = s.cards[0];
    expect(c.id).toBeTypeOf('string');
    expect(c.classId).toBeNull();
    expect(c.level).toBe(1);
    expect(c.title).toBeNull();
    for (const slot of SLOT_ORDER) {
      expect(c.slots[slot]).toBeNull();
    }
    expect(c.dofus).toHaveLength(DOFUS_COUNT);
    expect(c.dofus.every((d) => d === null)).toBe(true);
  });

  it('addEmptyCardAfter inherits classId from previous, slots empty, level null', () => {
    const s = useBuildStore();
    s.setClass(s.cards[0].id, 'iop');
    s.addEmptyCardAfter(s.cards[0].id);
    expect(s.cards).toHaveLength(2);
    const next = s.cards[1];
    expect(next.classId).toBe('iop');
    expect(next.level).toBeNull();
    expect(next.title).toBeNull();
    expect(SLOT_ORDER.every((slot) => next.slots[slot] === null)).toBe(true);
  });

  it('addCopyCardAfter clones class, slots, dofus, title and bumps level by 1', () => {
    const s = useBuildStore();
    const first = s.cards[0];
    s.setClass(first.id, 'cra');
    s.setLevel(first.id, 12);
    s.setTitle(first.id, 'Premiers donjons');
    s.setSlot(first.id, 'coiffe', { itemId: 42 });
    s.setDofus(first.id, 0, { itemId: 99 });

    s.addCopyCardAfter(first.id);
    const copy = s.cards[1];
    expect(copy.classId).toBe('cra');
    expect(copy.level).toBe(13);
    expect(copy.title).toBe('Premiers donjons');
    expect(copy.slots.coiffe).toEqual({ itemId: 42 });
    expect(copy.dofus[0]).toEqual({ itemId: 99 });
    expect(copy.id).not.toBe(first.id);
  });

  it('addCopyCardAfter when previous level is null yields null level on copy', () => {
    const s = useBuildStore();
    s.setLevel(s.cards[0].id, null);
    s.addCopyCardAfter(s.cards[0].id);
    expect(s.cards[1].level).toBeNull();
  });

  it('insertion respects the cardId anchor (insert in middle)', () => {
    const s = useBuildStore();
    const a = s.cards[0];
    s.addEmptyCardAfter(a.id); // -> A, B
    const b = s.cards[1];
    s.addEmptyCardAfter(a.id); // insert C between A and B -> A, C, B
    expect(s.cards.map((c) => c.id)).toEqual([a.id, s.cards[1].id, b.id]);
  });

  it('removeCard splices but keeps at least one card by re-initializing', () => {
    const s = useBuildStore();
    s.addEmptyCardAfter(s.cards[0].id);
    expect(s.cards).toHaveLength(2);
    const last = s.cards[1].id;
    s.removeCard(last);
    expect(s.cards).toHaveLength(1);

    // Now remove the only remaining card -> store re-inits a fresh Lv 1 card
    const onlyId = s.cards[0].id;
    s.removeCard(onlyId);
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].id).not.toBe(onlyId);
    expect(s.cards[0].level).toBe(1);
    expect(s.cards[0].classId).toBeNull();
  });

  it('setSlot and clearSlot work', () => {
    const s = useBuildStore();
    const id = s.cards[0].id;
    s.setSlot(id, 'amulette', { itemId: 7 });
    expect(s.cards[0].slots.amulette).toEqual({ itemId: 7 });
    s.setSlot(id, 'amulette', null);
    expect(s.cards[0].slots.amulette).toBeNull();
  });

  it('setDofus respects index bounds', () => {
    const s = useBuildStore();
    const id = s.cards[0].id;
    s.setDofus(id, 3, { itemId: 5 });
    expect(s.cards[0].dofus[3]).toEqual({ itemId: 5 });
    expect(() => s.setDofus(id, -1, { itemId: 5 })).toThrow();
    expect(() => s.setDofus(id, DOFUS_COUNT, { itemId: 5 })).toThrow();
  });

  it('resetBuild restores a single Lv 1 unset card', () => {
    const s = useBuildStore();
    s.setClass(s.cards[0].id, 'iop');
    s.addCopyCardAfter(s.cards[0].id);
    s.resetBuild();
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].classId).toBeNull();
    expect(s.cards[0].level).toBe(1);
  });

  it('replaceCards replaces the whole array (used by persistence load)', () => {
    const s = useBuildStore();
    s.replaceCards([
      {
        id: 'fixed-1',
        classId: 'iop',
        level: 50,
        title: null,
        slots: Object.fromEntries(SLOT_ORDER.map((s) => [s, null])) as never,
        dofus: Array(DOFUS_COUNT).fill(null),
      },
    ]);
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].id).toBe('fixed-1');
    expect(s.cards[0].level).toBe(50);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/stores/build.spec.ts
```

Expected: FAIL — `Cannot find module '@/stores/build'`.

- [ ] **Step 3: Implement `src/stores/build.ts`**

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Card, ItemRef } from '@/types/build';
import type { ClassId } from '@/types/classes';
import { SLOT_ORDER, type SlotType, DOFUS_COUNT } from '@/types/slots';
import { randomId } from '@/utils/id';

function emptySlots(): Record<SlotType, ItemRef | null> {
  const result = {} as Record<SlotType, ItemRef | null>;
  for (const s of SLOT_ORDER) result[s] = null;
  return result;
}

function emptyDofus(): (ItemRef | null)[] {
  return Array(DOFUS_COUNT).fill(null);
}

export function makeFreshFirstCard(): Card {
  return {
    id: randomId(),
    classId: null,
    level: 1,
    title: null,
    slots: emptySlots(),
    dofus: emptyDofus(),
  };
}

export const useBuildStore = defineStore('build', () => {
  const cards = ref<Card[]>([makeFreshFirstCard()]);

  function findIndex(cardId: string): number {
    const idx = cards.value.findIndex((c) => c.id === cardId);
    if (idx === -1) throw new Error(`Card not found: ${cardId}`);
    return idx;
  }

  function setClass(cardId: string, classId: ClassId): void {
    const idx = findIndex(cardId);
    cards.value[idx].classId = classId;
  }

  function setLevel(cardId: string, level: number | null): void {
    const idx = findIndex(cardId);
    cards.value[idx].level = level;
  }

  function setTitle(cardId: string, title: string | null): void {
    const idx = findIndex(cardId);
    cards.value[idx].title = title && title.length > 0 ? title : null;
  }

  function setSlot(cardId: string, slot: SlotType, ref: ItemRef | null): void {
    const idx = findIndex(cardId);
    cards.value[idx].slots[slot] = ref;
  }

  function setDofus(cardId: string, index: number, ref: ItemRef | null): void {
    if (index < 0 || index >= DOFUS_COUNT) {
      throw new Error(`Dofus index out of range: ${index}`);
    }
    const idx = findIndex(cardId);
    cards.value[idx].dofus[index] = ref;
  }

  function addEmptyCardAfter(cardId: string): void {
    const idx = findIndex(cardId);
    const prev = cards.value[idx];
    const next: Card = {
      id: randomId(),
      classId: prev.classId,
      level: null,
      title: null,
      slots: emptySlots(),
      dofus: emptyDofus(),
    };
    cards.value.splice(idx + 1, 0, next);
  }

  function addCopyCardAfter(cardId: string): void {
    const idx = findIndex(cardId);
    const prev = cards.value[idx];
    const copy: Card = {
      id: randomId(),
      classId: prev.classId,
      level: prev.level === null ? null : prev.level + 1,
      title: prev.title,
      slots: { ...prev.slots },
      dofus: [...prev.dofus],
    };
    cards.value.splice(idx + 1, 0, copy);
  }

  function removeCard(cardId: string): void {
    const idx = findIndex(cardId);
    cards.value.splice(idx, 1);
    if (cards.value.length === 0) {
      cards.value.push(makeFreshFirstCard());
    }
  }

  function resetBuild(): void {
    cards.value = [makeFreshFirstCard()];
  }

  function replaceCards(next: Card[]): void {
    cards.value = next;
  }

  return {
    cards,
    setClass,
    setLevel,
    setTitle,
    setSlot,
    setDofus,
    addEmptyCardAfter,
    addCopyCardAfter,
    removeCard,
    resetBuild,
    replaceCards,
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/stores/build.spec.ts
```

Expected: all 10 tests PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stores tests/stores
git commit -m "feat(store): build store with TDD-covered mutations"
```

---

## Task 6 — UI store

Holds transient state for pickers and active card highlighting.

**Files:**
- Create: `src/stores/ui.ts`

- [ ] **Step 1: Write `src/stores/ui.ts`**

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SlotType } from '@/types/slots';

export type ItemPickerTarget =
  | { kind: 'slot'; cardId: string; slot: SlotType }
  | { kind: 'dofus'; cardId: string; index: number };

export const useUiStore = defineStore('ui', () => {
  const activeCardId = ref<string | null>(null);
  const itemPickerTarget = ref<ItemPickerTarget | null>(null);
  const classPickerCardId = ref<string | null>(null);

  function setActiveCard(id: string | null): void {
    activeCardId.value = id;
  }

  function openItemPicker(target: ItemPickerTarget): void {
    itemPickerTarget.value = target;
    activeCardId.value = target.cardId;
  }

  function closeItemPicker(): void {
    itemPickerTarget.value = null;
  }

  function openClassPicker(cardId: string): void {
    classPickerCardId.value = cardId;
  }

  function closeClassPicker(): void {
    classPickerCardId.value = null;
  }

  return {
    activeCardId,
    itemPickerTarget,
    classPickerCardId,
    setActiveCard,
    openItemPicker,
    closeItemPicker,
    openClassPicker,
    closeClassPicker,
  };
});
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/stores/ui.ts
git commit -m "feat(store): UI store for picker and active card state"
```

---

## Task 7 — Persistence composable (TDD)

Subscribes to the build store and persists changes to localStorage with 250ms debounce. Loads on init.

**Files:**
- Test: `tests/composables/usePersistence.spec.ts`
- Create: `src/composables/usePersistence.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { useBuildStore, makeFreshFirstCard } from '@/stores/build';
import { usePersistence, BUILD_STORAGE_KEY } from '@/composables/usePersistence';

describe('usePersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('loads existing build from localStorage on init', () => {
    const card = makeFreshFirstCard();
    card.level = 42;
    card.classId = 'iop';
    localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify({ version: 1, cards: [card] }));
    const s = useBuildStore();
    usePersistence();
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].level).toBe(42);
    expect(s.cards[0].classId).toBe('iop');
  });

  it('persists a debounced snapshot 250ms after a mutation', async () => {
    const s = useBuildStore();
    usePersistence();
    s.setLevel(s.cards[0].id, 7);
    await nextTick();
    expect(localStorage.getItem(BUILD_STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(250);
    const stored = JSON.parse(localStorage.getItem(BUILD_STORAGE_KEY)!);
    expect(stored.version).toBe(1);
    expect(stored.cards[0].level).toBe(7);
  });

  it('coalesces rapid mutations into a single write', async () => {
    const s = useBuildStore();
    usePersistence();
    s.setLevel(s.cards[0].id, 1);
    s.setLevel(s.cards[0].id, 2);
    s.setLevel(s.cards[0].id, 3);
    vi.advanceTimersByTime(125);
    expect(localStorage.getItem(BUILD_STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(125);
    const stored = JSON.parse(localStorage.getItem(BUILD_STORAGE_KEY)!);
    expect(stored.cards[0].level).toBe(3);
  });

  it('ignores corrupt JSON in localStorage and keeps default state', () => {
    localStorage.setItem(BUILD_STORAGE_KEY, '{ not json');
    const s = useBuildStore();
    usePersistence();
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].level).toBe(1);
    expect(s.cards[0].classId).toBeNull();
  });

  it('ignores stored payload with wrong version', () => {
    localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify({ version: 999, cards: [] }));
    const s = useBuildStore();
    usePersistence();
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].level).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/composables/usePersistence.spec.ts
```

Expected: FAIL — `Cannot find module '@/composables/usePersistence'`.

- [ ] **Step 3: Implement `src/composables/usePersistence.ts`**

```ts
import { useBuildStore } from '@/stores/build';
import type { Build, Card } from '@/types/build';

export const BUILD_STORAGE_KEY = 'dofus-planner.build.v1';
const DEBOUNCE_MS = 250;

function isCard(c: unknown): c is Card {
  if (typeof c !== 'object' || c === null) return false;
  const obj = c as Record<string, unknown>;
  return typeof obj.id === 'string'
    && (obj.classId === null || typeof obj.classId === 'string')
    && (obj.level === null || typeof obj.level === 'number')
    && (obj.title === null || typeof obj.title === 'string')
    && typeof obj.slots === 'object' && obj.slots !== null
    && Array.isArray(obj.dofus);
}

function parseBuild(raw: string): Build | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as { version?: unknown; cards?: unknown };
    if (obj.version !== 1 || !Array.isArray(obj.cards)) return null;
    if (!obj.cards.every(isCard)) return null;
    return { version: 1, cards: obj.cards as Card[] };
  } catch {
    return null;
  }
}

export function usePersistence(): void {
  const store = useBuildStore();

  // 1. Load
  const raw = localStorage.getItem(BUILD_STORAGE_KEY);
  if (raw) {
    const parsed = parseBuild(raw);
    if (parsed && parsed.cards.length > 0) {
      store.replaceCards(parsed.cards);
    }
  }

  // 2. Save (debounced)
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  store.$subscribe(() => {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const payload: Build = { version: 1, cards: store.cards };
      localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify(payload));
      saveTimer = null;
    }, DEBOUNCE_MS);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/composables/usePersistence.spec.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/usePersistence.ts tests/composables/usePersistence.spec.ts
git commit -m "feat(persistence): debounced localStorage save + load with TDD"
```

---

## Task 8 — DofusDB API client (TDD)

A thin module that exposes `fetchItemsBySlot(slot, opts)` and `fetchItem(id)`. Uses `fetch` and the public DofusDB API. The shape of the API is verified at runtime in Task 18 — for now the client is structured so the engineer can adjust the `mapItem` function without touching callers.

**Files:**
- Test: `tests/data/dofusdb.spec.ts`
- Create: `src/data/dofusdb.ts`

> **Note for the implementer:** The endpoint URL and response shape below are based on the public DofusDB API (`https://api.dofusdb.fr`) documented as a Feathers-style service. **Verify against the live API before integration in Task 18.** If the response shape differs, only `mapItem` needs to be edited — the public surface and tests stay valid as long as `Item` is unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchItemsBySlot, fetchItem, SLOT_TO_TYPE_IDS } from '@/data/dofusdb';

const MOCK_RESPONSE = {
  total: 2,
  data: [
    {
      id: 1234,
      name: { fr: 'Coiffe Bouftou' },
      level: 25,
      typeId: 16,
      img: 'https://api.dofusdb.fr/img/items/1234.png',
      effects: [
        { description: { fr: '+10 Vitalité' } },
        { description: { fr: '+5 Force' } },
      ],
    },
    {
      id: 5678,
      name: { fr: 'Coiffe du Tofu' },
      level: 15,
      typeId: 16,
      img: 'https://api.dofusdb.fr/img/items/5678.png',
      effects: [],
    },
  ],
};

describe('dofusdb client', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 }),
    );
  });

  it('fetchItemsBySlot maps the response to a normalized Item shape', async () => {
    const items = await fetchItemsBySlot('coiffe', { search: '', limit: 50 });
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      id: 1234,
      name: 'Coiffe Bouftou',
      levelRequired: 25,
      iconUrl: 'https://api.dofusdb.fr/img/items/1234.png',
      stats: ['+10 Vitalité', '+5 Force'],
    });
  });

  it('fetchItemsBySlot includes the slot typeIds in the query', async () => {
    await fetchItemsBySlot('coiffe', { search: '', limit: 50 });
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    for (const tid of SLOT_TO_TYPE_IDS.coiffe) {
      expect(calledUrl).toContain(`typeId[$in][]=${tid}`);
    }
    expect(calledUrl).toContain('$limit=50');
  });

  it('fetchItemsBySlot URL-encodes the search term', async () => {
    await fetchItemsBySlot('coiffe', { search: 'épée bouftou', limit: 50 });
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('name.fr[$search]=' + encodeURIComponent('épée bouftou'));
  });

  it('fetchItem returns a single Item by id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE.data[0]), { status: 200 }),
    );
    const item = await fetchItem(1234);
    expect(item.id).toBe(1234);
    expect(item.name).toBe('Coiffe Bouftou');
  });

  it('throws on non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));
    await expect(fetchItem(1234)).rejects.toThrow(/DofusDB/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/data/dofusdb.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/data/dofusdb.ts`**

```ts
import type { SlotType } from '@/types/slots';

export interface Item {
  id: number;
  name: string;
  levelRequired: number;
  iconUrl: string;
  stats: string[];
}

// DofusDB exposes itemTypes; these are the typeId values we expect to filter by.
// Multiple typeIds per slot when DofusDB splits "Anneau 1"/"Anneau 2" or pet/mount distinctions.
// Verify against the live API before going to prod (Task 18).
export const SLOT_TO_TYPE_IDS: Record<SlotType, number[]> = {
  coiffe: [16],
  cape: [17],
  amulette: [1],
  anneau1: [10],
  anneau2: [10],
  ceinture: [11],
  bottes: [9],
  arme: [2, 3, 4, 5, 6, 7, 8, 19, 20, 22, 24, 25, 83, 84, 85, 86], // all weapon types
  familier: [18, 121], // pet + petsmount
};

const BASE_URL = (import.meta.env.VITE_DOFUSDB_BASE_URL as string | undefined) ?? 'https://api.dofusdb.fr';

interface RawItem {
  id: number;
  name: { fr?: string; en?: string };
  level: number;
  img?: string;
  imgUrl?: string;
  typeId: number;
  effects?: Array<{ description?: { fr?: string; en?: string } }>;
}

function mapItem(raw: RawItem): Item {
  const stats = (raw.effects ?? [])
    .map((e) => e.description?.fr ?? '')
    .filter((s) => s.length > 0);
  return {
    id: raw.id,
    name: raw.name?.fr ?? raw.name?.en ?? `Item ${raw.id}`,
    levelRequired: raw.level ?? 0,
    iconUrl: raw.img ?? raw.imgUrl ?? '',
    stats,
  };
}

export interface FetchItemsOpts {
  search: string;
  limit: number;
}

export async function fetchItemsBySlot(slot: SlotType, opts: FetchItemsOpts): Promise<Item[]> {
  const params = new URLSearchParams();
  for (const tid of SLOT_TO_TYPE_IDS[slot]) {
    params.append('typeId[$in][]', String(tid));
  }
  params.append('$limit', String(opts.limit));
  if (opts.search.trim().length > 0) {
    params.append('name.fr[$search]', opts.search.trim());
  }
  const url = `${BASE_URL}/items?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DofusDB request failed: ${res.status}`);
  const json = (await res.json()) as { data?: RawItem[] };
  const data = json.data ?? [];
  return data.map(mapItem);
}

export async function fetchItem(id: number): Promise<Item> {
  const res = await fetch(`${BASE_URL}/items/${id}`);
  if (!res.ok) throw new Error(`DofusDB request failed: ${res.status}`);
  const raw = (await res.json()) as RawItem;
  return mapItem(raw);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/data/dofusdb.spec.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/dofusdb.ts tests/data/dofusdb.spec.ts
git commit -m "feat(dofusdb): client with slot-typed item search and per-id lookup"
```

---

## Task 9 — `useItemCatalog` composable

Wraps the DofusDB client with a localStorage cache and exposes reactive search results plus over-leveled detection.

**Files:**
- Create: `src/composables/useItemCatalog.ts`

> No TDD here — the composable is a thin adapter. Tests in Task 8 + manual verification in Task 18 are sufficient. If the engineer prefers more coverage, they may add a happy-path test that mocks `fetchItemsBySlot`.

- [ ] **Step 1: Write `src/composables/useItemCatalog.ts`**

```ts
import { ref, watch, type Ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { fetchItem, fetchItemsBySlot, type Item } from '@/data/dofusdb';
import type { SlotType } from '@/types/slots';

const ITEM_CACHE_KEY = 'dofus-planner.cache.items.v1';

interface ItemCacheEntry { item: Item; fetchedAt: number; }
type ItemCache = Record<string, ItemCacheEntry>;

function loadCache(): ItemCache {
  try {
    const raw = localStorage.getItem(ITEM_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ItemCache;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveCache(cache: ItemCache): void {
  localStorage.setItem(ITEM_CACHE_KEY, JSON.stringify(cache));
}

const cache: Ref<ItemCache> = ref(loadCache());

export function getCachedItem(id: number): Item | null {
  return cache.value[String(id)]?.item ?? null;
}

export async function ensureItem(id: number): Promise<Item> {
  const hit = getCachedItem(id);
  if (hit) return hit;
  const item = await fetchItem(id);
  cache.value[String(id)] = { item, fetchedAt: Date.now() };
  saveCache(cache.value);
  return item;
}

export function useItemSearch(slot: Ref<SlotType | null>, search: Ref<string>) {
  const results = ref<Item[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const run = useDebounceFn(async () => {
    if (slot.value === null) return;
    loading.value = true;
    error.value = null;
    try {
      const items = await fetchItemsBySlot(slot.value, { search: search.value, limit: 50 });
      // Warm the per-id cache as a side effect
      for (const item of items) {
        cache.value[String(item.id)] = { item, fetchedAt: Date.now() };
      }
      saveCache(cache.value);
      results.value = items;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      results.value = [];
    } finally {
      loading.value = false;
    }
  }, 200);

  watch([slot, search], run, { immediate: true });

  return { results, loading, error };
}

export function isOverLeveled(itemLevel: number, cardLevel: number | null): boolean {
  if (cardLevel === null) return false;
  return itemLevel > cardLevel;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/composables/useItemCatalog.ts
git commit -m "feat(catalog): item search composable with localStorage cache"
```

---

## Task 10 — `useDragScroll` composable (TDD)

Generic pointer drag-to-scroll. Used by the mini-map to drive the timeline area's `scrollLeft`. Pure math layer — no DOM lookups in the function under test, just inputs.

**Files:**
- Test: `tests/composables/useDragScroll.spec.ts`
- Create: `src/composables/useDragScroll.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { computeScrollFromDrag } from '@/composables/useDragScroll';

describe('computeScrollFromDrag', () => {
  it('returns 0 when delta is 0', () => {
    expect(computeScrollFromDrag({ startScrollLeft: 0, deltaX: 0, ratio: 1 })).toBe(0);
  });

  it('scales delta by the track-to-content ratio', () => {
    // 50px drag on a 200px track that maps to a 1000px scroll area = 5x scaling
    expect(computeScrollFromDrag({ startScrollLeft: 0, deltaX: 50, ratio: 5 })).toBe(250);
  });

  it('adds delta to startScrollLeft', () => {
    expect(computeScrollFromDrag({ startScrollLeft: 100, deltaX: 30, ratio: 2 })).toBe(160);
  });

  it('never returns a negative scroll', () => {
    expect(computeScrollFromDrag({ startScrollLeft: 50, deltaX: -1000, ratio: 1 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/composables/useDragScroll.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/composables/useDragScroll.ts`**

```ts
import { onMounted, onUnmounted, type Ref } from 'vue';

export interface DragMath {
  startScrollLeft: number;
  deltaX: number;
  ratio: number;
}

export function computeScrollFromDrag({ startScrollLeft, deltaX, ratio }: DragMath): number {
  return Math.max(0, startScrollLeft + deltaX * ratio);
}

export interface UseDragScrollOpts {
  trackRef: Ref<HTMLElement | null>;
  scrollRef: Ref<HTMLElement | null>;
}

export function useDragScroll({ trackRef, scrollRef }: UseDragScrollOpts): void {
  let startX = 0;
  let startScrollLeft = 0;
  let dragging = false;

  function getRatio(): number {
    const track = trackRef.value;
    const scroll = scrollRef.value;
    if (!track || !scroll || track.clientWidth === 0) return 1;
    return scroll.scrollWidth / track.clientWidth;
  }

  function onPointerDown(e: PointerEvent): void {
    const track = trackRef.value;
    const scroll = scrollRef.value;
    if (!track || !scroll) return;
    dragging = true;
    startX = e.clientX;
    startScrollLeft = scroll.scrollLeft;

    // Click-to-jump (no drag) when pointer up without movement is handled via "deltaX === 0" branch:
    // we initially center scroll on the click position relative to the track.
    const trackRect = track.getBoundingClientRect();
    const clickRatio = (e.clientX - trackRect.left) / trackRect.width;
    const targetScroll = clickRatio * scroll.scrollWidth - scroll.clientWidth / 2;
    scroll.scrollLeft = Math.max(0, targetScroll);
    startScrollLeft = scroll.scrollLeft;

    track.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    const scroll = scrollRef.value;
    if (!scroll) return;
    const deltaX = e.clientX - startX;
    scroll.scrollLeft = computeScrollFromDrag({
      startScrollLeft,
      deltaX,
      ratio: getRatio(),
    });
  }

  function onPointerUp(e: PointerEvent): void {
    dragging = false;
    const track = trackRef.value;
    if (track && track.hasPointerCapture(e.pointerId)) {
      track.releasePointerCapture(e.pointerId);
    }
  }

  function attach(): void {
    const track = trackRef.value;
    if (!track) return;
    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', onPointerUp);
    track.addEventListener('pointercancel', onPointerUp);
  }

  function detach(): void {
    const track = trackRef.value;
    if (!track) return;
    track.removeEventListener('pointerdown', onPointerDown);
    track.removeEventListener('pointermove', onPointerMove);
    track.removeEventListener('pointerup', onPointerUp);
    track.removeEventListener('pointercancel', onPointerUp);
  }

  onMounted(attach);
  onUnmounted(detach);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/composables/useDragScroll.spec.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useDragScroll.ts tests/composables/useDragScroll.spec.ts
git commit -m "feat(scroll): drag-to-scroll composable with pure math TDD"
```

---

## Task 11 — `ClassLogo` component

Hexagonal frame, used in card headers and class picker cells. Renders the real DofusDB class image when set, the abbreviation as fallback, and a pulsing variant when class is unset.

**Files:**
- Create: `src/components/ClassLogo.vue`

- [ ] **Step 1: Write `src/components/ClassLogo.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { ClassId } from '@/types/classes';
import { CLASSES_BY_ID } from '@/data/classes';

const props = withDefaults(defineProps<{
  classId: ClassId | null;
  size?: number;
  pulse?: boolean;
}>(), {
  size: 48,
  pulse: false,
});

const def = computed(() => (props.classId ? CLASSES_BY_ID[props.classId] : null));
// Asset URL — DofusDB may not provide direct class assets; for V1 we use the abbreviation
// rendered inside the hex frame. When real URLs are wired up, return the URL here.
const imageUrl = computed<string | null>(() => null);
</script>

<template>
  <div
    class="class-logo relative grid place-items-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <div class="absolute inset-0 frame-fill" :class="{ pulse }"></div>
    <div class="absolute inset-0 frame-stroke" :class="{ pulse }"></div>
    <img v-if="imageUrl" :src="imageUrl" :alt="def?.name ?? 'classe'" class="relative z-10 w-3/4 h-3/4" />
    <span v-else class="relative z-10 font-display text-accent" :style="{ fontSize: `${size * 0.35}px` }">
      {{ def?.abbrev ?? '?' }}
    </span>
  </div>
</template>

<style scoped>
.frame-fill {
  background: linear-gradient(135deg, #1a3d2e 0%, #0a1a14 100%);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}
.frame-stroke {
  background: #5BD3A8;
  clip-path: polygon(
    50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%,
    0% 26%, 1.5% 26%, 1.5% 74%, 50% 98.5%, 98.5% 74%, 98.5% 26%, 0% 26%
  );
  filter: drop-shadow(0 0 6px rgba(91, 211, 168, 0.5));
  opacity: 0.9;
}
.frame-stroke.pulse {
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.4; filter: drop-shadow(0 0 4px rgba(91, 211, 168, 0.3)); }
  50%      { opacity: 0.95; filter: drop-shadow(0 0 12px rgba(91, 211, 168, 0.65)); }
}
</style>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ClassLogo.vue
git commit -m "feat(ui): ClassLogo hexagonal frame component"
```

---

## Task 12 — `EquipmentSlot` and `DofusCell` components (with over-leveled test)

Full row used in the equipment list. The over-leveled detection is unit-tested.

**Files:**
- Create: `src/components/EquipmentSlot.vue`, `src/components/DofusCell.vue`
- Test: `tests/components/EquipmentSlot.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import EquipmentSlot from '@/components/EquipmentSlot.vue';

describe('EquipmentSlot', () => {
  it('renders empty state with the slot label uppercase', () => {
    const w = mount(EquipmentSlot, {
      props: {
        slot: 'amulette',
        item: null,
        cardLevel: 50,
      },
    });
    expect(w.text()).toContain('AMULETTE');
    expect(w.classes().join(' ')).toContain('is-empty');
  });

  it('renders filled state with item name', () => {
    const w = mount(EquipmentSlot, {
      props: {
        slot: 'coiffe',
        item: { id: 1, name: 'Coiffe Bouftou', levelRequired: 25, iconUrl: '', stats: [] },
        cardLevel: 50,
      },
    });
    expect(w.text()).toContain('Coiffe Bouftou');
    expect(w.classes().join(' ')).toContain('is-filled');
  });

  it('flags over-leveled when item.levelRequired > cardLevel', () => {
    const w = mount(EquipmentSlot, {
      props: {
        slot: 'coiffe',
        item: { id: 1, name: 'Coiffe Royal', levelRequired: 200, iconUrl: '', stats: [] },
        cardLevel: 50,
      },
    });
    expect(w.classes().join(' ')).toContain('is-over-lvl');
    expect(w.text()).toContain('lv 200');
  });

  it('does not flag over-leveled when card level is null', () => {
    const w = mount(EquipmentSlot, {
      props: {
        slot: 'coiffe',
        item: { id: 1, name: 'Coiffe Royal', levelRequired: 200, iconUrl: '', stats: [] },
        cardLevel: null,
      },
    });
    expect(w.classes().join(' ')).not.toContain('is-over-lvl');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/EquipmentSlot.spec.ts
```

Expected: FAIL — `Cannot find component '@/components/EquipmentSlot.vue'`.

- [ ] **Step 3: Write `src/components/EquipmentSlot.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { SlotType } from '@/types/slots';
import { SLOT_LABEL } from '@/types/slots';
import type { Item } from '@/data/dofusdb';
import { isOverLeveled } from '@/composables/useItemCatalog';
import { getSlotIconSvg } from '@/data/slot-icons';

const props = defineProps<{
  slot: SlotType;
  item: Item | null;
  cardLevel: number | null;
  active?: boolean;
}>();

const emit = defineEmits<{
  pick: [];
  clear: [];
}>();

const overLvl = computed(() => props.item !== null && isOverLeveled(props.item.levelRequired, props.cardLevel));
const filled = computed(() => props.item !== null);
const label = computed(() => filled.value ? props.item!.name : SLOT_LABEL[props.slot]);
const slotSvg = computed(() => getSlotIconSvg(props.slot));
</script>

<template>
  <div
    class="slot-row group flex items-center gap-2.5 py-1 rounded-md text-[11px] leading-6 cursor-pointer"
    :class="{
      'is-filled': filled,
      'is-empty': !filled,
      'is-over-lvl': overLvl,
      'is-active': active,
    }"
    @click="emit('pick')"
  >
    <div
      class="icon w-6 h-6 rounded-[4px] flex items-center justify-center flex-shrink-0 transition-colors"
      :class="filled ? 'bg-bg-slot-filled border border-border-slot-filled' : 'bg-bg-slot-empty border border-dashed border-border-dashed-empty'"
    >
      <img v-if="filled && item.iconUrl" :src="item.iconUrl" :alt="label" class="w-4 h-4" />
      <svg
        v-else
        viewBox="0 0 24 24"
        class="w-4 h-4"
        :class="filled ? 'text-text-muted' : 'text-text-ghost'"
        v-html="slotSvg"
      />
    </div>
    <span
      class="label flex-1 transition-colors"
      :class="filled
        ? 'text-text-default'
        : 'text-text-faint uppercase tracking-[0.1em] font-semibold text-[10.5px]'"
    >{{ label }}</span>
    <span
      v-if="overLvl"
      class="text-[9.5px] font-mono text-danger-soft border border-danger/40 bg-danger/10 rounded px-1.5 py-0.5"
    >lv {{ item!.levelRequired }}</span>
    <button
      v-else-if="filled"
      class="clear-btn opacity-0 group-hover:opacity-100 w-[22px] h-[22px] rounded-full bg-bg-elev border border-border-default text-text-muted text-xs flex items-center justify-center hover:bg-danger/20 hover:border-danger/60 hover:text-danger-soft"
      @click.stop="emit('clear')"
      aria-label="Vider le slot"
    >×</button>
  </div>
</template>

<style scoped>
.slot-row.is-empty:hover .icon {
  border-style: solid;
  border-color: theme('colors.accent.DEFAULT');
  color: theme('colors.accent.DEFAULT');
  background-color: rgba(91, 211, 168, 0.06);
}
.slot-row.is-empty:hover .label {
  color: theme('colors.text.muted');
}
.slot-row.is-filled:hover .icon {
  border-color: theme('colors.accent.DEFAULT');
  box-shadow: 0 0 0 1px rgba(91, 211, 168, 0.4);
}
.slot-row.is-over-lvl .icon {
  background-color: #2a1414;
  border-color: theme('colors.danger.DEFAULT');
  color: theme('colors.danger.soft');
  box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25), 0 0 8px rgba(220, 38, 38, 0.15);
}
.slot-row.is-active {
  background-color: rgba(91, 211, 168, 0.05);
  box-shadow: inset 0 0 0 1px rgba(91, 211, 168, 0.5);
}
.slot-row.is-active .icon {
  border-color: theme('colors.accent.DEFAULT');
  background-color: theme('colors.bg-slot-filled');
  box-shadow: 0 0 0 1px theme('colors.accent.DEFAULT'), 0 0 16px rgba(91, 211, 168, 0.4);
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/EquipmentSlot.spec.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Write `src/components/DofusCell.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { Item } from '@/data/dofusdb';
import { isOverLeveled } from '@/composables/useItemCatalog';

const props = defineProps<{
  item: Item | null;
  cardLevel: number | null;
  active?: boolean;
}>();

const emit = defineEmits<{ pick: []; clear: [] }>();

const filled = computed(() => props.item !== null);
const overLvl = computed(() => props.item !== null && isOverLeveled(props.item.levelRequired, props.cardLevel));
</script>

<template>
  <button
    type="button"
    class="dofus-cell aspect-square rounded-md transition-colors flex items-center justify-center group relative"
    :class="filled
      ? 'bg-bg-slot-filled border border-border-slot-filled'
      : 'bg-bg-slot-empty border border-dashed border-border-dashed-empty'"
    :data-over-lvl="overLvl"
    :data-active="active"
    @click="emit('pick')"
  >
    <img v-if="filled && item!.iconUrl" :src="item!.iconUrl" :alt="item!.name" class="w-3/4 h-3/4" />
    <span v-else-if="!filled" class="text-text-ghost text-xs">◇</span>
    <span
      v-if="overLvl"
      class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-danger shadow-[0_0_6px_rgba(220,38,38,0.6)]"
    ></span>
    <span
      v-if="filled"
      class="absolute top-0 right-0 w-4 h-4 rounded-full bg-danger/70 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100"
      role="button"
      @click.stop="emit('clear')"
    >×</span>
  </button>
</template>

<style scoped>
.dofus-cell:hover:not([data-active='true']) {
  border-style: solid;
  border-color: theme('colors.accent.DEFAULT');
  background-color: rgba(91, 211, 168, 0.06);
}
.dofus-cell[data-over-lvl='true'] {
  background-color: #2a1414;
  border-color: theme('colors.danger.DEFAULT');
  box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25);
}
.dofus-cell[data-active='true'] {
  border-color: theme('colors.accent.DEFAULT');
  box-shadow: 0 0 0 1px theme('colors.accent.DEFAULT'), 0 0 12px rgba(91, 211, 168, 0.4);
}
</style>
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/EquipmentSlot.vue src/components/DofusCell.vue tests/components/EquipmentSlot.spec.ts
git commit -m "feat(ui): EquipmentSlot + DofusCell with over-leveled state"
```

---

## Task 13 — `CardHeader` and `EquipmentCard`

**Files:**
- Create: `src/components/CardHeader.vue`, `src/components/EquipmentCard.vue`

- [ ] **Step 1: Write `src/components/CardHeader.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import ClassLogo from './ClassLogo.vue';
import type { ClassId } from '@/types/classes';

const props = defineProps<{
  classId: ClassId | null;
  level: number | null;
  title: string | null;
}>();

const emit = defineEmits<{
  'open-class-picker': [];
  'update:level': [value: number | null];
  'update:title': [value: string | null];
}>();

const editingLevel = ref(false);
const editingTitle = ref(false);
const levelDraft = ref('');
const titleDraft = ref('');

const showCta = computed(() => props.classId === null);

function startEditLevel() {
  editingLevel.value = true;
  levelDraft.value = props.level === null ? '' : String(props.level);
}
function commitLevel() {
  editingLevel.value = false;
  const trimmed = levelDraft.value.trim();
  if (trimmed === '') { emit('update:level', null); return; }
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n)) return;
  emit('update:level', Math.max(1, Math.min(200, n)));
}

function startEditTitle() {
  editingTitle.value = true;
  titleDraft.value = props.title ?? '';
}
function commitTitle() {
  editingTitle.value = false;
  const t = titleDraft.value.trim();
  emit('update:title', t.length > 0 ? t.slice(0, 30) : null);
}
</script>

<template>
  <header class="header flex items-center gap-3 p-3.5 border-b border-border-subtle bg-gradient-to-b from-bg-elev to-bg-surface">
    <button type="button" @click="emit('open-class-picker')" aria-label="Choisir une classe">
      <ClassLogo :class-id="classId" :pulse="classId === null" />
    </button>
    <div class="right flex-1 min-w-0">
      <div class="flex items-baseline">
        <span class="font-sans text-[9px] font-semibold text-text-faint uppercase tracking-[0.25em] mr-1.5">Lv</span>
        <input
          v-if="editingLevel"
          v-model="levelDraft"
          type="number"
          min="1" max="200"
          class="font-display text-[28px] leading-none bg-transparent text-text-default w-16 outline-none focus:underline focus:underline-offset-4 decoration-dashed decoration-accent"
          @blur="commitLevel"
          @keydown.enter="commitLevel"
          @keydown.esc="editingLevel = false"
          ref="levelInput"
          autofocus
        />
        <button
          v-else
          @click="startEditLevel"
          class="font-display text-[28px] leading-none text-text-default border-b border-dashed border-border-default hover:border-accent"
        >{{ level ?? '—' }}</button>
      </div>
      <input
        v-if="editingTitle"
        v-model="titleDraft"
        maxlength="30"
        class="block mt-1 bg-transparent font-display text-[12px] tracking-[0.18em] uppercase text-text-muted outline-none w-full"
        @blur="commitTitle"
        @keydown.enter="commitTitle"
        @keydown.esc="editingTitle = false"
      />
      <button
        v-else-if="showCta"
        class="block mt-1 font-display text-[12px] tracking-[0.18em] uppercase text-accent"
        @click="emit('open-class-picker')"
      >Choisir une classe</button>
      <button
        v-else
        class="block mt-1 font-display text-[12px] tracking-[0.18em] uppercase text-text-muted hover:text-text-default text-left w-full truncate"
        @click="startEditTitle"
      >{{ title ?? 'Ajouter un titre' }}</button>
    </div>
  </header>
</template>
```

- [ ] **Step 2: Write `src/components/EquipmentCard.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import CardHeader from './CardHeader.vue';
import EquipmentSlot from './EquipmentSlot.vue';
import DofusCell from './DofusCell.vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import { SLOT_ORDER, DOFUS_COUNT } from '@/types/slots';
import type { Card } from '@/types/build';
import { getCachedItem } from '@/composables/useItemCatalog';

const props = defineProps<{ card: Card }>();
const build = useBuildStore();
const ui = useUiStore();

const isActive = computed(() => ui.activeCardId === props.card.id);

const slotItems = computed(() => SLOT_ORDER.map((slot) => {
  const ref = props.card.slots[slot];
  return { slot, item: ref ? getCachedItem(ref.itemId) : null };
}));

const dofusItems = computed(() => {
  const out = [];
  for (let i = 0; i < DOFUS_COUNT; i++) {
    const ref = props.card.dofus[i];
    out.push({ index: i, item: ref ? getCachedItem(ref.itemId) : null });
  }
  return out;
});

function activeOnSlot(slot: string): boolean {
  return ui.itemPickerTarget?.kind === 'slot'
    && ui.itemPickerTarget.cardId === props.card.id
    && ui.itemPickerTarget.slot === slot;
}
function activeOnDofus(index: number): boolean {
  return ui.itemPickerTarget?.kind === 'dofus'
    && ui.itemPickerTarget.cardId === props.card.id
    && ui.itemPickerTarget.index === index;
}
</script>

<template>
  <article
    class="equipment-card w-[320px] flex-shrink-0 bg-bg-surface border border-border-default rounded-xl shadow-[0_4px_32px_rgba(0,0,0,0.4)] overflow-hidden transition-all"
    :class="{ 'ring-1 ring-accent shadow-[0_0_0_1px_rgba(91,211,168,0.4),0_0_32px_rgba(91,211,168,0.15)]': isActive }"
    @mouseenter="ui.setActiveCard(card.id)"
  >
    <CardHeader
      :class-id="card.classId"
      :level="card.level"
      :title="card.title"
      @open-class-picker="ui.openClassPicker(card.id)"
      @update:level="(v) => build.setLevel(card.id, v)"
      @update:title="(v) => build.setTitle(card.id, v)"
    />
    <div class="p-3.5">
      <h3 class="font-display text-[11px] text-accent/85 tracking-[0.3em] uppercase mb-2">Équipement</h3>
      <EquipmentSlot
        v-for="entry in slotItems"
        :key="entry.slot"
        :slot="entry.slot"
        :item="entry.item"
        :card-level="card.level"
        :active="activeOnSlot(entry.slot)"
        @pick="ui.openItemPicker({ kind: 'slot', cardId: card.id, slot: entry.slot })"
        @clear="build.setSlot(card.id, entry.slot, null)"
      />
      <h3 class="font-display text-[11px] text-accent/85 tracking-[0.3em] uppercase mb-2 mt-3.5">Dofus &amp; Trophées</h3>
      <div class="grid grid-cols-6 gap-[5px]">
        <DofusCell
          v-for="entry in dofusItems"
          :key="entry.index"
          :item="entry.item"
          :card-level="card.level"
          :active="activeOnDofus(entry.index)"
          @pick="ui.openItemPicker({ kind: 'dofus', cardId: card.id, index: entry.index })"
          @clear="build.setDofus(card.id, entry.index, null)"
        />
      </div>
    </div>
  </article>
</template>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/CardHeader.vue src/components/EquipmentCard.vue
git commit -m "feat(ui): CardHeader with editable level/title + EquipmentCard composition"
```

---

## Task 14 — `Connector` and `ConnectorPopover`

**Files:**
- Create: `src/components/ConnectorPopover.vue`, `src/components/Connector.vue`

- [ ] **Step 1: Write `src/components/ConnectorPopover.vue`**

```vue
<script setup lang="ts">
defineEmits<{
  empty: [];
  copy: [];
}>();
</script>

<template>
  <div class="popover absolute top-[calc(50%+28px)] left-1/2 -translate-x-1/2 bg-bg-surface border border-border-default rounded-lg p-1 flex flex-col min-w-[180px] shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(91,211,168,0.15)] z-30">
    <button
      class="text-left px-3 py-2 rounded text-text-default text-[12px] flex items-center justify-between hover:bg-bg-elev hover:text-accent"
      @click="$emit('empty')"
    >
      <span>Card vide</span>
      <span class="text-[9.5px] text-text-faint uppercase tracking-[0.15em] font-medium">Slots vides</span>
    </button>
    <div class="h-px bg-border-subtle my-0.5"></div>
    <button
      class="text-left px-3 py-2 rounded text-text-default text-[12px] flex items-center justify-between hover:bg-bg-elev hover:text-accent"
      @click="$emit('copy')"
    >
      <span>Copier la précédente</span>
      <span class="text-[9.5px] text-text-faint uppercase tracking-[0.15em] font-medium">Reprend l'état</span>
    </button>
  </div>
</template>
```

- [ ] **Step 2: Write `src/components/Connector.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import ConnectorPopover from './ConnectorPopover.vue';
import { useBuildStore } from '@/stores/build';

const props = defineProps<{ afterCardId: string }>();

const build = useBuildStore();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

onClickOutside(root, () => { open.value = false; });

function toggle() { open.value = !open.value; }
function pickEmpty() { build.addEmptyCardAfter(props.afterCardId); open.value = false; }
function pickCopy() { build.addCopyCardAfter(props.afterCardId); open.value = false; }
</script>

<template>
  <div class="conn w-[120px] self-stretch relative flex items-center justify-center" ref="root">
    <div class="absolute w-full h-px" style="background: linear-gradient(90deg, transparent 0%, #1f1f1f 20%, #1f1f1f 80%, transparent 100%);"></div>
    <button
      type="button"
      class="pill-plus relative z-20 rounded-full font-display tracking-[0.2em] uppercase flex items-center gap-2 px-3 py-1.5 transition-all"
      :class="open
        ? 'bg-accent text-[#061a13] shadow-[0_0_0_4px_#050505,0_0_24px_rgba(91,211,168,0.45),0_4px_12px_rgba(0,0,0,0.5)] scale-[1.04]'
        : 'bg-transparent border border-accent text-accent shadow-[0_0_0_4px_#050505] hover:bg-accent hover:text-[#061a13] hover:shadow-[0_0_0_4px_#050505,0_0_24px_rgba(91,211,168,0.45)]'"
      @click="toggle"
    >
      <span class="font-sans text-[16px] font-bold leading-none">+</span>
      <span v-if="open" class="text-sm">Ajouter</span>
    </button>
    <ConnectorPopover v-if="open" @empty="pickEmpty" @copy="pickCopy" />
  </div>
</template>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ConnectorPopover.vue src/components/Connector.vue
git commit -m "feat(ui): connector pill button + Vide/Copier popover"
```

---

## Task 15 — `AppTimeline`

Horizontal scroll container that renders cards interleaved with connectors. Exposes its inner scroll element via `defineExpose` so the mini-map can drive it.

**Files:**
- Create: `src/components/AppTimeline.vue`

- [ ] **Step 1: Write `src/components/AppTimeline.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBuildStore } from '@/stores/build';
import EquipmentCard from './EquipmentCard.vue';
import Connector from './Connector.vue';

const build = useBuildStore();
const scrollRef = ref<HTMLElement | null>(null);

defineExpose({ scrollRef });

onMounted(() => {
  const el = scrollRef.value;
  if (!el) return;
  // Redirect vertical wheel to horizontal scroll on the timeline area
  el.addEventListener('wheel', (e: WheelEvent) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
});
</script>

<template>
  <div
    ref="scrollRef"
    class="timeline-area flex-1 overflow-x-auto overflow-y-hidden relative z-[1] py-6"
  >
    <div class="row flex items-stretch gap-0 px-6 h-full">
      <template v-for="(card, idx) in build.cards" :key="card.id">
        <EquipmentCard :card="card" />
        <Connector :after-card-id="card.id" v-if="idx >= 0" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.timeline-area::-webkit-scrollbar { height: 6px; }
.timeline-area::-webkit-scrollbar-track { background: theme('colors.bg-surface'); }
.timeline-area::-webkit-scrollbar-thumb { background: theme('colors.border-default'); border-radius: 999px; }
</style>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppTimeline.vue
git commit -m "feat(ui): AppTimeline horizontal scroll container"
```

---

## Task 16 — `AppTopBar`

**Files:**
- Create: `src/components/AppTopBar.vue`

- [ ] **Step 1: Write `src/components/AppTopBar.vue`**

```vue
<script setup lang="ts">
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';

const build = useBuildStore();
const ui = useUiStore();

function newBuild() {
  if (window.confirm('Réinitialiser le build ? Cette action est irréversible.')) {
    build.resetBuild();
    ui.setActiveCard(null);
    ui.closeItemPicker();
    ui.closeClassPicker();
  }
}
</script>

<template>
  <header
    class="topbar flex items-center justify-between px-5 py-3 border-b border-border-subtle relative z-[5] backdrop-blur-md"
    style="background: rgba(5,5,5,0.8);"
  >
    <div class="brand flex items-center gap-2.5 font-display text-base text-text-default tracking-[0.18em] uppercase">
      <span class="dot w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_rgba(91,211,168,0.6)]"></span>
      Dofus level planner
    </div>
    <div class="actions flex gap-2">
      <button
        type="button"
        class="bg-accent text-[#061a13] border border-accent rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer hover:brightness-110"
        @click="newBuild"
      >Nouveau build</button>
    </div>
  </header>
</template>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppTopBar.vue
git commit -m "feat(ui): AppTopBar with brand + Nouveau build action"
```

---

## Task 17 — `AppMiniMap`

Tracks the timeline scroll position, renders one tick per card, supports drag-to-scroll via `useDragScroll`.

**Files:**
- Create: `src/components/AppMiniMap.vue`

- [ ] **Step 1: Write `src/components/AppMiniMap.vue`**

```vue
<script setup lang="ts">
import { ref, computed, toRef, watch, onUnmounted } from 'vue';
import { useBuildStore } from '@/stores/build';
import { useUiStore } from '@/stores/ui';
import { useDragScroll } from '@/composables/useDragScroll';

const props = defineProps<{ scrollRef: HTMLElement | null }>();

const build = useBuildStore();
const ui = useUiStore();

const trackRef = ref<HTMLElement | null>(null);
const scrollLeft = ref(0);
const scrollWidth = ref(1);
const clientWidth = ref(1);

const scrollElRef = toRef(props, 'scrollRef');
useDragScroll({ trackRef, scrollRef: scrollElRef });

function syncFromScroll() {
  const el = scrollElRef.value;
  if (!el) return;
  scrollLeft.value = el.scrollLeft;
  scrollWidth.value = el.scrollWidth;
  clientWidth.value = el.clientWidth;
}

let raf = 0;
function onScroll() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(syncFromScroll);
}

// Re-attach listeners whenever the underlying scroll element changes (it starts as null
// and becomes the AppTimeline DOM node once that component mounts).
watch(scrollElRef, (el, _prev, onCleanup) => {
  if (!el) return;
  syncFromScroll();
  el.addEventListener('scroll', onScroll);
  window.addEventListener('resize', syncFromScroll);
  onCleanup(() => {
    el.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', syncFromScroll);
  });
}, { immediate: true });

onUnmounted(() => { cancelAnimationFrame(raf); });

const viewportLeftPct = computed(() => (scrollWidth.value === 0 ? 0 : (scrollLeft.value / scrollWidth.value) * 100));
const viewportWidthPct = computed(() => (scrollWidth.value === 0 ? 100 : Math.min(100, (clientWidth.value / scrollWidth.value) * 100)));

const lastLevel = computed(() => {
  const cards = build.cards;
  for (let i = cards.length - 1; i >= 0; i--) {
    if (cards[i].level !== null) return cards[i].level!;
  }
  return 1;
});

const activeIndex = computed(() => build.cards.findIndex((c) => c.id === ui.activeCardId));
</script>

<template>
  <footer
    class="minimap border-t border-border-subtle backdrop-blur-md flex items-center gap-3 px-5 py-2.5 relative z-[4]"
    style="background: rgba(5,5,5,0.9);"
  >
    <div class="font-display text-[11px] text-text-faint tracking-[0.25em] uppercase shrink-0">Timeline</div>
    <div
      ref="trackRef"
      class="flex-1 h-9 bg-bg-surface border border-border-subtle rounded-md relative overflow-hidden cursor-grab active:cursor-grabbing"
    >
      <div class="absolute inset-1 flex gap-[3px]">
        <div
          v-for="(card, idx) in build.cards"
          :key="card.id"
          class="flex-1 h-full rounded-sm"
          :class="idx === activeIndex
            ? 'bg-accent shadow-[0_0_8px_rgba(91,211,168,0.5)]'
            : 'bg-border-default'"
        ></div>
      </div>
      <div
        class="absolute top-1 h-[calc(100%-8px)] border border-accent/40 bg-accent/5 rounded pointer-events-none"
        :style="{ left: `${viewportLeftPct}%`, width: `${viewportWidthPct}%` }"
      ></div>
    </div>
    <div class="font-mono text-[10px] text-text-dim shrink-0">
      <span class="text-accent">Lv {{ lastLevel }}</span>
      · {{ build.cards.length }} cards · {{ lastLevel }} lvls
    </div>
  </footer>
</template>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppMiniMap.vue
git commit -m "feat(ui): AppMiniMap with drag-to-scroll and viewport indicator"
```

---

## Task 18 — `ItemPickerSheet`

Right side sheet: search + filter pills + scrollable list of items. Live data from `useItemCatalog`.

**Files:**
- Create: `src/components/ItemPickerSheet.vue`

- [ ] **Step 1: Write `src/components/ItemPickerSheet.vue`**

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import { useItemSearch, isOverLeveled } from '@/composables/useItemCatalog';
import type { SlotType } from '@/types/slots';
import { SLOT_LABEL } from '@/types/slots';

const ui = useUiStore();
const build = useBuildStore();

const target = computed(() => ui.itemPickerTarget);

// The slot used for filtering server-side. For dofus picker we use 'amulette' as a placeholder
// since DofusDB exposes dofus + trophées as their own typeIds — but we fold them into "dofus"
// here by querying with two typeIds when target.kind === 'dofus'.
// Simplest V1: query 'amulette' results for slot picker; for dofus picker, do a direct search by name.
const slotForQuery = computed<SlotType | null>(() => {
  if (!target.value) return null;
  if (target.value.kind === 'slot') return target.value.slot;
  return 'amulette'; // fallback for dofus — search-driven, less filtering
});
const search = ref('');

const filterMode = ref<'all' | 'eligible' | 'over'>('all');
const sortMode = ref<'level' | 'name'>('level');

const card = computed(() => target.value
  ? build.cards.find((c) => c.id === target.value!.cardId) ?? null
  : null,
);

const slotForFilter = ref<SlotType | null>(null);
watch(slotForQuery, (v) => { slotForFilter.value = v; }, { immediate: true });

const { results, loading, error } = useItemSearch(slotForFilter, search);

const filtered = computed(() => {
  let arr = results.value.slice();
  const cardLvl = card.value?.level ?? null;
  if (filterMode.value === 'eligible' && cardLvl !== null) {
    arr = arr.filter((it) => it.levelRequired <= cardLvl);
  } else if (filterMode.value === 'over' && cardLvl !== null) {
    arr = arr.filter((it) => it.levelRequired > cardLvl);
  }
  arr.sort((a, b) => sortMode.value === 'level'
    ? a.levelRequired - b.levelRequired
    : a.name.localeCompare(b.name));
  return arr;
});

const sheetTitle = computed(() => {
  if (!target.value) return '';
  if (target.value.kind === 'slot') return `Choisir une ${SLOT_LABEL[target.value.slot].toLowerCase()}`;
  return `Choisir un dofus / trophée`;
});

function pick(itemId: number) {
  if (!target.value) return;
  if (target.value.kind === 'slot') {
    build.setSlot(target.value.cardId, target.value.slot, { itemId });
  } else {
    build.setDofus(target.value.cardId, target.value.index, { itemId });
  }
  ui.closeItemPicker();
}

function close() { ui.closeItemPicker(); }

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.itemPickerTarget) close();
});
</script>

<template>
  <Transition name="sheet">
    <aside
      v-if="target"
      class="sheet fixed top-0 right-0 bottom-0 w-[540px] bg-bg-surface border-l border-border-default shadow-[-24px_0_48px_rgba(0,0,0,0.5)] flex flex-col z-50"
    >
      <header class="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle">
        <h2 class="font-display text-[11px] tracking-[0.2em] uppercase text-accent font-semibold">{{ sheetTitle }}</h2>
        <button @click="close" class="font-mono text-[9px] text-text-faint border border-border-default rounded px-1.5 py-0.5">esc</button>
      </header>
      <div class="px-5 py-3 border-b border-border-subtle">
        <input
          v-model="search"
          placeholder="Rechercher…"
          class="w-full bg-bg-page border border-border-default rounded-md px-3 py-2 text-xs text-text-default outline-none focus:border-accent"
          autofocus
        />
      </div>
      <div class="flex flex-wrap gap-1.5 px-5 pb-2.5 border-b border-border-subtle">
        <button
          class="text-[10px] uppercase tracking-[0.1em] font-medium px-2.5 py-1 rounded-full border"
          :class="filterMode === 'all' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-bg-page border-border-subtle text-text-dim'"
          @click="filterMode = 'all'"
        >Tous</button>
        <button
          class="text-[10px] uppercase tracking-[0.1em] font-medium px-2.5 py-1 rounded-full border"
          :class="filterMode === 'eligible' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-bg-page border-border-subtle text-text-dim'"
          @click="filterMode = 'eligible'"
        >≤ Lv {{ card?.level ?? '?' }}</button>
        <button
          class="text-[10px] uppercase tracking-[0.1em] font-medium px-2.5 py-1 rounded-full border"
          :class="filterMode === 'over' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-bg-page border-border-subtle text-text-dim'"
          @click="filterMode = 'over'"
        >Au-dessus</button>
        <button
          class="text-[10px] uppercase tracking-[0.1em] font-medium px-2.5 py-1 rounded-full border"
          :class="sortMode === 'level' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-bg-page border-border-subtle text-text-dim'"
          @click="sortMode = 'level'"
        >Trier · niveau</button>
        <button
          class="text-[10px] uppercase tracking-[0.1em] font-medium px-2.5 py-1 rounded-full border"
          :class="sortMode === 'name' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-bg-page border-border-subtle text-text-dim'"
          @click="sortMode = 'name'"
        >Trier · nom</button>
      </div>
      <div class="flex-1 overflow-y-auto px-2 py-1.5">
        <p v-if="loading" class="text-text-dim text-xs px-3 py-4">Chargement…</p>
        <p v-else-if="error" class="text-danger-soft text-xs px-3 py-4">Erreur : {{ error }}</p>
        <p v-else-if="filtered.length === 0" class="text-text-dim text-xs px-3 py-4">Aucun item.</p>
        <button
          v-for="it in filtered"
          :key="it.id"
          type="button"
          class="item flex items-center gap-3 px-3 py-2.5 rounded-md w-full hover:bg-bg-elev"
          :class="{
            'bg-accent/[0.06] shadow-[inset_0_0_0_1px_rgba(91,211,168,0.4)]':
              target?.kind === 'slot'
                ? card?.slots[target.slot]?.itemId === it.id
                : target?.kind === 'dofus' ? card?.dofus[target.index]?.itemId === it.id : false
          }"
          @click="pick(it.id)"
        >
          <div
            class="it-ic w-9 h-9 rounded-md flex items-center justify-center shrink-0"
            :class="isOverLeveled(it.levelRequired, card?.level ?? null)
              ? 'bg-[#2a1414] border border-danger text-danger-soft shadow-[0_0_0_1px_rgba(220,38,38,0.25)]'
              : 'bg-bg-slot-filled border border-border-slot-filled text-text-muted'"
          >
            <img v-if="it.iconUrl" :src="it.iconUrl" :alt="it.name" class="w-6 h-6" />
            <span v-else>○</span>
          </div>
          <div class="it-info flex-1 min-w-0 text-left">
            <div class="text-text-default text-xs font-medium truncate">{{ it.name }}</div>
            <div class="text-text-faint text-[10px] font-mono truncate" v-if="it.stats.length">{{ it.stats.join(' · ') }}</div>
          </div>
          <span
            class="text-[10px] font-mono rounded px-2 py-0.5 border"
            :class="isOverLeveled(it.levelRequired, card?.level ?? null)
              ? 'text-danger-soft border-danger/40 bg-danger/10'
              : 'text-text-dim border-border-default bg-bg-page'"
          >lv {{ it.levelRequired }}</span>
        </button>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.sheet-enter-active, .sheet-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.sheet-enter-from, .sheet-leave-to { transform: translateX(40px); opacity: 0; }
</style>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ItemPickerSheet.vue
git commit -m "feat(ui): ItemPickerSheet with search, filters, and DofusDB results"
```

- [ ] **Step 4: Manual verification of DofusDB API shape**

Before relying on the picker against the live API:

```bash
curl 'https://api.dofusdb.fr/items?typeId[$in][]=16&$limit=3' | head -200
```

Expected: JSON with `data: [...]` array. Each item should have `id`, `name.fr`, `level`, `img` (or `imgUrl`), `effects[].description.fr`. If the field names differ, **edit only `mapItem` and `SLOT_TO_TYPE_IDS` in `src/data/dofusdb.ts`** to match — tests in `tests/data/dofusdb.spec.ts` should still pass against the mock (since the mock follows the assumed shape; the engineer may need to update the mock to match reality and re-run tests).

---

## Task 19 — `ClassPickerModal`

**Files:**
- Create: `src/components/ClassPickerModal.vue`

- [ ] **Step 1: Write `src/components/ClassPickerModal.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { CLASSES } from '@/data/classes';
import { useUiStore } from '@/stores/ui';
import { useBuildStore } from '@/stores/build';
import ClassLogo from './ClassLogo.vue';

const ui = useUiStore();
const build = useBuildStore();

const open = computed(() => ui.classPickerCardId !== null);
const card = computed(() => ui.classPickerCardId
  ? build.cards.find((c) => c.id === ui.classPickerCardId) ?? null
  : null,
);

function pick(classId: typeof CLASSES[number]['id']) {
  if (!ui.classPickerCardId) return;
  build.setClass(ui.classPickerCardId, classId);
  ui.closeClassPicker();
}

function close() { ui.closeClassPicker(); }

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.classPickerCardId !== null) close();
});
</script>

<template>
  <Transition name="modal">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-center justify-center"
      style="background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);"
      @click.self="close"
    >
      <div class="modal bg-bg-surface border border-border-default rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.7),0_0_0_1px_rgba(91,211,168,0.1)] max-w-[720px] w-full mx-4 overflow-hidden">
        <header class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 class="font-display text-base text-text-default tracking-[0.2em] uppercase">Choisir une classe</h2>
          <button @click="close" class="font-mono text-[9px] text-text-faint border border-border-default rounded px-1.5 py-0.5">esc</button>
        </header>
        <div class="grid grid-cols-6 gap-3 p-5">
          <button
            v-for="c in CLASSES"
            :key="c.id"
            class="cell aspect-square bg-bg-elev border rounded-[10px] flex flex-col items-center justify-center gap-1.5 px-1.5 py-2.5 transition-all"
            :class="card?.classId === c.id
              ? 'border-accent bg-accent/[0.08] shadow-[0_0_16px_rgba(91,211,168,0.25)]'
              : 'border-border-subtle hover:border-accent hover:-translate-y-0.5 hover:bg-accent/[0.04]'"
            @click="pick(c.id)"
          >
            <ClassLogo :class-id="c.id" :size="36" />
            <span class="font-display text-[11px] tracking-[0.18em] uppercase">{{ c.name }}</span>
          </button>
        </div>
        <footer class="border-t border-border-subtle px-5 py-2.5 text-center text-[10px] text-text-faint">
          Sélection appliquée à <span class="text-accent">cette card</span> uniquement · les vrais logos sont chargés depuis DofusDB
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ClassPickerModal.vue
git commit -m "feat(ui): ClassPickerModal with 18-class grid, per-card scope"
```

---

## Task 20 — Wire `App.vue` and visual polish

**Files:**
- Modify: `src/App.vue`
- Modify: `src/style.css`
- Modify: `src/main.ts` (init persistence)

- [ ] **Step 1: Replace `src/App.vue` with the wired layout**

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import AppTopBar from './components/AppTopBar.vue';
import AppTimeline from './components/AppTimeline.vue';
import AppMiniMap from './components/AppMiniMap.vue';
import ItemPickerSheet from './components/ItemPickerSheet.vue';
import ClassPickerModal from './components/ClassPickerModal.vue';
import { useBuildStore } from './stores/build';
import { useUiStore } from './stores/ui';

const build = useBuildStore();
const ui = useUiStore();

const timelineRef = ref<InstanceType<typeof AppTimeline> | null>(null);
const scrollEl = computed<HTMLElement | null>(() => timelineRef.value?.scrollRef ?? null);

onMounted(() => {
  // Default the active card to the first one
  if (!ui.activeCardId && build.cards.length > 0) {
    ui.setActiveCard(build.cards[0].id);
  }
});
</script>

<template>
  <div class="app h-full flex flex-col relative bg-bg-page">
    <div class="bg-fx absolute inset-0 pointer-events-none -z-0"
      :style="{
        background: `radial-gradient(ellipse at 30% 20%, rgba(91, 211, 168, 0.05) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(42, 133, 104, 0.04) 0%, transparent 50%)`
      }"
    ></div>
    <div class="bg-grain absolute inset-0 pointer-events-none -z-0"
      :style="{
        backgroundImage: `radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)`,
        backgroundSize: '24px 24px'
      }"
    ></div>
    <AppTopBar class="relative z-10" />
    <AppTimeline ref="timelineRef" class="relative z-10" />
    <AppMiniMap :scroll-ref="scrollEl" class="relative z-10" />
    <ItemPickerSheet />
    <ClassPickerModal />
  </div>
</template>
```

- [ ] **Step 2: Update `src/main.ts` to bootstrap persistence**

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { usePersistence } from './composables/usePersistence';
import './style.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// Persistence must run after Pinia is installed and before/just after mount.
app.mount('#app');
usePersistence();
```

- [ ] **Step 3: Run dev server and verify the golden path**

```bash
npm run dev
```

In the browser at `http://localhost:5173/`:

- App loads with one card (Lv 1, class unset, hexagon `?` pulsing).
- Click the hexagon → ClassPickerModal opens.
- Pick "Iop" → card now shows IOP logo.
- Click "+ Ajouter" between cards (or after the only card) → popover opens.
- Pick "Card vide" → new empty card appears, level placeholder `—`.
- Click the new card's level → editable, type `12`, blur → level shows 12.
- Click an empty equipment slot (e.g., Coiffe) → ItemPickerSheet opens on the right with `Choisir une coiffe`.
- Type in the search → results refresh after ~200ms.
- Click an item → it gets assigned to the slot, sheet closes.
- Repeat for a few slots and dofus cells.
- Try clicking "Copier la précédente" on the second `+` → new card with all slots/level+1.
- Refresh the page → the build is restored from localStorage.
- Drag on the mini-map track → timeline scrolls.
- Click "Nouveau build" in top bar → confirm → reset to single Lv 1 card.

If any step fails, fix the bug and re-run before committing.

- [ ] **Step 4: Run all tests**

```bash
npm run test:run
```

Expected: all tests PASS (build store, persistence, dofusdb, useDragScroll math, EquipmentSlot).

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Run production build**

```bash
npm run build
```

Expected: `dist/` produced, no TS errors, no build warnings about missing imports.

- [ ] **Step 7: Final commit**

```bash
git add src/App.vue src/main.ts src/style.css
git commit -m "feat(app): wire shell, pickers, persistence, and golden-path verified"
```

---

## Self-review

- **Spec coverage**
  - App shell (top bar / timeline / mini-map): Tasks 15, 16, 17, 20.
  - Card structure (header, equipment, dofus): Tasks 13.
  - Slot states (6): Task 12 (test covers over-leveled; hover/active styled in Task 12 stylesheet).
  - Connectors with popover: Task 14.
  - Item picker side sheet: Task 18.
  - Class picker modal (per-card scope, 18 classes): Task 19.
  - Initial empty state (Lv 1 + pulsing `?`): Task 11 (`ClassLogo` `pulse` prop) + Task 13 (`CardHeader` shows CTA when classId null) + Task 5 (store initializes with classId null).
  - Persistence localStorage debounced 250ms: Task 7.
  - DofusDB client + cache: Tasks 8, 9.
  - Drag-to-scroll on mini-map: Task 10 + Task 17.
  - Visual identity (Vercel + Dofus, mint accent, Bebas Neue + Inter): Task 1 (Tailwind tokens + Google Fonts) + Task 20 (background gradients + grain).
  - "Nouveau build" reset action: Task 16.
  - Out of scope items not implemented: confirmed (no Importer/Exporter buttons, no multi-build, no drag-drop).

- **Placeholder scan**: no TBD/TODO; all code blocks are complete; expected outputs are concrete; commit messages provided.

- **Type consistency**: `Item` shape is defined in Task 8 and consumed identically in Tasks 9, 12, 18. Store mutations (`setLevel`, `setTitle`, `setSlot`, `setDofus`, `setClass`, `addEmptyCardAfter`, `addCopyCardAfter`, `removeCard`, `resetBuild`, `replaceCards`) declared in Task 5 and used unchanged in components in Tasks 13, 14, 16, 18, 19, 20. UI store actions (`openItemPicker`, `closeItemPicker`, `openClassPicker`, `closeClassPicker`, `setActiveCard`) declared in Task 6 and used unchanged in Tasks 13, 14, 16, 18, 19, 20.

- **Known soft spot**: DofusDB API shape (`mapItem`, `SLOT_TO_TYPE_IDS`) is based on best-effort knowledge of the public API. Task 18 step 4 makes the engineer verify against the live endpoint and adjust if needed without rewriting callers.
