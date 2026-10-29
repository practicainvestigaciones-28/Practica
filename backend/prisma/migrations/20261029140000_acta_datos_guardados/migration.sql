-- Numerales 1 a 3 del acta de inicio ya guardados (bloqueados hasta reabrir el acta).
ALTER TABLE "acta_inicio" ADD COLUMN "datos_guardados" BOOLEAN NOT NULL DEFAULT false;
