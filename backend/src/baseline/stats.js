/**
 * Utility for robust statistics
 */

export function median(values) {
    if (values.length === 0) return 0;
    const numericValues = values.map(v => typeof v === 'boolean' ? (v ? 1 : 0) : Number(v));
    const sorted = [...numericValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mad(values, med) {
    if (values.length === 0) return 0;
    const numericValues = values.map(v => typeof v === 'boolean' ? (v ? 1 : 0) : Number(v));
    const m = med ?? median(numericValues);
    const deviations = numericValues.map(v => Math.abs(v - m));
    return median(deviations);
}

export function calculateRate(values) {
    if (values.length === 0) return 0;
    const trueCount = values.filter(v => !!v).length;
    return trueCount / values.length;
}
