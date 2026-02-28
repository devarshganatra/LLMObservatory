import { tokenize } from '../utils/tokenizer.js';
import { calculateDensity, clamp01 } from '../utils/normalization.js';
import { PATTERNS } from '../utils/regexUtils.js';

/**
 * TONE Scoring Helpers (Shared with Guardrails)
 */
export function getMoralScore(text) {
    const moralRegex = /\b(ethical|moral|right|wrong|good|bad|integrity|justice|duty|responsibility)\b/gi;
    const count = (text.match(moralRegex) || []).length;
    return clamp01(count / 10);
}

export function getLegalScore(text) {
    const legalRegex = /\b(law|regulation|compliance|legal|statute|contract|liability|court|government)\b/gi;
    const count = (text.match(legalRegex) || []).length;
    return clamp01(count / 5);
}

/**
 * TONE Features
 */
export const toneFeatures = [
    {
        name: 'hedge_ratio',
        category: 'TONE',
        compute: (text) => {
            const tokens = tokenize(text);
            if (tokens.length === 0) return 0;
            // Fix 6: Use expanded hedge lexicon
            const hedgeRegex = new RegExp(`\\b(${PATTERNS.HEDGE_TERMS.join('|')})\\b`, 'gi');
            const hedgeCount = (text.match(hedgeRegex) || []).length;
            return calculateDensity(hedgeCount, tokens.length);
        }
    },
    {
        name: 'assertiveness_ratio',
        category: 'TONE',
        compute: (text) => {
            const tokens = tokenize(text);
            if (tokens.length === 0) return 0;
            const assertionRegex = new RegExp(`\\b(${PATTERNS.ASSERTIONS.join('|')})\\b`, 'gi');
            const assertionCount = (text.match(assertionRegex) || []).length;
            return calculateDensity(assertionCount, tokens.length);
        }
    },
    {
        name: 'moral_language_score',
        category: 'TONE',
        compute: (text) => getMoralScore(text)
    },
    {
        name: 'legal_reference_score',
        category: 'TONE',
        compute: (text) => getLegalScore(text)
    }
];
