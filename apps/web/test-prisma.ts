import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Attempting direct Prisma user creation...");
        const result = await prisma.user.create({
            data: {
                id: crypto.randomUUID(),
                email: 'direct.prisma@example.com',
                name: 'Direct Prisma',
                emailVerified: false,
                image: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                publicId: 't3stP1blicID1',
                // other required fields?
            }
        });
        console.log("Success:", result);
    } catch (error: any) {
        console.error("Prisma Error Details:");
        console.dir(error, { depth: null });
        if (error.code) console.error("Prisma Code:", error.code);
        if (error.meta) console.error("Prisma Meta:", error.meta);
        if (error.message) console.error(error.message);
    }
}

main();
