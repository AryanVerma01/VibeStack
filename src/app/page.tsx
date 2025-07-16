"use client"

import { useTRPC } from "@/trpc/client"
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Home() {
  const trpc = useTRPC();
  const {data:messages} = useQuery(trpc.messages.findMany.queryOptions());
  const createMessage = useMutation(trpc.messages.create.mutationOptions({}))
  const [text,setText] = useState("");


  return <>
    <div>
      <Input type="text" placeholder="enter text to summarize" onChange={(e)=>{setText(e.target.value)}}></Input>
      <Button onClick={()=> createMessage.mutate({value:text})}>
        Invoke Backgorund request
      </Button>
      <div>
        {JSON.stringify(messages)}
      </div>
    </div>
  </>
}
