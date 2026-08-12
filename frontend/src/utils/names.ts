const ADJECTIVES = ['Swift', 'Calm', 'Bright', 'Bold', 'Keen', 'Wise', 'Noble', 'Eager', 'Brave', 'Quick', 'Gentle', 'Vivid'];
const ANIMALS = ['Fox', 'Owl', 'Bear', 'Hawk', 'Wolf', 'Lynx', 'Deer', 'Falcon', 'Otter', 'Raven', 'Moose', 'Heron'];

let cachedName: string | null = null;

function randomInt(max: number): number {
  // Prefer the cryptographic RNG when available (more entropy than Math.random).
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function getFriendlyName(): string {
  if (!cachedName) {
    const adj = ADJECTIVES[randomInt(ADJECTIVES.length)];
    const animal = ANIMALS[randomInt(ANIMALS.length)];
    // A short numeric suffix further reduces the chance two peers (e.g. two
    // windows opened on the same machine) draw the same name.
    const suffix = randomInt(100);
    cachedName = `${adj}${animal}${suffix}`;
  }
  return cachedName;
}
