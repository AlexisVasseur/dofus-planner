export interface ClassColors {
  dominant: string;
  soft: string;
  accent: string;
}

export interface ClassAssets {
  hero: string;
  thumbnail: string;
  colors: ClassColors;
}

// Eager globs: bundled at build time, resolved synchronously.
// Hero/thumbnail come back as URL strings (?url + import: 'default').
// colors.json comes back as parsed JSON object (import: 'default').
const HERO_GLOB = import.meta.glob('@/assets/classes/*/hero.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const THUMB_GLOB = import.meta.glob('@/assets/classes/*/thumbnail.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const COLORS_GLOB = import.meta.glob('@/assets/classes/*/colors.json', {
  eager: true,
  import: 'default',
}) as Record<string, ClassColors>;

function classIdOf(path: string, file: string): string | null {
  const re = new RegExp(`classes/([^/]+)/${file}$`);
  const m = re.exec(path);
  return m ? m[1] : null;
}

function buildIndex(): Map<string, ClassAssets> {
  const heroByClass = new Map<string, string>();
  const thumbByClass = new Map<string, string>();
  const colorsByClass = new Map<string, ClassColors>();

  for (const [path, url] of Object.entries(HERO_GLOB)) {
    const id = classIdOf(path, 'hero\\.jpg');
    if (id) heroByClass.set(id, url);
  }
  for (const [path, url] of Object.entries(THUMB_GLOB)) {
    const id = classIdOf(path, 'thumbnail\\.jpg');
    if (id) thumbByClass.set(id, url);
  }
  for (const [path, json] of Object.entries(COLORS_GLOB)) {
    const id = classIdOf(path, 'colors\\.json');
    if (id) colorsByClass.set(id, json);
  }

  const out = new Map<string, ClassAssets>();
  for (const [id, hero] of heroByClass) {
    const thumbnail = thumbByClass.get(id);
    const colors = colorsByClass.get(id);
    if (!thumbnail || !colors) continue;
    out.set(id, { hero, thumbnail, colors });
  }
  return out;
}

const INDEX = buildIndex();

/**
 * Returns the bundled hero/thumbnail/colors triple for a class id, or null
 * when classId is null or unknown.
 */
export function getClassAssets(classId: string | null): ClassAssets | null {
  if (classId === null) return null;
  return INDEX.get(classId) ?? null;
}
