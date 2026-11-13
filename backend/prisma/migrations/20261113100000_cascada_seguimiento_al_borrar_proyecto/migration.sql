-- Borrar un proyecto que ya llegó al informe final fallaba por llaves foráneas sin cascada: los cumplimientos de objetivos, las
-- actividades de los informes de avance, los resultados de productos y el acta de cierre ahora se borran junto con lo que referencian.
ALTER TABLE "cumplimiento_objetivo" DROP CONSTRAINT "cumplimiento_objetivo_id_objetivo_fkey";
ALTER TABLE "cumplimiento_objetivo" ADD CONSTRAINT "cumplimiento_objetivo_id_objetivo_fkey" FOREIGN KEY ("id_objetivo") REFERENCES "objetivos"("id_objetivo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "informe_avance_actividad" DROP CONSTRAINT "informe_avance_actividad_id_actividad_fkey";
ALTER TABLE "informe_avance_actividad" ADD CONSTRAINT "informe_avance_actividad_id_actividad_fkey" FOREIGN KEY ("id_actividad") REFERENCES "cronograma_actividad"("id_actividad") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resultado_producto" DROP CONSTRAINT "resultado_producto_id_proyecto_producto_fkey";
ALTER TABLE "resultado_producto" ADD CONSTRAINT "resultado_producto_id_proyecto_producto_fkey" FOREIGN KEY ("id_proyecto_producto") REFERENCES "proyecto_producto"("id_proyecto_producto") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acta_cierre" DROP CONSTRAINT "acta_cierre_id_informe_final_fkey";
ALTER TABLE "acta_cierre" ADD CONSTRAINT "acta_cierre_id_informe_final_fkey" FOREIGN KEY ("id_informe_final") REFERENCES "informe_final"("id_informe_final") ON DELETE CASCADE ON UPDATE CASCADE;
