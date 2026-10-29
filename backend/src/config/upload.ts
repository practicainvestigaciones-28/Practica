import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

// Carpeta física donde se guardan los archivos subidos. Vive fuera de src/
// para no interferir con la compilación de TypeScript. Se crea sola si no
// existe (por ejemplo, al clonar el proyecto en una máquina nueva).
export const CARPETA_UPLOADS = path.join(process.cwd(), "uploads", "proyectos");

if (!fs.existsSync(CARPETA_UPLOADS)) {
  fs.mkdirSync(CARPETA_UPLOADS, { recursive: true });
}

// Extensiones permitidas para documentos de proyecto (RQF37).
const EXTENSIONES_PERMITIDAS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"];
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CARPETA_UPLOADS),
  filename: (_req, file, cb) => {
    // Nombre único en disco para evitar colisiones; el nombre original del
    // usuario se conserva en `archivo` solo como referencia si se necesita,
    // pero lo que se guarda en BD es esta ruta relativa generada aquí.
    const sufijo = crypto.randomBytes(8).toString("hex");
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${sufijo}${extension}`);
  },
});

export const uploadDocumento = multer({
  storage,
  limits: { fileSize: TAMANO_MAXIMO_BYTES },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_PERMITIDAS.includes(extension)) {
      cb(new Error(`Extensión no permitida: ${extension}. Usa: ${EXTENSIONES_PERMITIDAS.join(", ")}`));
      return;
    }
    cb(null, true);
  },
});

// Fotos de perfil: solo imágenes, pequeñas.
export const CARPETA_FOTOS_PERFIL = path.join(process.cwd(), "uploads", "fotos-perfil");

if (!fs.existsSync(CARPETA_FOTOS_PERFIL)) {
  fs.mkdirSync(CARPETA_FOTOS_PERFIL, { recursive: true });
}

export const EXTENSIONES_FOTO_PERFIL = [".jpg", ".jpeg", ".png", ".webp"];
const TAMANO_MAXIMO_FOTO_BYTES = 2 * 1024 * 1024; // 2 MB

export const uploadFotoPerfil = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CARPETA_FOTOS_PERFIL),
    filename: (_req, file, cb) => {
      const sufijo = crypto.randomBytes(8).toString("hex");
      cb(null, `${Date.now()}-${sufijo}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: TAMANO_MAXIMO_FOTO_BYTES },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_FOTO_PERFIL.includes(extension) || !file.mimetype.startsWith("image/")) {
      cb(new Error(`La foto debe ser una imagen ${EXTENSIONES_FOTO_PERFIL.join(", ")} de hasta 2 MB.`));
      return;
    }
    cb(null, true);
  },
});
