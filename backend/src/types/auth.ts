/** Payload que se firma dentro del JWT y que viaja en req.usuario */
export interface UsuarioAutenticado {
  id_usuario: number;
  correo: string;
  roles: string[];
  /** RQF04 - fila en sesiones_usuario que respalda este token (ver auth.middleware.ts) */
  id_sesion: number;
}
