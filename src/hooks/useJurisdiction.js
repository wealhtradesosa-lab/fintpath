import { useMemo } from 'react';
import { getRegPack } from '../lib/jurisdictions/index.js';

/**
 * Hook que retorna el RegPack activo según la jurisdicción del usuario.
 * 
 * @param {object} user - Objeto del usuario cargado desde Supabase (user_data)
 * @returns {{ jurisdiction: string, regPack: RegPack }}
 * 
 * Uso:
 *   const { regPack, jurisdiction } = useJurisdiction(user)
 *   regPack.formatCurrency(1000000)
 *   regPack.calculateIncomeTax(50000000)
 */
export function useJurisdiction(user) {
  const jurisdiction = user?.jurisdiction ?? 'CO';

  const regPack = useMemo(() => {
    return getRegPack(jurisdiction);
  }, [jurisdiction]);

  return { jurisdiction, regPack };
}
