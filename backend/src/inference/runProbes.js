import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

/* -----------------------------
   1. Initialize Groq Client
   (OpenAI-compatible SDK)
------------------------------ */
const ai = new OpenAI({
  apiKey: process.env.XAI_API_KEY, 
  baseURL: "https://api.groq.com/openai/v1", // Groq endpoint
});

/* -----------------------------
   2. Load Probe Set
------------------------------ */
const probesPath = path.join(
  process.cwd(),
  "../data/probes/probes_v1.json"
);

const probeset = JSON.parse(
  fs.readFileSync(probesPath, "utf-8")
);

/* -----------------------------
   3. Locked Inference Config
------------------------------ */
const INFERENCE_CONFIG = {
  temperature: 0.6,
  max_tokens: 4096,
  top_p: 0.95,
};

// Helper function to pause execution
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* -----------------------------
   4. Run Probes
------------------------------ */
export async function runProbes() {
  const runId = `run_${Date.now()}`;
  const startedAt = new Date().toISOString();
  const modelName = "qwen/qwen3-32b";

  console.log(`Starting run: ${runId}`);
  console.log(`Using model: ${modelName}`);

  const probeResults = [];

  for (const probe of probeset.probes) {
    console.log(`Running probe: ${probe.id}`);
    const startTime = Date.now();

    if (!probe.prompt || typeof probe.prompt !== "string" || probe.prompt.trim() === "") {
      console.warn(`Skipping ${probe.id}: Prompt is empty or missing.`);
      probeResults.push({
        probe_id: probe.id || "UNKNOWN_ID",
        prompt: probe.prompt || null,
        response_text: null,
        latency_ms: null,
        error: "INVALID_PROMPT: Prompt was empty or undefined",
        timestamp: new Date().toISOString(),
      });
      continue; 
    }

    try {
      const result = await ai.chat.completions.create({
        model: modelName,
        messages: [
          { role: "user", content: probe.prompt }
        ],
        temperature: INFERENCE_CONFIG.temperature,
        max_tokens: INFERENCE_CONFIG.max_tokens,
        top_p: INFERENCE_CONFIG.top_p,
        stream: false,
      });

      const responseText = result.choices[0]?.message?.content || "";
      const latencyMs = Date.now() - startTime;

      probeResults.push({
        probe_id: probe.id,
        prompt: probe.prompt,
        response_text: responseText,
        latency_ms: latencyMs,
        error: null,
        timestamp: new Date().toISOString(),
      });

      console.log(`Completed in ${latencyMs} ms`);
      await sleep(1000); // Small delay between probes

    } catch (err) {
      console.error(`API Error on probe ${probe.id}:`, err.message);

      probeResults.push({
        probe_id: probe.id,
        prompt: probe.prompt,
        response_text: null,
        latency_ms: null,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
      
      if (err.message.includes("429")) {
        console.log(`Rate limit hit. Backing off for 10 seconds...`);
        await sleep(10000);
      }
    }
  }

  const completedAt = new Date().toISOString();

  return {
    run_id: runId,
    run_type: "manual",
    probeset_version: probeset.version,
    model_config: {
      provider: "groq",
      model: modelName,
      temperature: INFERENCE_CONFIG.temperature,
      max_output_tokens: INFERENCE_CONFIG.max_tokens,
      top_p: INFERENCE_CONFIG.top_p,
    },
    started_at: startedAt,
    completed_at: completedAt,
    probe_results: probeResults,
  };
}