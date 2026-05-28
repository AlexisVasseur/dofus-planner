import type { SlotType } from '@/types/slots';

// Each SVG renders inside a 24×24 viewBox, colored via currentColor (so the parent's
// text color drives it). Filled silhouettes use fill-rule="evenodd" to punch out
// inner shapes (visor slits, shield cross, buckle hole) while staying single-color.
export const SLOT_ICON_SVG: Record<SlotType, string> = {
  // Knight helmet dome with a horizontal visor cut out via evenodd.
  coiffe: `<path fill="currentColor" fill-rule="evenodd" d="M12 4C7 4 5 8 5 13L5 17L19 17L19 13C19 8 17 4 12 4ZM8 11L16 11L16 13L8 13Z"/>`,
  // Pentagonal cape with shoulder yoke + draped hem.
  cape: `<path fill="currentColor" d="M7 5L12 4L17 5L19 19L13 16L11 16L5 19Z"/>`,
  // Necklace: chain drapes from both top corners (where it would disappear behind
  // the neck), sags down to a meeting point at center, with a diamond pendant
  // hanging from that point.
  amulette: `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M5 3Q4 13 12 13Q20 13 19 3"/><path fill="currentColor" d="M12 13L16 17L12 21L8 17Z"/>`,
  // Ring (stroked band) with a diamond gem mounted on top.
  anneau1: `<circle cx="12" cy="15" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M12 4L15 8L12 11L9 8Z"/>`,
  anneau2: `<circle cx="12" cy="15" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M12 4L15 8L12 11L9 8Z"/>`,
  // Strap visible all the way across, threaded through a stroked buckle frame
  // with its prong pin pointing down across the strap.
  ceinture: `<rect x="3" y="11" width="18" height="2" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.5" d="M9 9L15 9L15 15L9 15Z"/><rect x="11.5" y="9" width="1" height="6" fill="currentColor"/>`,
  // Side-profile boot inspired by inspiration/boot.png — simplified silhouette
  // only (no laces / stitching). Cuff above + body: vertical shaft transitioning
  // to the toe via a single quadratic curve (rounded bulge, no rectangular
  // ledge), V-notch in the sole at the arch, heel block at the back.
  bottes: `<rect x="6" y="3" width="7" height="2" fill="currentColor"/><path fill="currentColor" d="M7 5L12 5L12 14Q18 14 18 18L13 18L11 17L9 17L7 18L5 18L5 16L7 16Z"/>`,
  // Sword: triangular blade + crossguard + grip + pommel.
  arme: `<path fill="currentColor" d="M11 3L13 3L13 16L11 16Z"/><rect x="8" y="16" width="8" height="1.5" fill="currentColor"/><rect x="11" y="17.5" width="2" height="3" fill="currentColor"/><circle cx="12" cy="21.5" r="1" fill="currentColor"/>`,
  // Heater shield with a cross cut out via evenodd.
  bouclier: `<path fill="currentColor" fill-rule="evenodd" d="M12 4L19 6L19 12Q19 17 12 20Q5 17 5 12L5 6ZM11 8L13 8L13 11L16 11L16 13L13 13L13 17L11 17L11 13L8 13L8 11L11 11Z"/>`,
  // Cat head: two rounded ears (quadratic Bézier, control point pulled above the
  // viewBox so the curve peaks at y≈4 — same height as before but no sharp tip) +
  // round face drawn as a path with evenodd so the two eye dots (r=1.2, ~33%
  // larger than the previous r=0.9) punch out as negative space.
  familier: `<path fill="currentColor" d="M6 10Q8 -2 10 10ZM18 10Q16 -2 14 10Z"/><path fill="currentColor" fill-rule="evenodd" d="M18 14A6 6 0 1 0 6 14A6 6 0 1 0 18 14ZM11.2 13A1.2 1.2 0 1 0 8.8 13A1.2 1.2 0 1 0 11.2 13ZM15.2 13A1.2 1.2 0 1 0 12.8 13A1.2 1.2 0 1 0 15.2 13Z"/>`,
};

export function getSlotIconSvg(slot: SlotType): string {
  return SLOT_ICON_SVG[slot];
}
