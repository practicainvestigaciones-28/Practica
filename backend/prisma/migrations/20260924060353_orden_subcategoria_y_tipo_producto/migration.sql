-- AlterTable
ALTER TABLE "subcategoria_producto" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tipo_producto" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;

-- Backfill: como estas filas ya existían sin orden explícito, se les asigna
-- una secuencia estable a partir de su orden de creación (id ascendente),
-- agrupadas dentro de su padre, para que no queden todas en 0 (que se
-- comportaría igual de "desordenado" que no tener la columna).
WITH ordenados AS (
  SELECT "id_subcategoria",
         ROW_NUMBER() OVER (PARTITION BY "id_categoria" ORDER BY "id_subcategoria") - 1 AS rn
  FROM "subcategoria_producto"
)
UPDATE "subcategoria_producto" sp
SET "orden" = ordenados.rn
FROM ordenados
WHERE sp."id_subcategoria" = ordenados."id_subcategoria";

WITH ordenados AS (
  SELECT "id_tipo_producto",
         ROW_NUMBER() OVER (PARTITION BY "id_subcategoria" ORDER BY "id_tipo_producto") - 1 AS rn
  FROM "tipo_producto"
)
UPDATE "tipo_producto" tp
SET "orden" = ordenados.rn
FROM ordenados
WHERE tp."id_tipo_producto" = ordenados."id_tipo_producto";
