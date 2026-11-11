-- Proyectos anteriores al sistema (ya terminados) y la convocatoria histórica en la que se cargan.
ALTER TABLE "convocatoria" ADD COLUMN "es_historica" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "proyectos" ADD COLUMN "es_historico" BOOLEAN NOT NULL DEFAULT false;
