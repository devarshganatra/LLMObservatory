import { initEmbeddingModel } from './src/embeddings/embeddingService.js';
import { ensureCollectionExists } from './src/embeddings/qdrantService.js';
import { processRunById } from './src/embeddings/embeddingPipeline.js';

async function runTest() {
    try {
        const runId = process.argv[2] || "1772193256173";
        console.log(`[TEST] Starting Stage 4 Validation for Run ${runId}...`);

        console.log("[TEST] Initializing Model...");
        await initEmbeddingModel();

        console.log("[TEST] Ensuring Collection...");
        await ensureCollectionExists();

        console.log("[TEST] Processing Run...");
        await processRunById(runId);

        console.log("[TEST] ✅ Stage 4 Pipeline successfully completed for run", runId);
    } catch (err) {
        console.error("[TEST] ❌ Stage 4 Pipeline failed:", err.message);
        process.exit(1);
    }
}

runTest();
