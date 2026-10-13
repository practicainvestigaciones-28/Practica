import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      include: [
        "src/utils/permisosProyecto.ts",
        "src/proyectos/proyectos.service.ts",
        "src/participantes/participantes.service.ts",
        "src/productos/productos.service.ts",
      ],
    },
  },
});
