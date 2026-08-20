import type { UsuarioAutenticado } from "./auth";

declare global {
  namespace Express {
    interface Request {
      /** Se asigna en el middleware `autenticar` a partir del JWT */
      usuario?: UsuarioAutenticado;
    }
  }
}

export {};
