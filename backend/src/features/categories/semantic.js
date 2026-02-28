import { clamp01 } from '../utils/normalization.js';
import { calculateConceptCoverage } from '../utils/conceptCoverage.js';

/**
 * SEMANTIC Features
 */
export const semanticFeatures = [
    {
        name: 'keyword_overlap_score',
        category: 'SEMANTIC',
        compute: (text, meta) => {
            const requiredKeywords = meta.required_keywords || [];
            if (requiredKeywords.length === 0) return 0;

            const matched = requiredKeywords.filter(kw => {
                const regex = new RegExp(`\\b${kw}\\b`, 'i');
                return regex.test(text);
            });

            return matched.length / requiredKeywords.length;
        }
    },
    {
        name: 'concept_coverage_score',
        category: 'SEMANTIC',
        async: true,
        compute: async (text, meta) => {
            if (!meta || !meta.probe_id) return 0;

            try {
                // Fully local semantic coverage using MiniLM embeddings
                const score = await calculateConceptCoverage(meta.probe_id, text);
                return score;
            } catch (err) {
                console.error(`[ERROR] concept_coverage_score failed for ${meta.probe_id}:`, err.message);
                return 0; // Safe fallback as per requirements
            }
        }
    }
];
