import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

let prismaClient;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required before running database queries");
  }

  const adapter = new PrismaPg({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  return new PrismaClient({ adapter });
}

export function getPrisma() {
  prismaClient ??= createPrismaClient();
  return prismaClient;
}

export async function disconnectPrisma() {
  if (prismaClient) {
    await prismaClient.$disconnect();
  }
}

export const prisma = new Proxy(
  {},
  {
    get(_target, property) {
      return getPrisma()[property];
    },
  },
);
