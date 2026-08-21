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

// Extensiones permitidas para documentos de proyecto (RQF37). Ajusta esta
// lista si tu universidad exige otros formatos (por ejemplo .odt).
const EXTENSIONES_PERMITIDAS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"];
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB

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
