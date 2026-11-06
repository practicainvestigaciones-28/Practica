import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { apiRoutes } from "./routes";
import { manejadorErrores } from "./middlewares/error.middleware";
import { inicializarSocket } from "./ws/socket";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "API del Sistema de Gestión de Proyectos",
  });
});

app.use("/api", apiRoutes);

// Manejador de errores centralizado (siempre al final, después de las rutas)
app.use(manejadorErrores);

const server = http.createServer(app);
inicializarSocket(server);

server.listen(env.PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${env.PORT}`);
});