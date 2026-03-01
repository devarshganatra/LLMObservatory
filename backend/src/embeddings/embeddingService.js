import { pipeline } from '@xenova/transformers';

/**
 * Embedding Service
 * Local embedding generation using Xenova Transformers.
 */

let embedder = null;

/**
 * Initialize the embedding model.
 * Should be called once during startup.
 */
export async function initEmbeddingModel() {
    if (!embedder) {
        // feature-extraction returns the last hidden state for all tokens
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embedder;
}

/**
 * Generates a 384-dimensional normalized embedding for the given text.
 * Uses mean pooling and L2 normalization.
 * @param {string} text 
 * @returns {Promise<Array<number>>}
 */
export async function generateEmbedding(text) {
    if (!text || text.trim() === '') {
        return new Array(384).fill(0);
    }

    if (!embedder) {
        await initEmbeddingModel();
    }

    const output = await embedder(text, { pooling: 'mean', normalize: true });

    // Ensure it's 384 dimensions
    const vector = Array.from(output.data);
    if (vector.length !== 384) {
        throw new Error(`Embedding dimension mismatch: expected 384, got ${vector.length}`);
    }

    return vector;
}
