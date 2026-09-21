import { z } from "zod";
import {
  getActiveProviderId,
  setActiveProviderId,
  getActiveOllamaModel,
  setActiveOllamaModel,
} from "@/lib/agent/providers/active-provider";
import { getProviderStatus } from "@/lib/agent/status";
import { checkOllamaStatus } from "@/lib/agent/providers/ollama-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateProviderSchema = z.object({
  provider: z.enum(["command-code", "ollama"]),
  model: z
    .string()
    .trim()
    .max(100)
    .regex(/^[a-zA-Z0-9_\-.:]+$/, "Invalid model identifier")
    .optional(),
});

export async function GET() {
  const activeProviderId = getActiveProviderId();
  const activeModel = activeProviderId === "ollama" ? getActiveOllamaModel() : undefined;
  const status = await getProviderStatus();

  return Response.json({
    activeProviderId,
    activeModel,
    status,
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateProviderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid provider selection", details: parsed.error.issues }, { status: 400 });
  }

  const { provider, model } = parsed.data;

  if (provider === "ollama") {
    // If a model was specified, check against discovered local models where possible
    const ollamaStatus = await checkOllamaStatus(model ? { model } : undefined);
    if (model && ollamaStatus.availableModels.length > 0) {
      const match = ollamaStatus.availableModels.find(
        (m) => m.toLowerCase() === model.toLowerCase() || m.startsWith(`${model}:`)
      );
      if (!match) {
        return Response.json(
          { error: `Model "${model}" is not installed locally in Ollama.` },
          { status: 400 }
        );
      }
      setActiveOllamaModel(match);
    } else if (model) {
      setActiveOllamaModel(model);
    }
    setActiveProviderId("ollama");
  } else {
    setActiveProviderId("command-code");
  }

  const updatedStatus = await getProviderStatus();

  return Response.json({
    ok: true,
    activeProviderId: getActiveProviderId(),
    activeModel: getActiveOllamaModel(),
    status: updatedStatus,
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
