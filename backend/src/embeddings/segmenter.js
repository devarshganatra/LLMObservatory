/**
 * Segmenter Module
 * Handles splitting raw LLM responses into semantic segments: full, code, and safety.
 */

const SAFETY_KEYWORDS = [
    "cannot",
    "unable",
    "not allowed",
    "unsafe",
    "harmful",
    "illegal",
    "policy",
    "guidelines",
    "sorry",
    "assist with",
    "cannot help",
    "cannot provide"
];

/**
 * Segments a response into full, code, and safety parts.
 * @param {string} response - The raw response text.
 * @returns {Object} { full, code, safety }
 */
export function segmentResponse(response) {
    if (!response) {
        return { full: '', code: null, safety: null };
    }

    const full = response.trim();

    // 1. Extract Code Blocks
    const codeRegex = /```[\s\S]*?```/g;
    const codeMatches = response.match(codeRegex);
    let code = null;

    if (codeMatches) {
        code = codeMatches.map(block => {
            // Remove opening backticks and optional language tag
            let content = block.replace(/^```\w*\s*/, '');
            // Remove closing backticks
            content = content.replace(/```$/, '');
            return content.trim();
        }).join('\n\n');
    }

    // 2. Extract Safety/Refusal Lines
    const lines = response.split('\n');
    const safetyLines = lines.filter(line => {
        const lowerLine = line.toLowerCase();
        return SAFETY_KEYWORDS.some(keyword => lowerLine.includes(keyword.toLowerCase()));
    });

    const safety = safetyLines.length > 0 ? safetyLines.join('\n').trim() : null;

    return { full, code, safety };
}
