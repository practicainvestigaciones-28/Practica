-- El Administrador puede ajustar a mano la apertura y el límite de cada periodo de informe.
ALTER TABLE "periodo_informe" ADD COLUMN "fechas_ajustadas" BOOLEAN NOT NULL DEFAULT false;
