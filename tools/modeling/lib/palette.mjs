import * as THREE from 'three';

// Shared low-poly palette. Every avatar uses these material names so the look stays
// consistent in the game and in the viewer. Colors follow real suits: white soft goods,
// navy life-support backpack (xEMU), grey glove tips (AxEMU), gold visor (Apollo/EMU).
const BASE = {
  Suit: { color: '#E2DED6', roughness: 0.85 },
  SuitGrey: { color: '#B9BCC2', roughness: 0.7 },
  Helmet: { color: '#F4F4F1', roughness: 0.35 },
  Visor: { color: '#1B2433', roughness: 0.12, metalness: 0.6 },
  VisorGold: { color: '#D4A72C', roughness: 0.2, metalness: 1.0 },
  Pack: { color: '#2A3550', roughness: 0.6 },
  Metal: { color: '#9EA4AD', roughness: 0.35, metalness: 0.85 },
  Glove: { color: '#E6E3DC', roughness: 0.8 },
  GloveTip: { color: '#5E6168', roughness: 0.6 },
  Boot: { color: '#D9D6CF', roughness: 0.8 },
  Sole: { color: '#3A3D44', roughness: 0.9 },
  Strap: { color: '#4A4F59', roughness: 0.8 },
  Bag: { color: '#CDBF9E', roughness: 0.9 },
  Lamp: { color: '#FFF6DD', emissive: '#FFF6DD', emissiveIntensity: 2.5, roughness: 0.3 },
  LedGreen: { color: '#38E07B', emissive: '#38E07B', emissiveIntensity: 2.0, roughness: 0.3 },
  LedRed: { color: '#FF3B30', emissive: '#FF3B30', emissiveIntensity: 2.0, roughness: 0.3 },
  LedAmber: { color: '#FFB020', emissive: '#FFB020', emissiveIntensity: 2.0, roughness: 0.3 },
  Display: { color: '#0F2236', emissive: '#123C5A', emissiveIntensity: 0.6, roughness: 0.8 }, // a lit, matte dark screen
  // Characters without a pressure suit (astronaut: false in characters/<id>.mjs).
  Skin: { color: '#E9B794', roughness: 0.75 },
  Hair: { color: '#A9A7AE', roughness: 0.9 },
  Lens: { color: '#A8CFE8', roughness: 0.15, metalness: 0.2 },
  Lips: { color: '#C2686E', roughness: 0.6 },
  Wood: { color: '#D9A55B', roughness: 0.7 },
  // Rocket parts materials (references/parts/parts.md §3).
  Hull: { color: '#E9E9E4', roughness: 0.6 },
  HullBlack: { color: '#1E2024', roughness: 0.55 },
  Foam: { color: '#C8742F', roughness: 0.95 },
  Steel: { color: '#B9BEC4', metalness: 0.9, roughness: 0.3 },
  Aluminum: { color: '#C4C8CC', metalness: 0.8, roughness: 0.45 },
  Titanium: { color: '#8F9196', metalness: 0.85, roughness: 0.4 },
  Copper: { color: '#A8683A', metalness: 0.9, roughness: 0.35 },
  NozzleDark: { color: '#3A3633', metalness: 0.6, roughness: 0.6 },
  FoilGold: { color: '#D4A72C', metalness: 1.0, roughness: 0.3 },
  FoilSilver: { color: '#C9CDD1', metalness: 1.0, roughness: 0.3 },
};

// Celestial-body surface classes (tools/modeling/bodies/). The colors are stylized
// (game-balance); which class each face gets comes from real data (see each body file).
const BODY = {
  OceanDeep: { color: '#1B4E8F', roughness: 0.5 },
  OceanShelf: { color: '#2F86C0', roughness: 0.5 },
  SeaIce: { color: '#A9C6DA', roughness: 0.6 },
  Ice: { color: '#F2F5F7', roughness: 0.55 },
  Jungle: { color: '#1E5631', roughness: 0.95 },
  Forest: { color: '#336B3E', roughness: 0.95 },
  Savanna: { color: '#9A9A3F', roughness: 0.95 },
  Grass: { color: '#8BA654', roughness: 0.95 },
  Crop: { color: '#B3AE5B', roughness: 0.95 },
  Shrub: { color: '#B89D6A', roughness: 0.95 },
  Desert: { color: '#DDBF86', roughness: 0.95 },
};

function makeMaterial(name, def) {
  const material = new THREE.MeshStandardMaterial({
    name,
    color: new THREE.Color(def.color),
    roughness: def.roughness ?? 0.8,
    metalness: def.metalness ?? 0.0,
  });
  if (def.emissive) {
    material.emissive = new THREE.Color(def.emissive);
    material.emissiveIntensity = def.emissiveIntensity ?? 1.0;
  }
  return material;
}

/**
 * Builds the material set for one avatar.
 * `Accent` and `Screen` take the character's identity color.
 */
export function createPalette(accentHex) {
  const materials = {};
  for (const [name, def] of Object.entries(BASE)) materials[name] = makeMaterial(name, def);
  materials.Accent = makeMaterial('Accent', { color: accentHex, roughness: 0.6 });
  materials.Screen = makeMaterial('Screen', {
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 2.0,
    roughness: 0.3,
  });
  return materials;
}

/** Builds the shared material set for rocket parts and cabin/stage equipment. */
export function createPartsPalette() {
  const materials = {};
  for (const [name, def] of Object.entries(BASE)) materials[name] = makeMaterial(name, def);
  return materials;
}

/** Material names allowed on celestial bodies (used by the validator). */
export const BODY_MATERIALS = Object.keys(BODY);

/** Builds the material set for planets and moons. */
export function createBodyPalette() {
  const materials = {};
  for (const [name, def] of Object.entries(BODY)) materials[name] = makeMaterial(name, def);
  return materials;
}
