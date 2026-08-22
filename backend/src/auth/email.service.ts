/**
 * Servicio de correo para RQF03 ("enviar enlace o código de recuperación").
 *
 * De momento no hay proveedor de correo configurado en el proyecto (no hay
 * SMTP/SES/Resend en package.json), así que esta función solo registra el
 * enlace en consola para poder probar el flujo end-to-end.
 *
 * Para conectar un proveedor real más adelante, esta es la ÚNICA función que
 * hay que reemplazar — el resto del flujo de recuperación no cambia:
 *
 *   npm install nodemailer
 *   import nodemailer from "nodemailer";
 *   const transporter = nodemailer.createTransport({ ... });
 *   await transporter.sendMail({ to: correo, subject: "...", html: `<a href="${enlace}">...</a>` });
 */
export async function enviarCorreoRecuperacion(correo: string, enlace: string): Promise<void> {
  console.log("──────────────────────────────────────────────");
  console.log(`[email:recuperacion] Para: ${correo}`);
  console.log(`[email:recuperacion] Enlace: ${enlace}`);
  console.log("──────────────────────────────────────────────");
}
