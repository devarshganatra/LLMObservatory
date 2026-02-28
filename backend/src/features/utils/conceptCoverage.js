import { pipeline } from '@xenova/transformers';
import { probeMetadataMap } from '../probeMetadata.js';

/**
 * Local Embedding Utility using Xenova Transformers.
 * Model: Xenova/all-MiniLM-L6-v2 (384 dimensions)
 */

let embedder = null;
const conceptEmbeddingMap = new Map();

/**
 * Singleton pattern for loading the model.
 */
async function getEmbedder() {
    if (!embedder) {
        // feature-extraction returns the last hidden state
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embedder;
}

/**
 * Mean-pools token embeddings and normalizes the result.
 * @param {Tensor} tensor - Tensor from feature-extraction pipeline.
 * @returns {Array<number>} 384-dimensional normalized vector.
 */
function meanPoolAndNormalize(tensor) {
    const { data, shape } = tensor;
    const [batchSize, seqLen, dim] = shape;

    // Mean pooling across tokens
    const pooled = new Float32Array(dim).fill(0);
    for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < dim; j++) {
            pooled[j] += data[i * dim + j];
        }
    }

    for (let j = 0; j < dim; j++) {
        pooled[j] /= seqLen;
    }

    // L2 Normalization
    let norm = 0;
    for (let j = 0; j < dim; j++) {
        norm += pooled[j] * pooled[j];
    }
    norm = Math.sqrt(norm);

    if (norm === 0) return Array.from(pooled);

    const normalized = new Array(dim);
    for (let j = 0; j < dim; j++) {
        normalized[j] = pooled[j] / norm;
    }

    return normalized;
}

/**
 * Computes embedding for a text string.
 */
export async function getEmbedding(text) {
    if (!text || text.trim() === '') return new Array(384).fill(0);

    const extractor = await getEmbedder();
    const output = await extractor(text, { pooling: 'mean', normalize: true });

    // If pooling failed to return a single vector, do it manually
    if (output.shape && output.shape.length > 1 && output.shape[0] === 1 && output.shape[1] > 1) {
        return meanPoolAndNormalize(output);
    }

    return Array.from(output.data || output);
}

/**
 * Precomputes embeddings for all concepts in probeMetadataMap.
 * Should be called once on server boot.
 */
export async function initializeConceptEmbeddings() {
    const start = Date.now();

    // Self-similarity test
    const testA = await getEmbedding("test string");
    const testB = await getEmbedding("test string");
    const selfSim = cosineSimilarity(testA, testB);

    for (const [probeId, metadata] of Object.entries(probeMetadataMap)) {
        const concepts = metadata.semantic_concepts || [];
        if (concepts.length === 0) continue;

        const vectors = await Promise.all(
            concepts.map(concept => getEmbedding(concept))
        );
        conceptEmbeddingMap.set(probeId, vectors);
    }
}

/**
 * Manual Cosine Similarity
 */
export function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    const mag = Math.sqrt(normA) * Math.sqrt(normB);
    if (mag <= 1e-10) return 0;
    return dot / mag;
}

/**
 * Computes the concept coverage score using local embeddings.
 * Mode: Mean Similarity (No Threshold)
 */
export async function calculateConceptCoverage(probeId, responseText) {
    if (!responseText || responseText.trim() === '') return 0;

    const conceptVectors = conceptEmbeddingMap.get(probeId);
    if (!conceptVectors || conceptVectors.length === 0) {
        return 0;
    }

    try {
        const responseVector = await getEmbedding(responseText);
        let similaritySum = 0;

        for (let i = 0; i < conceptVectors.length; i++) {
            const conceptVector = conceptVectors[i];
            similaritySum += cosineSimilarity(responseVector, conceptVector);
        }

        const meanSimilarity = similaritySum / conceptVectors.length;
        // Return rounding to 4 decimal places
        return Number(meanSimilarity.toFixed(4));
    } catch (err) {
        console.error(`[ERROR] Embedding failed for ${probeId}:`, err.message);
        return 0;
    }
}
