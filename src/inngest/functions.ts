import { inngest } from "./client";
import { createAgent, createNetwork, gemini, TextMessage , type Tool } from "@inngest/agent-kit";
import { Sandbox } from "e2b";
import z from "zod";
import { createTool } from "@inngest/agent-kit";
import { PROMPT } from "@/prompt";
import { openai } from "@inngest/agent-kit";
import { prisma } from "@/lib/db";
import { ps } from "zod/v4/locales";

interface AgentState{
  summary: string,
  files: { [path:string]: string };
}

export const codeAgent = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },

  async ({ event, step }) => {
    // Create Sandbox
    const sandboxId = await step.run("start Sandbox", async () => {
      const sandbox = await Sandbox.create("vibe-stack-test2");
      return sandbox.sandboxId;
    });

    const codegenerator = createAgent<AgentState>({
      model: openai({
        model:'gpt-4o' , 
        apiKey: process.env.OPENAI_API_KEY,
        defaultParameters:{
          temperature: 0.1
        }
      }),
      name: "Code writer",
      system:PROMPT,      
      tools: [
        createTool({
          name: "terminal",
          description: "use terminal to run command",
          parameters: z.object({
            command: z.string(),
          }) as any,
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: "" };
              try {
                // Use sandboxId from outer scope
                const sandbox = await Sandbox.connect(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  },
                });
                return result;
              } catch (e) {
                console.error(
                  `Command failed:${e} \n Stdout:${buffers.stdout} \n Stderror:${buffers.stderr}`
                );
                return `Command failed:${e} \n Stdout:${buffers.stdout} \n Stderror:${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name: "createOrUpdatefiles",
          description: "Create or Update files in sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              })
            ),
          }) as any,
          handler: async ({files} , {step ,network}:Tool.Options<AgentState>) => {
          
            const newfiles = await step?.run(
              "createOrUpdateFiles",
              async () => {
                try {
                  const sandbox = await Sandbox.connect(sandboxId);
                  const updatedfiles = network.state.data.files || {}; // gets all the files created by the agent

                  for (const file of files) {
                    await sandbox.files.write(file.path, file.content);
                    updatedfiles[file.path] = file.content;
                  }
                  return updatedfiles;
                } catch (e) {
                  return "Error" + e;
                }
              });

            if(typeof newfiles === 'object'){
              network.state.data.files = newfiles
            }
          },
        }),
        // These tools are for AI model to read files from sandbox and get context 
        createTool({
          name:'readFiles',
          description:"read files from the sandbox",
          parameters: z.object({
            files:z.array(z.string()),  
          }) as any ,
          handler: async ({files},{step}) => {
            return await step?.run('readfile',async ()=>{
              try{
                const sandbox = await Sandbox.connect(sandboxId);
                const contents = [];

                for (const file of files){
                  const content = await sandbox.files.read(file);
                  contents.push({path: file},content)
                }
                return JSON.stringify(contents)
              }
              catch(e){
                return 'Error' + e ;
              }
            })
          }
        })
      ],
      lifecycle:{
        onResponse: async({result,network})=>{
            const lastAssistanceMsgIndex = result.output.findLastIndex(
              (message) => message.role === 'assistant'
            ) 

            // it check if <task_summary> is present in last response of AI then task is done and should be terminated
            const message = result.output[lastAssistanceMsgIndex] as | TextMessage | undefined ;

            const msg = message?.content
              ? typeof message.content === 'string'
              ? message.content 
              : message.content.map((c) => c.text).join("")
              : undefined ;

            if(msg && network){
              if(msg.includes("<text_summary>)")){
                  network.state.data.summary = msg;           // network.state.data.summary is a state variable
              }
            }
            return result;
        }
      }
    });

    // Limits the Agent to run unnecessarily
    const network = createNetwork<AgentState>({
      name:'coding-agent-network',
      agents:[codegenerator],
      maxIter: 15,
      router: async({network}) =>{
        const summary = network.state.data.summary; 

        if(summary){
          return
        }

        return codegenerator

      }             
    })

    const result = await network.run(event.data.value);

    // get created sandbox URL
    const sandboxurl = await step.run("get-sandbox-url", async () => {
      const sandbox = await Sandbox.connect(sandboxId); // you can also create getsandbox() function reusable
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run('save-result', async()=>{

      if(!network.state.data.summary) return

      return await prisma.message.create({
        data:{
          content: network.state.data.summary,
          role: 'ASSISTANT',
          type: 'RESULT',
          fragment:{
            create:{
              sandUrl: sandboxurl,
              title: 'Fragment',
              files: network.state.data.files
            }
          }
        }
      }) 
    })

    return { 
      url : sandboxurl , 
      title: 'Fragment',
      files : network.state.data.files ,
      summary:  network.state.data.summary,
     };
  }
);
