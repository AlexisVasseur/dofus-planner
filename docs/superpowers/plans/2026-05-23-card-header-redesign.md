# Card Header Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visually rework `CardHeader.vue` (hero banner + kebab dropdown) and `CardStatsPanel.vue` (XXL action row + justify-between) without changing component APIs or other card behaviours.

**Architecture:** Two files touched, no new components. `CardHeader` keeps its current emits (`open-class-picker`, `update:level`, `update:title`, `remove`, `open-dofusbook`, `copy-code`) and adds local state for the kebab menu. `CardStatsPanel` only updates CSS clamps + a single flex justify class. A Vue Test Utils unit suite covers the menu's open/close + emit wiring.

**Tech Stack:** Vue 3 SFC, Tailwind, `@vueuse/core` (`onClickOutside`, `useEventListener`), Vitest + `@vue/test-utils`.

---

## File Structure

- `src/components/CardHeader.vue` — full template rewrite + new script state (`menuOpen`, `menuRef`, outside-click handler, escape handler, menu pick handlers).
- `src/components/CardStatsPanel.vue` — `.action-icon`/`.action-value` clamps bumped, outer `<aside>` swaps `justify-center` for `justify-between`, action-row `gap-6` → `gap-8`.
- `tests/components/CardHeader.spec.ts` — new file. Verifies kebab toggles, item clicks emit the right events and close the menu, readonly hides the Supprimer item, hero overlay button emits `open-class-picker`.

Total: 2 modified components + 1 new test file. No new exports, no new types.

---

### Task 1: CardHeader test scaffold — kebab opens / closes on its own click

**Files:**
- Create: `tests/components/CardHeader.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CardHeader from '@/components/CardHeader.vue';

const baseProps = {
  classId: 'iop' as const,
  level: 100,
  title: null,
  confirmingDelete: false,
  readonly: false,
};

describe('CardHeader — kebab menu', () => {
  it('opens the menu when the kebab is clicked', async () => {
    const w = mount(CardHeader, { props: baseProps });
    expect(w.find('[data-testid="card-menu"]').exists()).toBe(false);
    await w.find('[data-testid="card-kebab"]').trigger('click');
    expect(w.find('[data-testid="card-menu"]').exists()).toBe(true);
  });

  it('closes the menu when the kebab is clicked again', async () => {
    const w = mount(CardHeader, { props: baseProps });
    await w.find('[data-testid="card-kebab"]').trigger('click');
    await w.find('[data-testid="card-kebab"]').trigger('click');
    expect(w.find('[data-testid="card-menu"]').exists()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/CardHeader.spec.ts`
Expected: FAIL — `data-testid="card-kebab"` doesn't exist yet, both tests should report "Cannot read properties of undefined" or "find returned empty".

- [ ] **Step 3: Commit failing test**

```bash
git add tests/components/CardHeader.spec.ts
git commit -m "test(card-header): kebab menu open/close (red)"
```

---

### Task 2: Replace 3 absolute buttons with kebab trigger (no menu body yet)

**Files:**
- Modify: `src/components/CardHeader.vue`

- [ ] **Step 1: Add `menuOpen` state + handlers to the script**

Find the existing `<script setup lang="ts">` block. After the `commitTitleGuard` declaration (around `let commitTitleGuard = false`), insert:

```typescript
import { onClickOutside, useEventListener } from '@vueuse/core';

const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const kebabRef = ref<HTMLElement | null>(null);

function toggleMenu(): void { menuOpen.value = !menuOpen.value; }
function closeMenu(): void { menuOpen.value = false; }

function onMenuCopyCode(): void { closeMenu(); emit('copy-code'); }
function onMenuOpenDofusbook(): void { closeMenu(); emit('open-dofusbook'); }
function onMenuRemove(): void { closeMenu(); emit('remove'); }

onClickOutside(menuRef, (e) => {
  if (!menuOpen.value) return;
  const t = e.target as HTMLElement | null;
  if (t && kebabRef.value && (t === kebabRef.value || kebabRef.value.contains(t))) return;
  closeMenu();
});
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (menuOpen.value && e.key === 'Escape') closeMenu();
});
```

Also remove the now-unused `onCopyCodeClick` and `onDofusbookClick` standalone handlers (the menu items emit directly via the wrappers above), and keep `onRemoveClick` only for the in-place delete confirm button (it stays valid).

- [ ] **Step 2: Replace the action-buttons block in the template**

Find the existing block opening with `<!-- Action buttons stacked at top-right.` and ending with the closing `</div>` of the wrapping flex container. Replace it with:

```vue
    <!-- Kebab trigger — single button overlaying the hero. -->
    <button
      ref="kebabRef"
      data-testid="card-kebab"
      type="button"
      class="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/45 border border-white/15 text-white/75 backdrop-blur-sm inline-flex items-center justify-center hover:text-[#8AE0EE] hover:border-[#8AE0EE]/40 transition-colors"
      aria-label="Actions"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      @click.stop="toggleMenu"
    >
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="5"  r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="12" cy="19" r="1.6" />
      </svg>
    </button>
```

- [ ] **Step 3: Run tests — Task 1 first assertion should now pass partially**

Run: `npx vitest run tests/components/CardHeader.spec.ts`
Expected: FAIL — "opens the menu" still fails because the `[data-testid="card-menu"]` body doesn't render yet; "closes the menu" passes vacuously. We'll fix both in Task 3.

- [ ] **Step 4: Commit kebab trigger**

```bash
git add src/components/CardHeader.vue
git commit -m "ui(card-header): replace 3 buttons with kebab trigger (no menu body yet)"
```

---

### Task 3: Render the menu body and make Task 1 pass

**Files:**
- Modify: `src/components/CardHeader.vue`

- [ ] **Step 1: Add the dropdown markup directly after the kebab button**

Insert this block immediately after the closing `</button>` of the kebab from Task 2:

```vue
    <Transition name="menu">
      <div
        v-if="menuOpen"
        ref="menuRef"
        data-testid="card-menu"
        role="menu"
        class="absolute top-12 right-3 z-20 w-44 rounded-md border border-[#5DCFE0]/40 backdrop-blur-md shadow-[0_8px_18px_rgba(0,0,0,0.5)] overflow-hidden"
        style="background: rgba(8,12,16,0.95);"
      >
        <button
          data-testid="card-menu-copy"
          type="button"
          role="menuitem"
          class="flex items-center gap-2 w-full px-3 py-2 text-left font-sans text-[11px] text-text-default hover:bg-[#5DCFE0]/[0.08] hover:text-[#8AE0EE] transition-colors"
          @click.stop="onMenuCopyCode"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          Copier le code
        </button>
        <button
          data-testid="card-menu-dofusbook"
          type="button"
          role="menuitem"
          class="flex items-center gap-2 w-full px-3 py-2 text-left font-sans text-[11px] text-text-default hover:bg-[#5DCFE0]/[0.08] hover:text-[#8AE0EE] transition-colors"
          @click.stop="onMenuOpenDofusbook"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Ouvrir Dofusbook
        </button>
        <button
          v-if="!readonly"
          data-testid="card-menu-remove"
          type="button"
          role="menuitem"
          class="flex items-center gap-2 w-full px-3 py-2 text-left font-sans text-[11px] text-danger-soft hover:bg-danger/10 transition-colors"
          @click.stop="onMenuRemove"
        >
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          Supprimer
        </button>
      </div>
    </Transition>
```

Then add the menu transition at the bottom of the existing `<style scoped>` block (or create one if absent):

```css
.menu-enter-active, .menu-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: translateY(-4px); }
```

- [ ] **Step 2: Run Task 1 tests**

Run: `npx vitest run tests/components/CardHeader.spec.ts`
Expected: PASS — both "opens the menu" and "closes the menu" assertions pass.

- [ ] **Step 3: Commit menu body**

```bash
git add src/components/CardHeader.vue
git commit -m "ui(card-header): kebab menu body — copier / dofusbook / supprimer"
```

---

### Task 4: Test + wire menu item emits

**Files:**
- Modify: `tests/components/CardHeader.spec.ts`

- [ ] **Step 1: Append three emit tests**

Add after the existing two tests in the `describe('CardHeader — kebab menu', ...)` block:

```typescript
  it('emits copy-code and closes the menu when Copier le code is picked', async () => {
    const w = mount(CardHeader, { props: baseProps });
    await w.find('[data-testid="card-kebab"]').trigger('click');
    await w.find('[data-testid="card-menu-copy"]').trigger('click');
    expect(w.emitted('copy-code')).toHaveLength(1);
    expect(w.find('[data-testid="card-menu"]').exists()).toBe(false);
  });

  it('emits open-dofusbook and closes the menu when Ouvrir Dofusbook is picked', async () => {
    const w = mount(CardHeader, { props: baseProps });
    await w.find('[data-testid="card-kebab"]').trigger('click');
    await w.find('[data-testid="card-menu-dofusbook"]').trigger('click');
    expect(w.emitted('open-dofusbook')).toHaveLength(1);
    expect(w.find('[data-testid="card-menu"]').exists()).toBe(false);
  });

  it('emits remove when Supprimer is picked, and hides Supprimer in readonly mode', async () => {
    const w = mount(CardHeader, { props: baseProps });
    await w.find('[data-testid="card-kebab"]').trigger('click');
    await w.find('[data-testid="card-menu-remove"]').trigger('click');
    expect(w.emitted('remove')).toHaveLength(1);

    const ro = mount(CardHeader, { props: { ...baseProps, readonly: true } });
    await ro.find('[data-testid="card-kebab"]').trigger('click');
    expect(ro.find('[data-testid="card-menu-remove"]').exists()).toBe(false);
  });
```

- [ ] **Step 2: Run all CardHeader tests**

Run: `npx vitest run tests/components/CardHeader.spec.ts`
Expected: PASS — all 5 tests green. The emit handlers wired in Task 2 + the menu body from Task 3 already satisfy these assertions.

- [ ] **Step 3: Commit emit tests**

```bash
git add tests/components/CardHeader.spec.ts
git commit -m "test(card-header): menu item emits + readonly hides supprimer"
```

---

### Task 5: Hero banner — header layout rewrite

**Files:**
- Modify: `src/components/CardHeader.vue`

- [ ] **Step 1: Add hero-related computed in the script**

Right after `const thumbnailUrl = computed(() => ...)`, add:

```typescript
const heroStyle = computed(() => {
  const url = thumbnailUrl.value;
  if (!url) return {} as Record<string, string>;
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center 20%',
    backgroundBlendMode: 'multiply',
    backgroundColor: 'var(--class-dominant, rgba(255,255,255,0.05))',
  } satisfies Record<string, string>;
});
```

- [ ] **Step 2: Replace the entire `<template>` content above the kebab button**

Find the opening `<header class="header relative ...">` and the closing `</div>` immediately before the kebab button (the wrapping flex row containing the class-picker-trigger + right title/level block). Replace ONLY that section (not the kebab + menu) with:

```vue
  <header class="header relative h-[76px] border-b border-border-subtle overflow-hidden">
    <!-- Hero background: class portrait blended with class accent tint, gradient on top. -->
    <div
      v-if="thumbnailUrl"
      class="absolute inset-0 opacity-60 pointer-events-none"
      :style="heroStyle"
      aria-hidden="true"
    />
    <div
      v-if="thumbnailUrl"
      class="absolute inset-0 pointer-events-none"
      style="background: linear-gradient(to right, rgba(8,18,26,0.55) 0%, rgba(8,18,26,0.95) 65%);"
      aria-hidden="true"
    />
    <!-- Click-through layer: clicking the hero (outside the text and kebab) opens the
         class picker. z-0 so the text + kebab catch their own clicks first. -->
    <button
      v-if="!readonly"
      type="button"
      class="absolute inset-0 z-0 class-picker-trigger"
      :class="{ 'cursor-pointer': !readonly }"
      aria-label="Choisir une classe"
      @click="onClassClick"
    />
    <!-- Text overlay (left aligned). -->
    <div
      class="absolute left-3 top-2 right-12 z-10"
      :style="{ color: 'var(--class-accent, rgba(255,255,255,0.9))' }"
    >
      <input
        v-if="editingTitle"
        ref="titleInputRef"
        v-model="titleDraft"
        maxlength="30"
        class="block bg-transparent font-display text-[10px] font-light tracking-[0.16em] uppercase outline-none w-full border-b border-dashed border-white/60"
        style="color: inherit;"
        @blur="commitTitle"
        @keydown.enter.prevent="commitTitle"
        @keydown.esc.prevent="cancelTitle"
      />
      <button
        v-else-if="showCta"
        type="button"
        class="block font-display text-[10px] font-light tracking-[0.16em] uppercase text-left"
        :class="readonly ? 'cursor-default' : 'hover:opacity-80'"
        style="color: inherit;"
        @click.stop="onClassClick"
      >Choisir une classe</button>
      <button
        v-else-if="title !== null || !readonly"
        type="button"
        class="block font-display text-[10px] font-light tracking-[0.16em] uppercase text-left w-full truncate"
        :class="readonly ? 'cursor-default' : 'hover:opacity-80'"
        style="color: inherit;"
        @click.stop="startEditTitle"
      >{{ title ?? 'Ajouter un titre' }}</button>
      <div class="flex items-baseline gap-1.5 mt-1">
        <span
          class="font-display text-[11px] font-bold uppercase tracking-[0.16em] leading-none text-white/70"
        >Niv</span>
        <input
          v-if="editingLevel"
          ref="levelInputRef"
          v-model="levelDraft"
          type="text"
          inputmode="numeric"
          maxlength="3"
          class="font-display text-[26px] font-bold leading-none bg-transparent w-14 outline-none border-b border-dashed border-white/60 text-white"
          @blur="commitLevel"
          @keydown.enter.prevent="commitLevel"
          @keydown.esc.prevent="cancelLevel"
        />
        <button
          v-else
          type="button"
          @click.stop="startEditLevel"
          class="font-display text-[26px] font-bold leading-none text-white"
          :class="readonly
            ? 'cursor-default'
            : 'border-b border-dashed border-white/30 hover:border-white/70 cursor-text'"
        >{{ level ?? '—' }}</button>
      </div>
    </div>
```

Note: the kebab button + menu block from Tasks 2-3 stays AFTER this and BEFORE the `</header>` close.

- [ ] **Step 3: Bump the kebab `z-index` so it sits above the click-through layer**

Find the kebab `<button>` from Task 2 — its `class` already has `top-3 right-3`. Add `z-10` so it stacks above the hero click-through button:

Replace `class="absolute top-3 right-3 w-7 h-7 rounded-full ...` with
`class="absolute top-3 right-3 z-10 w-7 h-7 rounded-full ...`

Also bump the menu container in Task 3 from `z-20` to keep it above the kebab (already `z-20`, leave it).

- [ ] **Step 4: Verify the header tests still pass**

Run: `npx vitest run tests/components/CardHeader.spec.ts`
Expected: PASS — all 5 tests stay green. The hero overlay button doesn't fire on programmatic kebab clicks.

- [ ] **Step 5: Type-check + build**

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 6: Commit hero banner**

```bash
git add src/components/CardHeader.vue
git commit -m "ui(card-header): hero banner — full-bleed class portrait + gradient text overlay"
```

---

### Task 6: CardStatsPanel — XXL action row + justify-between

**Files:**
- Modify: `src/components/CardStatsPanel.vue`

- [ ] **Step 1: Bump the action-row gap in the template**

Find the action row container (the first `<div>` inside `<aside class="card-stats-h">`). The current class string ends with `gap-6`. Replace `gap-6` with `gap-8`:

```vue
    <div class="flex justify-center items-end gap-8 flex-shrink-0">
```

- [ ] **Step 2: Swap `justify-center` for `justify-between` on the stats table**

Find the `<div class="stats-table flex-1 min-h-0 flex flex-col justify-center">` declaration. Change `justify-center` to `justify-between`:

```vue
    <div class="stats-table flex-1 min-h-0 flex flex-col justify-between">
```

- [ ] **Step 3: Bump the CSS clamps in the scoped style block**

Find the `<style scoped>` block. Replace the `.action-icon` and `.action-value` rules with:

```css
.action-icon {
  width: clamp(36px, 11cqb, 72px);
  height: clamp(36px, 11cqb, 72px);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
}
.action-value {
  font-size: clamp(18px, 5cqb, 28px);
}
```

- [ ] **Step 4: Type-check + build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Run the full test suite to make sure nothing else regressed**

Run: `npm test -- --run`
Expected: PASS — all existing tests + the 5 new CardHeader tests.

- [ ] **Step 6: Commit stats panel changes**

```bash
git add src/components/CardStatsPanel.vue
git commit -m "ui(card-stats): XXL action row + justify-between to absorb central dead space"
```

---

### Task 7: Manual smoke-check + final commit

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: dev server boots, prints local URL.

- [ ] **Step 2: Visual checklist in browser**

Open the dev URL. Verify each of these on a card with a class chosen and at least one item equipped:

1. Hero image fills the entire top band, no gap above or to the left of the image.
2. Title text + "NIV X" are legible over the gradient.
3. Single `⋮` kebab in the top-right corner; click opens the dropdown with 3 items.
4. Click "Copier le code" → toast "Code copié...", menu closes.
5. Click "Ouvrir Dofusbook" → opens a new tab with the share URL, menu closes.
6. Click "Supprimer" → menu closes and the in-place delete confirm panel appears.
7. PA/PM/PO icons are visibly larger than the stats row icons.
8. No big dead vertical band between PA/PM/PO and the stats table.
9. Reader view (mode switch): kebab shows only Copier + Dofusbook, no Supprimer.

- [ ] **Step 3: Stop the dev server**

Press `Ctrl+C` in the dev server terminal.

- [ ] **Step 4: Final lint/build pass**

Run: `npm run build && npm test -- --run`
Expected: build green, all tests pass.

- [ ] **Step 5: Push branch**

```bash
git push origin HEAD:main
```

---

## Self-review checklist

- **Spec coverage:**
  - Hero banner image + gradient + class-accent blend → Task 5 ✓
  - No-class CTA state → covered by `v-if="thumbnailUrl"` guards in Task 5 ✓
  - Click hero to open class picker → click-through `<button>` in Task 5 ✓
  - Kebab + dropdown + 3 items → Tasks 2-3 ✓
  - readonly hides Supprimer → Task 3 `v-if="!readonly"` + Task 4 test ✓
  - Outside-click + Escape close → Task 2 script ✓
  - Action icons clamp 36→72px + values 18→28px → Task 6 ✓
  - justify-center → justify-between → Task 6 ✓
  - Gap 6 → 8 → Task 6 ✓
- **No placeholders:** every code block is complete, no "TODO"/"TBD".
- **Type consistency:** emit names match the existing `defineEmits` declaration (`copy-code`, `open-dofusbook`, `remove`, `open-class-picker`). `data-testid` values consistent between tests and template.
