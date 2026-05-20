import type { EffectTemplate, RawEffect } from '@/data/dofusdb';

// DofusDB encoding:
//   Range effect  →  `from < to`, both same sign  (e.g. 41/45 Vitalité, -5/-1 Soins)
//   Fixed effect  →  `from = value, to = 0`      (e.g. +1 PA, +1 PM, -10 résistance)
// The "best roll" / max-value the player can get is always `to` EXCEPT when the encoding
// is the fixed shape (to === 0, from !== 0), in which case the actual value lives in `from`.
export function effectMaxRoll(eff: RawEffect): number {
  if (eff.to === 0 && eff.from !== 0) return eff.from;
  return eff.to;
}

// DofusDB stat descriptions come as French strings like "10 à 15 Vitalité" (a roll range
// for procedurally-generated items). On hover we want to show the upper bound — the best
// case roll — so the player can compare items at a glance.
//
// Transforms:
//   "10 à 15 Vitalité"   →  "15 Vitalité"
//   "-5 à -1 Soins"      →  "-1 Soins"
//   "5 PA"               →  "5 PA"     (no range, unchanged)
//   "1 à 1 Sagesse"      →  "1 Sagesse"
//
// We keep everything else in the string intact (the stat name, signs, spacing) and only
// collapse the leading "A à B" range — anything past the second number stays.
const RANGE_RE = /^\s*(-?\d+)\s+à\s+(-?\d+)\b/;

export function maxRollOnly(stat: string): string {
  return stat.replace(RANGE_RE, '$2');
}

/** Render an effect using its template, returning the max-only form.
 *
 * DofusDB templates use a small custom DSL:
 *   `#1`              first value (range low / single value)
 *   `#2`              second value (range high)
 *   `{{~1~2 à }}`     conditional range separator (collapses when from == to)
 *   `{{~ps}}`         French plural marker — renders "s" when |value| > 1
 *   `{{~zs}}`         secondary grammatical marker, render as empty (safest default)
 *   `{{...}}`         any other unknown directive — stripped
 *
 * Strategy for "show only the upper bound":
 *   1. Drop `#1{{~1~2 à }}` entirely (the "from" part), so "#1 à #2 X" becomes "#2 X".
 *   2. Substitute remaining `#1` / `#2` with `effect.to`. Templates with only `#1`
 *      (e.g. "Repousse de #1 case{{~ps}}") collapse to a single-value rendering.
 *   3. Apply plural markers based on `effect.to`.
 *   4. Strip any leftover `{{...}}` directives. */
export function renderEffectMax(effect: RawEffect, template: EffectTemplate | null): string {
  if (!template || !template.descFr) return '';
  const max = effectMaxRoll(effect);
  const plural = Math.abs(max) > 1;
  let out = template.descFr;
  // Step 1: drop "#1 + range block" so only the upper bound remains.
  out = out.replace(/#1\{\{[^}]*\}\}/g, '');
  // Step 2: substitute placeholders with the max-roll value.
  out = out.replace(/#2/g, String(max));
  out = out.replace(/#1/g, String(max));
  // Step 3: French plural markers.
  out = out.replace(/\{\{~ps\}\}/g, plural ? 's' : '');
  out = out.replace(/\{\{~zs\}\}/g, '');
  // Step 4: strip any unknown directives so they don't leak into the UI.
  out = out.replace(/\{\{[^}]*\}\}/g, '');
  return out.trim();
}
