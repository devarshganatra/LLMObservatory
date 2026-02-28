import { countSentences } from '../utils/tokenizer.js';
import { SENTENCE_CONSTRAINTS } from '../probeMetadata.js';

/**
 * COMPLIANCE Features
 */
export const complianceFeatures = [
    {
        name: 'constraint_satisfied',
        category: 'COMPLIANCE',
        compute: (text, meta) => {
            if (!meta || !meta.probe_id) return true;

            // Check if probe has sentence constraints
            if (SENTENCE_CONSTRAINTS[meta.probe_id]) {
                const required = SENTENCE_CONSTRAINTS[meta.probe_id];
                const actual = countSentences(text);
                return actual === required;
            }

            return true;
        }
    },
    {
        name: 'sentence_violation_count',
        category: 'COMPLIANCE',
        compute: (text, meta) => {
            if (!meta || !meta.probe_id) return 0;

            // Only compute if probe exists in SENTENCE_CONSTRAINTS
            if (SENTENCE_CONSTRAINTS[meta.probe_id]) {
                const required = SENTENCE_CONSTRAINTS[meta.probe_id];
                const actual = countSentences(text);
                return Math.abs(actual - required);
            }

            return 0;
        }
    }
];
