# Dofus level planner

A web app to plan equipment progression by character level — for the Dofus MMO. Build a timeline of "cards" (one per planned level milestone), each with class + equipment slots + dofus/trophées; review the diffs between levels in **Reader** mode; and generate a per-room **Shopping** list of items to buy from the in-game NPCs.

> This README is a quick reference. The authoritative reference is **[`docs/as-built.md`](docs/as-built.md)**.

## Stack

Vue 3.5 + Vite 6 + TypeScript 5 · Pinia 2 · Tailwind 3 · VueUse 11 · Vitest 2 · Roboto + Rowdies (Google Fonts) · DofusDB API for items.

19 classes (Iop … Forgelance) with bundled per-class assets (hero, thumbnail, palette).

## Three views

- **Builder** — horizontal timeline of cards. Click a slot to pick an item from the side sheet. Click `+` between cards to add a new step.
- **Reader** — read-only carousel showing the equipment changes between consecutive cards (red old → green new).
- **Shopping** — all rooms (1-50, 51-100, …, 200) stacked vertically with one column per NPC. Click an item name to copy it to the clipboard.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173/
```

## Scripts

```bash
npm run typecheck    # vue-tsc --noEmit
npm test -- --run    # vitest, 43 tests
npm run build        # production build → dist/
npm run preview      # serve dist/ locally
```

## Deploy

Static SPA, no server runtime. Vercel auto-detects Vite. A `vercel.json` is committed at the repo root for SPA rewrites + immutable cache on hashed assets.

```bash
npx vercel link        # one-time
npx vercel deploy --prod
```

Or connect the GitHub repo via the Vercel dashboard for push-to-deploy.

## Persistence

Build state lives in `localStorage` under the key `dofus-planner.build.v1`. Use **Importer / Exporter** in the top bar to move builds between devices.
