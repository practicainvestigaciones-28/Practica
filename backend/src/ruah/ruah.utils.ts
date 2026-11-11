/** Funciones puras de la sincronización con Ruah (comparar nombres de catálogo, armar nombres propios, etc.). */

/**
 * Clave para comparar un nombre de Ruah con uno de nuestro catálogo: sin tildes, mayúsculas, puntuación ni prefijos que
 * cada sistema escribe distinto ("Licenciatura en" ↔ "Lic.", "Departamento de", "Facultad de").
 */
export function claveNombre(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\blicenciatura en\b/g, "lic")
    .replace(/^(departamento de|departamento|facultad de|facultad|faculta)\b/, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PALABRAS_MENORES = new Set(["de", "del", "la", "las", "el", "los", "en", "y", "e", "para", "a"]);

/** "ADRIANA DEL PILAR" → "Adriana del Pilar" (nombres y programas vienen de Ruah en mayúsculas). */
export function nombrePropio(texto: string | null | undefined): string {
  return (texto ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && PALABRAS_MENORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/** Especializaciones, maestrías, doctorados y coterminalidades son posgrado; lo demás, pregrado. */
export function tipoProgramaPorNombre(nombre: string): "pregrado" | "posgrado" {
  return /^\s*(especializaci|maestr|doctorad|coterminalidad)/i.test(nombre.normalize("NFD").replace(/[̀-ͯ]/g, "")) ? "posgrado" : "pregrado";
}

export function esDepartamento(nombre: string): boolean {
  return /^\s*departamento\b/i.test(nombre);
}

export function soloDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}

export function unirNombre(...partes: (string | null | undefined)[]): string {
  return nombrePropio(partes.map((p) => (p ?? "").trim()).filter(Boolean).join(" "));
}
