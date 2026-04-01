import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

// Ensure a single PrismaClient instance during development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const generateId = (length: number = 12) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let id = '';
    for (let i = 0; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
};

export const auth = betterAuth({
    basePath: "/auth",
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    logger: {
        level: "debug",
    },
    advanced: {
        database: {
            generateId: "uuid"
        }
    },
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    return {
                        data: {
                            ...user,
                            publicId: generateId(12),
                        }
                    }
                }
            }
        }
    },
    emailAndPassword: {
        enabled: true,
    },
    user: {
        additionalFields: {
            publicId: {
                type: "string",
                required: false,
                input: false // We generate it via hooks, not from user input
            }
        }
    }
    // We will enable social providers later as needed
});
