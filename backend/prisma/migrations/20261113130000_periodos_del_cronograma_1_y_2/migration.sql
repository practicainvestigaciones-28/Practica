-- Los periodos del cronograma de la formulación son dos por año: el Periodo 1 va del mes 1 al 6 y el Periodo 2 del mes 7 al 12, y así
-- año tras año. Solo en Seguimiento se numeran 1, 2, 3, 4... (según la duración del proyecto). El catálogo queda con esos dos nombres.
UPDATE "periodo" SET "nombre" = 'Periodo 1' WHERE "id_periodo" = (SELECT "id_periodo" FROM "periodo" ORDER BY "orden", "id_periodo" LIMIT 1);
UPDATE "periodo" SET "nombre" = 'Periodo 2' WHERE "id_periodo" = (SELECT "id_periodo" FROM "periodo" ORDER BY "orden", "id_periodo" LIMIT 1 OFFSET 1);
