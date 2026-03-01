import fs from 'fs';
import path from 'path';
import { segmentResponse } from './segmenter.js';
import { generateEmbedding } from './embeddingService.js';
import { upsertEmbedding, deleteEmbeddingsByRun } from './qdrantService.js';

/**
 * Embedding Pipeline
 * Orchestrates file-based processing of run results for vector storage.
 */

const DATA_DIR = path.resolve('/Users/devarshganatra/Desktop/llmobservatory/data/runs');

/**
 * Processes a single run file.
 * Reads raw response data, segments it, generates embeddings, and stores in Qdrant.
 * @param {string} filePath - Absolute path to the run_<id>.json file.
 */
export async function processRunFile(filePath) {
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const runData = JSON.parse(rawData);

        const { run_id, probe_results, model_config } = runData;
        const model = model_config?.model || "unknown";
        const temperature = model_config?.temperature || 0;

        console.log(`[INFO] Processing embeddings for run: ${run_id}`);

        // 1. Delete existing embeddings for this run for idempotency
        await deleteEmbeddingsByRun(run_id);

        // 2. Process each probe result
        for (const probe of probe_results) {
            const { probe_id, response_text } = probe;
            const segments = segmentResponse(response_text);

            // Iterate over segments (full, code, safety)
            for (const [type, text] of Object.entries(segments)) {
                if (text) {
                    const vector = await generateEmbedding(text);

                    const payload = {
                        run_id,
                        probe_id,
                        embedding_type: type,
                        model_name: model,
                        temperature,
                        probe_version: "v1", // Default version
                        timestamp: Date.now()
                    };

                    await upsertEmbedding(vector, payload);
                }
            }
        }
        console.log(`[SUCCESS] Completed embeddings for run: ${run_id}`);

    } catch (err) {
        console.error(`[ERROR] Failed to process run file ${filePath}: ${err.message}`);
        throw err;
    }
}

/**
 * Processes a run by its ID.
 * @param {string} run_id 
 */
export async function processRunById(run_id) {
    const filePath = path.join(DATA_DIR, `run_${run_id}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Run file not found: ${filePath}`);
    }
    await processRunFile(filePath);
}

/**
 * Processes all run files in the data directory.
 */
export async function processAllRuns() {
    if (!fs.existsSync(DATA_DIR)) {
        console.warn(`[WARN] Data directory not found: ${DATA_DIR}`);
        return;
    }

    const files = fs.readdirSync(DATA_DIR);
    const runFiles = files.filter(f => f.startsWith('run_') && f.endsWith('.json'));

    for (const file of runFiles) {
        await processRunFile(path.join(DATA_DIR, file));
    }
}

/**
 * Recomputes embeddings for a given run ID.
 * Simply calls processRunById which handles deletion and re-upsert.
 * @param {string} run_id 
 */
export async function recomputeEmbeddings(run_id) {
    await processRunById(run_id);
}
