import { prisma } from "@/lib/db";
import Image from "next/image";

export default async function Home() {

  const users = await prisma.user.findMany();

  return (
    <div> 
      {
        JSON.stringify(users)
      }
    </div>
  );
}
