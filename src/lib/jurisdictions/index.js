import { CO } from './CO.js';
import { US } from './US.js';

const PACKS = { CO, US };

/**
 * Retorna el RegPack para una jurisdicción dada.
 * Si no existe, retorna CO como fallback seguro.
 */
export function getRegPack(code = 'CO') {
  return PACKS[code] ?? PACKS['CO'];
}

export { CO, US };
