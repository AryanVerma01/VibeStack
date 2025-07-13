import { inngest } from "./client";
import { createAgent, gemini } from "@inngest/agent-kit";
import { Sandbox } from "e2b"
import { any } from "zod";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },

  async ({ event, step }) => {

    // Create Sandbox
    const sandboxid = await step.run('start Sandbox',async()=>{
      const sandbox = await Sandbox.create("vibe-stack-test2");
      return sandbox.sandboxId;
    })

    const codegenerator = createAgent({
      name: "Code writer",
      system: "You are a nextjs developer. Create component using tailwindcss and reactjs",
      model: gemini({
        model: "gemini-2.0-flash",
        apiKey: process.env.GEMINI_API_KEY,
      }),
    });
    
    const { output } = await codegenerator.run(
      `Component : ${event.data.value}`       // tRPC send value to ingest func 
    )
    
    // get created sandbox URL
    const sandboxurl = await step.run('get-sandbox-url', async()=>{
      const sandbox = await Sandbox.connect(sandboxid);      // you can also create getsandbox() function reusable 
      const host =  sandbox.getHost(3000);
      return `httpw://${host}`;
    })
    
    return { output, sandboxurl };
  }


);

