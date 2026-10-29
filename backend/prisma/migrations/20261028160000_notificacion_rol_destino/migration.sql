-- Rol con el que el usuario debe estar actuando para ver la notificación (null = cualquier rol).
ALTER TABLE "notificaciones" ADD COLUMN "rol_destino" TEXT;
