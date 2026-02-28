import { PATTERNS } from '../utils/regexUtils.js';

/**
 * IDENTITY Features
 */
export const identityFeatures = [
    {
        name: 'provider_name_detected',
        category: 'IDENTITY',
        compute: (text) => PATTERNS.PROVIDER_NAMES.test(text)
    },
    {
        name: 'model_name_detected',
        category: 'IDENTITY',
        compute: (text) => {
            const modelRegex = /\b(GPT-[345]|Claude|Llama|Gemini|Mistral|Qwen|DeepSeek|Mixtral)\b/gi;
            return modelRegex.test(text);
        }
    },
    {
        name: 'cutoff_date_detected',
        category: 'IDENTITY',
        compute: (text) => PATTERNS.CUTOFF_DATE.test(text)
    },
    {
        name: 'limitation_count',
        category: 'IDENTITY',
        compute: (text) => {
            const limitations = /\b(cannot|unable|limitation|restricted|don't have access|knowledge cutoff)\b/gi;
            return (text.match(limitations) || []).length;
        }
    }
];
