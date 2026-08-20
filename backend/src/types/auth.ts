/** Payload que se firma dentro del JWT y que viaja en req.usuario */
export interface UsuarioAutenticado {
  id_usuario: number;
  correo: string;
  roles: string[];
}
