import fs from 'fs';
import path from 'path';
import { extractFeatures } from './src/features/featureEngine.js';
import { probeMetadataMap } from './src/features/probeMetadata.js';
import { initializeConceptEmbeddings } from './src/features/utils/conceptCoverage.js';

async function runVerification() {
    try {
        // Precompute concept embeddings before extraction
        await initializeConceptEmbeddings();

        // Allow passing a custom run file via CLI: node test-extraction.js <path-to-run.json>
        const runDataPath = process.argv[2] || '../data/runs/run_1772193256173.json';

        if (!fs.existsSync(runDataPath)) {
            console.error(`❌ Error: File not found at ${runDataPath}`);
            process.exit(1);
        }

        const runJson = JSON.parse(fs.readFileSync(runDataPath, 'utf8'));

        console.log(`\n--- Feature Extraction: ${runJson.run_id || 'Unknown Run'} ---`);
        console.log(`Input File: ${runDataPath}`);

        const extractionResult = await extractFeatures(runJson, probeMetadataMap);

        console.log(`\n✅ Extracted features for ${extractionResult.probe_results.length} probes.`);

        // Sample first probe result
        const sample = extractionResult.probe_results[0];
        console.log(`\nSample Probe: ${sample.probe_id}`);
        console.log('Features (Partial):', {
            token_count: sample.features.token_count,
            cot_present: sample.features.cot_present,
            hard_refusal: sample.features.hard_refusal,
            dangerous_instruction_present: sample.features.dangerous_instruction_present,
            concept_coverage_score: sample.features.concept_coverage_score
        });

        // Write result to local file
        const basename = path.basename(runDataPath, '.json');
        const outputPath = `../data/runs/features_${basename}.json`;

        // Ensure output dir exists (relative to script)
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(extractionResult, null, 2));
        console.log(`\n✅ Full feature vector written to: ${outputPath}`);

    } catch (error) {
        console.error('\n❌ Extraction failed:', error);
        process.exit(1);
    }
}

runVerification();
