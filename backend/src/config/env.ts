import "dotenv/config";

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa tu archivo .env`);
  }
  return valor;
}

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: requerida("DATABASE_URL"),
  JWT_SECRET: requerida("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  // RQF03: minutos de validez del token de recuperación y URL base del
  // frontend donde vive la pantalla "restablecer contraseña".
  RESET_TOKEN_EXPIRES_MIN: Number(process.env.RESET_TOKEN_EXPIRES_MIN) || 60,
  FRONTEND_RESET_URL:
    process.env.FRONTEND_RESET_URL || "http://localhost:5173/restablecer-contrasena",
  // RQF04: minutos de inactividad tras los cuales se cierra la sesión
  // automáticamente (independiente de JWT_EXPIRES_IN, que es el tope
  // máximo absoluto del token). Ver middlewares/auth.middleware.ts.
  INACTIVIDAD_TIMEOUT_MIN: Number(process.env.INACTIVIDAD_TIMEOUT_MIN) || 10,
  // Envío de correo (bienvenida con contraseña temporal, recuperación...).
  // Si SMTP_HOST no está configurado, email.service.ts no manda nada real:
  // solo deja el contenido en consola (igual que antes de tener SMTP).
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || "",
  // URL del login, para el enlace del correo de bienvenida.
  FRONTEND_LOGIN_URL: process.env.FRONTEND_LOGIN_URL || "http://localhost:5173/",
  // Acta de inicio: página del frontend que registra la firma al abrir el
  // enlace personal del correo (se le agrega /<token>) y días de vigencia del enlace.
  FRONTEND_FIRMA_ACTA_URL: process.env.FRONTEND_FIRMA_ACTA_URL || "http://localhost:5173/firmar-acta",
  ACTA_FIRMA_VIGENCIA_DIAS: Number(process.env.ACTA_FIRMA_VIGENCIA_DIAS) || 7,
  // El Vicerrector solo firma: no tiene cuenta ni rol en el sistema. Su nombre y correo
  // (donde recibe su enlace de firma) salen de aquí y se pueden ajustar al generar cada acta.
  VICERRECTOR_NOMBRE: process.env.VICERRECTOR_NOMBRE || "Vicerrector de Investigación y Extensión",
  VICERRECTOR_CORREO: process.env.VICERRECTOR_CORREO || "",
  // SOLO PARA PRUEBAS: mientras el correo no esté configurado, un investigador del acta puede firmar por
  // todos los investigadores y el Administrador firma como Vicerrector. En producción debe ser false.
  ACTA_FIRMAS_MODO_PRUEBA: process.env.ACTA_FIRMAS_MODO_PRUEBA === "true",
};
