import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";

// Mismo patrón que prisma/seed.ts: Prisma 7 requiere un driver adapter
// explícito para Postgres (ya no basta con DATABASE_URL en el datasource).
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
