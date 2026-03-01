import { generateBaseline } from './src/baseline/baselineRunner.js';
import { initEmbeddingModel } from './src/embeddings/embeddingService.js';
import { ensureCollectionExists } from './src/embeddings/qdrantService.js';

async function main() {
    console.log("🚀 Starting Production Baseline Generation (30 Runs)");
    console.log("⚠️  This will take ~15-20 minutes due to rate-limiting safety.\n");

    try {
        // Initialize Services
        await initEmbeddingModel();
        await ensureCollectionExists();

        // Start Generation
        await generateBaseline({ runs: 30 });

    } catch (err) {
        console.error("\n❌ Baseline Generation Failed:");
        console.error(err.message);
        process.exit(1);
    }
}

main();
