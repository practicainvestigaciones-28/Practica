// Una pantalla con datos sin guardar (p. ej. el registro de un proyecto) puede pedir que, antes de irse a otra
// parte desde el menú lateral o la barra superior, se le pregunte primero. La app usa <BrowserRouter>, que no
// tiene un bloqueo de navegación incorporado, así que el menú y la barra consultan esta guardia antes de navegar.

/**
 * Recibe la acción de salida (navegar, abrir una notificación, cerrar sesión). Devuelve true si se encargó de
 * ella: mostró su advertencia y la ejecutará solo si el usuario confirma. False = no hay nada que proteger.
 */
type Guardia = (continuar: () => void) => boolean

let guardiaActual: Guardia | null = null

/** La pantalla registra su guardia al montarse; la función devuelta la quita al desmontarse. */
export function registrarGuardiaNavegacion(guardia: Guardia): () => void {
  guardiaActual = guardia
  return () => {
    if (guardiaActual === guardia) guardiaActual = null
  }
}

/** Ejecuta la salida ya mismo, o deja que la pantalla actual pregunte primero si tiene datos sin guardar. */
export function salirProtegido(continuar: () => void): void {
  if (!guardiaActual || !guardiaActual(continuar)) continuar()
}
