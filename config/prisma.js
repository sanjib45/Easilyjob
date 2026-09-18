import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

if (!process.env.DATABASE_URL?.startsWith("mongodb")) {
  throw new Error("DATABASE_URL must be a MongoDB connection string.");
}

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
