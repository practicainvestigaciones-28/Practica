-- Se elimina la columna "comprobante_pago": el Administrador ya no tendrá un
-- comprobante de pago real para cargar. El pago ahora queda marcado como
-- "pagado" al enviar el correo de agradecimiento (ver enviarAgradecimientoPago
-- en pagos.service.ts), no al subir un comprobante.
ALTER TABLE "pago_par" DROP COLUMN "comprobante_pago";
