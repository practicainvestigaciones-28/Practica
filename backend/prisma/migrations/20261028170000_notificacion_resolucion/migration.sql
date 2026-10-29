-- Limpieza de notificaciones: a qué proyecto se refieren, si su acción ya se hizo y cuándo se leyeron.
ALTER TABLE "notificaciones"
ADD COLUMN "id_proyecto" INTEGER,
ADD COLUMN "resuelta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fecha_leida" TIMESTAMP(3);
