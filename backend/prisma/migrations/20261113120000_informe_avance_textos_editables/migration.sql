-- El investigador puede ajustar, en cada informe de avance, el objetivo específico, la meta, la actividad y el responsable que
-- aparecen en el cronograma del periodo. Nulo = lo de la formulación del proyecto.
ALTER TABLE "informe_avance_actividad" ADD COLUMN "objetivo_texto" TEXT;
ALTER TABLE "informe_avance_actividad" ADD COLUMN "meta_texto" TEXT;
ALTER TABLE "informe_avance_actividad" ADD COLUMN "actividad_texto" TEXT;
ALTER TABLE "informe_avance_actividad" ADD COLUMN "responsable_texto" TEXT;
