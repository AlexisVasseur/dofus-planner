import type { NpcId } from '@/types/rooms';
import { SLOT_ICON_SVG } from './slot-icons';

// Each SVG renders inside a 24×24 viewBox, currentColor-driven (same convention as slot-icons.ts).
export const NPC_ICON_SVG: Record<NpcId, string> = {
  coiffe: SLOT_ICON_SVG.coiffe,
  cape: SLOT_ICON_SVG.cape,
  amulette: SLOT_ICON_SVG.amulette,
  anneau: SLOT_ICON_SVG.anneau1, // either anneau1 or anneau2 — they share the same circle glyph
  ceinture: SLOT_ICON_SVG.ceinture,
  bottes: SLOT_ICON_SVG.bottes,
  arme: SLOT_ICON_SVG.arme,
  bouclier: SLOT_ICON_SVG.bouclier,
  familier: SLOT_ICON_SVG.familier,
  // Bespoke entries for the NPCs that don't correspond to a slot type.
  // Monture: a stylized side-view of a four-legged mount (head + body + legs).
  monture: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" d="M4 14 L4 11 Q4 9 6 9 L13 9 Q15 9 16 7 L18 7 L18 9 Q18 11 16 11 L15 11 L15 14 M9 14 L9 17 M14 14 L14 17 M6 14 L6 17"/>`,
  trophee: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M8 5 L16 5 L16 11 Q16 14 12 14 Q8 14 8 11 Z M5 5 L8 5 M16 5 L19 5 M5 5 Q5 9 8 10 M19 5 Q19 9 16 10 M12 14 L12 17 M9 19 L15 19 L13 17 L11 17 Z"/>`,
  dofus: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M12 4 L20 12 L12 20 L4 12 Z"/>`,
};

export function getNpcIconSvg(npc: NpcId): string {
  return NPC_ICON_SVG[npc];
}
