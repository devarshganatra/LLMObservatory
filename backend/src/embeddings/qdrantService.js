import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';

/**
 * Qdrant Service
 * Manages vector storage and retrieval for probe embeddings.
 */

const client = new QdrantClient({ url: 'http://localhost:6333' });
const COLLECTION_NAME = 'probe_embeddings';

/**
 * Ensures the 'probe_embeddings' collection exists in Qdrant.
 * Sets up 384-dimensional vectors with Cosine distance.
 */
export async function ensureCollectionExists() {
    try {
        const collections = await client.getCollections();
        const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

        if (!exists) {
            await client.createCollection(COLLECTION_NAME, {
                vectors: {
                    size: 384,
                    distance: 'Cosine'
                }
            });
            console.log(`[INFO] Created Qdrant collection: ${COLLECTION_NAME}`);
        }
    } catch (err) {
        console.error(`[ERROR] Failed to ensure Qdrant collection: ${err.message}`);
        throw err;
    }
}

/**
 * Upserts a single embedding vector with its metadata payload.
 * @param {Array<number>} vector - The 384-dimensional embedding vector.
 * @param {Object} payload - Metadata including run_id, probe_id, type, etc.
 */
export async function upsertEmbedding(vector, payload) {
    try {
        const point = {
            id: uuidv4(),
            vector: vector,
            payload: payload
        };

        await client.upsert(COLLECTION_NAME, {
            wait: true,
            points: [point]
        });
    } catch (err) {
        console.error(`[ERROR] Qdrant upsert failed: ${err.message}`);
        throw err;
    }
}

/**
 * Deletes all embeddings associated with a specific run_id.
 * Used for idempotency before recomputing or reprocessing a run.
 * @param {string} run_id 
 */
export async function deleteEmbeddingsByRun(run_id) {
    try {
        await client.delete(COLLECTION_NAME, {
            filter: {
                must: [
                    {
                        key: 'run_id',
                        match: { value: run_id }
                    }
                ]
            }
        });
    } catch (err) {
        console.error(`[ERROR] Failed to delete embeddings for run ${run_id}: ${err.message}`);
        throw err;
    }
}
/**
 * Retrieves all embeddings associated with a list of run_ids.
 * Uses scrolling to handle potentially large result sets.
 * @param {Array<string>} runIds 
 * @returns {Promise<Array<Object>>} List of points with vectors and payloads.
 */
export async function getEmbeddingsByRunIds(runIds) {
    try {
        let allPoints = [];
        let nextOffset = null;

        do {
            const response = await client.scroll(COLLECTION_NAME, {
                filter: {
                    must: [
                        {
                            key: 'run_id',
                            match: { any: runIds }
                        }
                    ]
                },
                limit: 100,
                offset: nextOffset,
                with_vector: true,
                with_payload: true
            });

            allPoints = allPoints.concat(response.points);
            nextOffset = response.next_page_offset;
        } while (nextOffset);

        return allPoints;
    } catch (err) {
        console.error(`[ERROR] Qdrant scroll failed: ${err.message}`);
        throw err;
    }
}
