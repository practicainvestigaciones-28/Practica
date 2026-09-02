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
};
