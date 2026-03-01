/**
 * Stage 6 Verification Script
 * Tests all drift detection modules with synthetic data.
 */

import { cosineDistance, computeSegmentScore } from './src/drift/segmentScorer.js';
import { aggregateSegments } from './src/drift/segmentAggregator.js';
import { scoreNumericFeature, scoreBinaryFeature, computeFeatureScore } from './src/drift/featureScorer.js';
import { fuseProbeScores } from './src/drift/probeFusion.js';
import { applyVolatilityWeight } from './src/drift/volatilityWeighter.js';
import { computeRunDecision } from './src/drift/runAggregator.js';
import { updateDriftState } from './src/drift/persistenceEngine.js';
import { classifyDrift } from './src/drift/driftClassifier.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ ${label}`);
        failed++;
    }
}

function approxEqual(a, b, tolerance = 0.001) {
    return Math.abs(a - b) < tolerance;
}

console.log('\n=== Stage 6: Drift Detection Engine Tests ===\n');

// ─── A. Segment Scorer ─────────────────────────────────────────────────────
console.log('--- A. Segment Scorer ---');

// Identical vectors → distance 0
const v1 = [1, 0, 0];
const v2 = [1, 0, 0];
assert(cosineDistance(v1, v2) === 0, 'Identical vectors → distance 0');

// Orthogonal vectors → distance 1
const v3 = [1, 0, 0];
const v4 = [0, 1, 0];
assert(approxEqual(cosineDistance(v3, v4), 1.0), 'Orthogonal vectors → distance 1');

// Score at p95 boundary → 1.0
assert(computeSegmentScore(0.05, 0.05) === 1.0, 'At p95 → score 1.0');

// Score beyond p95 → capped at 2.0
assert(computeSegmentScore(0.15, 0.05) === 2.0, 'Beyond 2×p95 → capped at 2.0');

// Score below p95 → proportional
assert(approxEqual(computeSegmentScore(0.025, 0.05), 0.5), 'Half of p95 → score 0.5');

// p95 == 0, with distance → max cap
assert(computeSegmentScore(0.01, 0) === 2.0, 'p95=0, distance>0 → score CAP');

// p95 == 0, no distance → 0
assert(computeSegmentScore(0, 0) === 0, 'p95=0, distance=0 → score 0');

// ─── B. Segment Aggregator ─────────────────────────────────────────────────
console.log('\n--- B. Segment Aggregator ---');

// All segments present
const agg1 = aggregateSegments({ full: 0.5, code: 0.3, safety: 0.1 });
assert(!agg1.system_error, 'All segments → no system_error');
assert(approxEqual(agg1.embedding_score, (0.6 * 0.5 + 0.25 * 0.3 + 0.15 * 0.1) / 1.0), 'All segments → correct weighted average');

// Missing CODE and SAFETY
const agg2 = aggregateSegments({ full: 0.8, code: null, safety: null });
assert(agg2.embedding_score === 0.8, 'Only FULL → score equals full score');

// No segments → SYSTEM_ERROR
const agg3 = aggregateSegments({ full: null, code: null, safety: null });
assert(agg3.system_error, 'No segments → SYSTEM_ERROR');
assert(agg3.embedding_score === null, 'No segments → null embedding_score');

// ─── C. Feature Scorer ─────────────────────────────────────────────────────
console.log('\n--- C. Feature Scorer ---');

// Numeric: no deviation
assert(scoreNumericFeature(10, { median: 10, mad: 2 }) === 0, 'Exact match → drift 0');

// Numeric: 1 MAD deviation
assert(approxEqual(scoreNumericFeature(12.9652, { median: 10, mad: 2 }), 1.0), '1 scaled-MAD → drift 1.0');

// Numeric: MAD = 0
assert(scoreNumericFeature(11, { median: 10, mad: 0 }) === 2.0, 'MAD=0, differ → drift CAP');
assert(scoreNumericFeature(10, { median: 10, mad: 0 }) === 0, 'MAD=0, match → drift 0');

// Binary: flip from rare baseline (rate=0.02)
const binaryFlip = scoreBinaryFeature(true, { rate: 0.02 });
assert(approxEqual(binaryFlip, 0.98 / 0.98), 'Binary flip from 2% rate → drift 1.0');

// Binary: match baseline
const binaryMatch = scoreBinaryFeature(false, { rate: 0.02 });
assert(approxEqual(binaryMatch, 0.02 / 0.98, 0.05), 'Binary match to 2% rate → drift ~0.02');

// Cluster aggregation
const featureResult = computeFeatureScore(
    { token_count: 500, hard_refusal: true, hedge_ratio: 0.1, concept_coverage_score: 0.5, constraint_satisfied: true, provider_name_detected: false },
    {
        token_count: { median: 480, mad: 20 }, hard_refusal: { rate: 0.0 }, hedge_ratio: { median: 0.08, mad: 0.02 },
        concept_coverage_score: { median: 0.55, mad: 0.1 }, constraint_satisfied: { rate: 1.0 }, provider_name_detected: { rate: 0.0 }
    }
);
assert(typeof featureResult.feature_score === 'number', 'Feature score is numeric');
assert(featureResult.cluster_scores.guardrail !== undefined, 'Cluster scores include guardrail');
console.log(`  Feature score: ${featureResult.feature_score}`);

// ─── D. Probe Fusion ───────────────────────────────────────────────────────
console.log('\n--- D. Probe Fusion ---');

const fusion1 = fuseProbeScores(0.5, 0.3);
assert(approxEqual(fusion1.raw_probe_score, 0.65 * 0.5 + 0.35 * 0.3), 'Fusion: 0.65×emb + 0.35×feat');
assert(!fusion1.system_error, 'No system error');

const fusion2 = fuseProbeScores(null, 0.6);
assert(fusion2.raw_probe_score === 0.6, 'Null embedding → feature-only');
assert(fusion2.system_error, 'Null embedding → system_error flag');

// ─── E. Volatility Weighter ────────────────────────────────────────────────
console.log('\n--- E. Volatility Weighter ---');

const vw1 = applyVolatilityWeight(1.0, 'low', 1.0);
assert(vw1.final_probe_score === 1.0, 'Low vol × 1.0 weight → no change');
assert(vw1.volatility_multiplier === 1.0, 'Low vol multiplier = 1.0');

const vw2 = applyVolatilityWeight(1.0, 'high', 1.5);
assert(approxEqual(vw2.final_probe_score, 0.6), 'High vol × 1.5 weight = 0.6');

// ─── F. Run Aggregator ─────────────────────────────────────────────────────
console.log('\n--- F. Run Aggregator ---');

const probes = [
    { probe_id: 'CODE_SAFE_01', raw_probe_score: 0.1, final_probe_score: 0.1, volatility: 'low', volatility_multiplier: 1.0, probe_weight: 1.0, system_error: false },
    { probe_id: 'CODE_SAFE_02', raw_probe_score: 0.1, final_probe_score: 0.1, volatility: 'low', volatility_multiplier: 1.0, probe_weight: 1.0, system_error: false },
    { probe_id: 'REFUSE_01', raw_probe_score: 0.2, final_probe_score: 0.12, volatility: 'high', volatility_multiplier: 0.4, probe_weight: 1.5, system_error: false },
];

const rd1 = computeRunDecision(probes);
assert(!rd1.drift_detected, 'Low scores → no drift');

// Extreme anomaly test
const probes2 = [
    { probe_id: 'CODE_SAFE_01', raw_probe_score: 1.8, final_probe_score: 1.8, volatility: 'low', volatility_multiplier: 1.0, probe_weight: 1.0, system_error: false },
    { probe_id: 'REFUSE_01', raw_probe_score: 0.1, final_probe_score: 0.06, volatility: 'high', volatility_multiplier: 0.4, probe_weight: 1.5, system_error: false },
];
const rd2 = computeRunDecision(probes2);
assert(rd2.drift_detected, 'Extreme score → drift detected');
assert(rd2.trigger_reason === 'extreme_anomaly', 'Trigger = extreme_anomaly');

// ─── G. Persistence Engine ─────────────────────────────────────────────────
console.log('\n--- G. Persistence Engine ---');

const s1 = updateDriftState('STABLE', 0, { drift_detected: true, trigger_reason: 'global_mean' });
assert(s1.state === 'PENDING', 'STABLE + drift → PENDING');

const s2 = updateDriftState('PENDING', 0, { drift_detected: true, trigger_reason: 'global_mean' });
assert(s2.state === 'CONFIRMED', 'PENDING + drift → CONFIRMED');

const s3 = updateDriftState('PENDING', 0, { drift_detected: false, trigger_reason: 'none' });
assert(s3.state === 'STABLE', 'PENDING + clean → STABLE');

const s4 = updateDriftState('CONFIRMED', 0, { drift_detected: false, trigger_reason: 'none' });
assert(s4.state === 'CONFIRMED' && s4.clean_count === 1, 'CONFIRMED + 1 clean → still CONFIRMED');

const s5 = updateDriftState('CONFIRMED', 1, { drift_detected: false, trigger_reason: 'none' });
assert(s5.state === 'STABLE', 'CONFIRMED + 2 clean → STABLE');

const s6 = updateDriftState('STABLE', 0, { drift_detected: true, trigger_reason: 'extreme_anomaly' });
assert(s6.state === 'CONFIRMED', 'Extreme anomaly → skip to CONFIRMED');

// ─── H. Drift Classifier ──────────────────────────────────────────────────
console.log('\n--- H. Drift Classifier ---');

const c1 = classifyDrift('CONFIRMED', { drift_detected: true, trigger_reason: 'global_mean', weighted_mean: 0.7 }, []);
assert(c1 === 'CRITICAL', 'CONFIRMED → CRITICAL');

const c2 = classifyDrift('PENDING', { drift_detected: true, trigger_reason: 'global_mean', weighted_mean: 0.3 }, []);
assert(c2 === 'WARNING', 'PENDING → WARNING');

const c3 = classifyDrift('STABLE', { drift_detected: false, trigger_reason: 'none', weighted_mean: 0.1 }, [
    { raw_probe_score: 0.5, system_error: false }
]);
assert(c3 === 'INFO', 'Above info threshold → INFO');

// ─── Summary ───────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
