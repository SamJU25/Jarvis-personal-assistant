export const debugSample = {
  kind: "sample" as const,
  request: "Prepare me for my next meeting",
  provider: "Not configured",
  model: "Not selected",
  skill: "Meeting preparation preview",
  toolCalls: ["Sample calendar lookup", "Sample correspondence review"],
  toolInputs: { range: "next 24 hours" },
  toolOutputs: { records: 0, note: "No real tools were called" },
  events: ["sample_started", "sample_presented"],
  timings: { total: "Not measured" },
  structuredResponse: { state: "sample" },
  validationErrors: [],
};
