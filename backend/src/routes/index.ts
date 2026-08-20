import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { proyectosRoutes } from "./proyectos.routes";
import { dashboardRoutes } from "./dashboard.routes";
import { convocatoriasRoutes } from "./convocatorias.routes";
import { catalogosRoutes } from "./catalogos.routes";
import { gruposRoutes } from "./grupos.routes";
import { usuariosRoutes } from "./usuarios.routes";
import { productosRoutes } from "./productos.routes";
import { tiposDocumentoRoutes } from "./tipos-documento.routes";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/proyectos", proyectosRoutes);
apiRoutes.use("/dashboard", dashboardRoutes);
apiRoutes.use("/convocatorias", convocatoriasRoutes);
apiRoutes.use("/catalogos", catalogosRoutes);
apiRoutes.use("/grupos-investigacion", gruposRoutes);
apiRoutes.use("/usuarios", usuariosRoutes);
apiRoutes.use("/productos", productosRoutes);
apiRoutes.use("/tipos-documento", tiposDocumentoRoutes);
