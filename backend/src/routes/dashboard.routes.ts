import { Router } from "express";
import { estadisticas } from "../controllers/dashboard.controller";
import { autenticar } from "../middlewares/auth.middleware";

export const dashboardRoutes = Router();

dashboardRoutes.use(autenticar);
dashboardRoutes.get("/estadisticas", estadisticas);
