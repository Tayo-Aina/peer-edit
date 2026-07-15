const ADJECTIVES = ['Swift', 'Calm', 'Bright', 'Bold', 'Keen', 'Wise', 'Noble', 'Eager'];
const ANIMALS = ['Fox', 'Owl', 'Bear', 'Hawk', 'Wolf', 'Lynx', 'Deer', 'Falcon'];

let cachedName: string | null = null;

export function getFriendlyName(): string {
  if (!cachedName) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    cachedName = `${adj}${animal}`;
  }
  return cachedName;
}
