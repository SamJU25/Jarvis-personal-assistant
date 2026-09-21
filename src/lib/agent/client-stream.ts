import { agentApiFrameSchema, type AgentApiFrame } from "@/lib/contracts/agent-api";

export async function* readAgentFrames(stream: ReadableStream<Uint8Array>): AsyncGenerator<AgentApiFrame> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) yield parseFrame(line);
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield parseFrame(buffer);
  } finally { reader.releaseLock(); }
}

function parseFrame(line: string): AgentApiFrame {
  try { return agentApiFrameSchema.parse(JSON.parse(line)); }
  catch { throw new Error("The agent stream was invalid."); }
}
