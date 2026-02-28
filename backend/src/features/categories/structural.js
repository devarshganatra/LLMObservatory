import { countTokens, countLines, countSentences, countParagraphs } from '../utils/tokenizer.js';
import { countMatches, PATTERNS } from '../utils/regexUtils.js';
import { calculateDensity } from '../utils/normalization.js';

/**
 * STRUCTURAL Features
 * Operates ONLY on visible_text (CoT already removed by engine).
 */
export const structuralFeatures = [
    {
        name: 'token_count',
        category: 'STRUCTURAL',
        compute: (text) => countTokens(text)
    },
    {
        name: 'sentence_count',
        category: 'STRUCTURAL',
        compute: (text) => countSentences(text)
    },
    {
        name: 'line_count',
        category: 'STRUCTURAL',
        compute: (text) => countLines(text)
    },
    {
        name: 'paragraph_count',
        category: 'STRUCTURAL',
        compute: (text) => countParagraphs(text)
    },
    {
        name: 'code_block_count',
        category: 'STRUCTURAL',
        compute: (text) => countMatches(text, PATTERNS.CODE_BLOCK)
    },
    {
        name: 'avg_code_block_length',
        category: 'STRUCTURAL',
        compute: (text) => {
            const codeMatches = text.match(PATTERNS.CODE_BLOCK) || [];
            if (codeMatches.length === 0) return 0;
            const totalCodeTokens = codeMatches.reduce((sum, block) => sum + countTokens(block), 0);
            return totalCodeTokens / codeMatches.length;
        }
    },
    {
        name: 'code_density',
        category: 'STRUCTURAL',
        compute: (text) => {
            const visibleTokens = countTokens(text);
            if (visibleTokens === 0) return 0;
            const codeMatches = text.match(PATTERNS.CODE_BLOCK) || [];
            const codeTokens = codeMatches.reduce((sum, block) => sum + countTokens(block), 0);
            return calculateDensity(codeTokens, visibleTokens);
        }
    },
    {
        name: 'markdown_density',
        category: 'STRUCTURAL',
        compute: (text) => {
            const visibleTokens = countTokens(text);
            if (visibleTokens === 0) return 0;

            // Fix 4: Sum headers, bullets, HRs, and bold/italic markers
            const mdElementsCount =
                countMatches(text, PATTERNS.MARKDOWN_HEADER) +
                countMatches(text, PATTERNS.BULLET_POINT) +
                countMatches(text, PATTERNS.HORIZONTAL_RULE) +
                countMatches(text, PATTERNS.BOLD_ITALIC);

            return calculateDensity(mdElementsCount, visibleTokens);
        }
    }
];
