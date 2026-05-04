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
  // Bespoke entries for the two NPCs that don't correspond to a slot type.
  trophee: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M8 5 L16 5 L16 11 Q16 14 12 14 Q8 14 8 11 Z M5 5 L8 5 M16 5 L19 5 M5 5 Q5 9 8 10 M19 5 Q19 9 16 10 M12 14 L12 17 M9 19 L15 19 L13 17 L11 17 Z"/>`,
  dofus: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M12 4 L20 12 L12 20 L4 12 Z"/>`,
};

export function getNpcIconSvg(npc: NpcId): string {
  return NPC_ICON_SVG[npc];
}
