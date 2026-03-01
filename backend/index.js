import express from "express";
import dotenv from "dotenv";
import { runProbes } from "./src/inference/runProbes.js";
import { saveRun } from "./src/inference/saveRun.js";
import { initializeConceptEmbeddings } from "./src/features/utils/conceptCoverage.js";
import { initEmbeddingModel } from "./src/embeddings/embeddingService.js";
import { ensureCollectionExists } from "./src/embeddings/qdrantService.js";

dotenv.config();

/**
 * Global Initialization
 */
async function bootstrap() {
  console.log("[INFO] Starting LLMObservatory Backend...");

  // Stage 3 Initialization
  await initializeConceptEmbeddings().catch(err => {
    console.error("[ERROR] Failed to initialize concept embeddings:", err.message);
  });

  // Stage 4 Initialization
  console.log("[INFO] Initializing Stage 4 Embedding Model...");
  await initEmbeddingModel();

  console.log("[INFO] Ensuring Qdrant Collection Exists...");
  await ensureCollectionExists();

  const app = express();
  app.use(express.json());

  app.post("/run", async (req, res) => {
    try {
      const runData = await runProbes();
      saveRun(runData);
      res.json({ status: "success", run_id: runData.run_id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[SUCCESS] LLMObservatory backend running on port ${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error("[CRITICAL] Server failed to start:", err.message);
  process.exit(1);
});