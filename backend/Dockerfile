# Imagen del backend (Node + Express + Prisma).
# Se conserva el CLI de Prisma dentro de la imagen para poder correr las migraciones
# (`docker compose exec backend npx prisma migrate deploy`) y el seed.
FROM node:24-bookworm-slim

# Prisma necesita OpenSSL; ca-certificates para conexiones TLS salientes (SMTP, Ruah).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# prisma.config.ts exige DATABASE_URL aunque `generate` no se conecte: se le da un valor de relleno.
RUN DATABASE_URL="postgresql://relleno:relleno@localhost:5432/relleno" npx prisma generate \
 && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Carpeta de archivos subidos (se monta como volumen en docker-compose).
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

CMD ["node", "dist/app.js"]
