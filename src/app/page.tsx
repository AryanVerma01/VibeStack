"use client"

import { useTRPC } from "@/trpc/client"
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Home() {
  const trpc = useTRPC();
  const invoke = useMutation(trpc.invoke.mutationOptions({}))
  const [text,setText] = useState("");


  return <>
    <div>
      <Input type="text" placeholder="enter text to summarize" onChange={(e)=>{setText(e.target.value)}}></Input>
      <Button onClick={()=> invoke.mutate({value:text})}>
        Invoke Backgorund request
      </Button>
    </div>
  </>
}
