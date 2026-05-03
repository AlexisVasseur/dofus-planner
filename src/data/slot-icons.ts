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
