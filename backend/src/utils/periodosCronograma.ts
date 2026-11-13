interface MesCronograma {
  año: number;
  id_periodo: number;
}

/**
 * El cronograma de la formulación viene por bloques (año + periodo): el primer bloque es el periodo 1 del seguimiento, el
 * segundo el periodo 2, y así. Devuelve, para cada actividad, los periodos del seguimiento en que está programada.
 */
export function periodosDeActividades(actividades: { periodos: MesCronograma[] }[]): number[][] {
  const clave = (m: MesCronograma) => m.año * 1000 + m.id_periodo;
  const bloques = [...new Set(actividades.flatMap((a) => a.periodos.map(clave)))].sort((x, y) => x - y);
  return actividades.map((a) => [...new Set(a.periodos.map((m) => bloques.indexOf(clave(m)) + 1))].sort((x, y) => x - y));
}
