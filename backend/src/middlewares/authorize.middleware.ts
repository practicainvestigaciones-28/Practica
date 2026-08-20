import type { NextFunction, Request, Response } from "express";

/**
 * Middleware de autorización por roles (RBAC).
 * Debe usarse SIEMPRE después de `autenticar`, porque depende de req.usuario.roles.
 *
 * Uso:
 *   router.post("/", autenticar, autorizar("Administrador"), crearConvocatoria)
 */
export function autorizar(...rolesPermitidos: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rolesUsuario = req.usuario?.roles ?? [];

    const tieneAcceso = rolesUsuario.some((rol) => rolesPermitidos.includes(rol));

    if (!tieneAcceso) {
      res.status(403).json({
        error: "Acceso denegado",
        mensaje: `Esta acción requiere uno de los siguientes roles: ${rolesPermitidos.join(", ")}`,
      });
      return;
    }

    next();
  };
}
