/**
 * Normalization Utilities
 */

/**
 * Calculates density of a subset vs total.
 * Returns a value between 0 and 1.
 * @param {number} subCount 
 * @param {number} totalCount 
 * @returns {number}
 */
export function calculateDensity(subCount, totalCount) {
    if (!totalCount || totalCount === 0) return 0;
    const density = subCount / totalCount;
    return Math.min(1, Math.max(0, density));
}

/**
 * Simple score normalization (clamps value between 0 and 1).
 * @param {number} value 
 * @returns {number}
 */
export function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}
