-- Cuándo se le envió a la cuenta el correo de bienvenida de la sincronización con Ruah (nulo = pendiente).
ALTER TABLE "usuarios" ADD COLUMN "bienvenida_enviada_en" TIMESTAMP(3);
