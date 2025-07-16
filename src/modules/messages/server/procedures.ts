import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/db";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";
import { symlinkSync } from "fs";
import z from "zod";

export const messageRouter = createTRPCRouter({
    findMany: baseProcedure
    .query(async () => {
        const messages = prisma.message.findMany({
            orderBy:{
                updatedAt:"desc"
            },
            include:{
                fragment: true
            }                   // it displays AI result associated with message 
        })

        return messages;
    }),

    create: baseProcedure
    .input(
        z.object({
            value:z.string()
        })
    )
    .mutation(async ({input}) =>{
        await prisma.message.create({
            data:{
                content:input.value,
                role: 'USER',
                type: 'RESULT' 
            }
        })

        await inngest.send({
            name:'code-agent/run',
            data:{
                value : input.value
            }
        })        
    })
})

export type AppRouter = typeof appRouter