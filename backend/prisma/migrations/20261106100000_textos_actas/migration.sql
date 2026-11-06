-- Textos editables por el Administrador en cada acta: numerales 5 a 10 del acta de inicio y textos fijos del acta de cierre.
ALTER TABLE "acta_inicio" ADD COLUMN "textos" JSONB;
ALTER TABLE "acta_cierre" ADD COLUMN "textos" JSONB;
