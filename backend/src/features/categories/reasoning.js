import { countTokens } from '../utils/tokenizer.js';
import { calculateDensity } from '../utils/normalization.js';

/**
 * REASONING Features
 * Uses pre-split CoT data from the engine.
 */
export const reasoningFeatures = [
    {
        name: 'cot_present',
        category: 'REASONING',
        compute: (text, meta) => meta.cot_present || false
    },
    {
        name: 'cot_token_ratio',
        category: 'REASONING',
        compute: (text, meta) => {
            if (!meta.cot_present) return 0;
            const cotTokens = countTokens(meta.cot_text);
            const totalTokens = countTokens(text); // rawText passed here by engine for reasoning
            return calculateDensity(cotTokens, totalTokens);
        }
    },
    {
        name: 'cot_position_index',
        category: 'REASONING',
        compute: (text, meta) => {
            if (!meta.cot_present || text.length === 0) return -1;
            return calculateDensity(meta.cot_start_index, text.length);
        }
    }
];
