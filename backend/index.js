import express from "express";
import dotenv from "dotenv";
import { runProbes } from "./src/inference/runProbes.js";
import { saveRun } from "./src/inference/saveRun.js";
import { initializeConceptEmbeddings } from "./src/features/utils/conceptCoverage.js";

dotenv.config();

// Precompute concept embeddings on boot
initializeConceptEmbeddings().catch(err => {
  console.error("Failed to initialize concept embeddings:", err.message);
});

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

app.listen(3000, () => {
  console.log("LLMObservatory backend running on port 3000");
});