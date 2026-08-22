import { Router } from "express";
import { estadisticas } from "../dashboard/dashboard.controller";
import { autenticar } from "../middlewares/auth.middleware";

export const dashboardRoutes = Router();

dashboardRoutes.use(autenticar);
dashboardRoutes.get("/estadisticas", estadisticas);
