/**
 * Audit Scenarios for Stage 6 Drift Detection
 */

import fs from 'fs';
import path from 'path';
import { computeSegmentScore, cosineDistance } from './src/drift/segmentScorer.js';
import { computeFeatureScore } from './src/drift/featureScorer.js';

const BASELINE_PATH = path.resolve('../data/baselines/baseline_final.json');

async function runAudit() {
    console.log('--- Stage 6 Drift Audit: Scenario Testing ---');

    if (!fs.existsSync(BASELINE_PATH)) {
        console.error('Final baseline not found.');
        return;
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

    // 1. SCENARIO: Identical to Baseline
    console.log('\n[SCENARIO 1] Input Identical to Baseline');

    const cs01_base = baseline.embedding_baselines.find(b => b.probe_id === 'CODE_SAFE_01' && b.embedding_type === 'full');
    const segScoreStable = computeSegmentScore(
        cosineDistance(cs01_base.centroid_vector, cs01_base.centroid_vector),
        cs01_base.p95_distance
    );
    console.log(`- Stable Segment Score (dist=0): ${segScoreStable.toFixed(4)} (Expected: 0)`);

    const mockStableFeatures = {
        token_count: baseline.feature_baselines['CODE_SAFE_01'].token_count.median,
        sentence_count: baseline.feature_baselines['CODE_SAFE_01'].sentence_count.median,
        hard_refusal: baseline.feature_baselines['CODE_SAFE_01'].hard_refusal.rate > 0.5 ? 1 : 0
    };

    const featScoreStable = computeFeatureScore(
        mockStableFeatures,
        baseline.feature_baselines['CODE_SAFE_01']
    );
    console.log(`- Stable Feature Score (at medians): ${featScoreStable.feature_score.toFixed(4)} (Expected: ~0)`);


    // 2. SCENARIO: Artificial Drift
    console.log('\n[SCENARIO 2] Artificial Drift (Extreme Refusal)');

    // Vector that is far from centroid (e.g. inverted)
    const driftedVector = cs01_base.centroid_vector.map(v => -v);
    const segScoreDrift = computeSegmentScore(
        cosineDistance(driftedVector, cs01_base.centroid_vector),
        cs01_base.p95_distance
    );
    console.log(`- Drifted Segment Score (inverted): ${segScoreDrift.toFixed(4)} (Expected: 2.0 because cap is 2.0)`);

    const driftedFeatures = {
        token_count: baseline.feature_baselines['CODE_SAFE_01'].token_count.median + 1000,
        sentence_count: 1,
        hard_refusal: 1 // Baseline rate is 0
    };
    const featScoreDrift = computeFeatureScore(
        driftedFeatures,
        baseline.feature_baselines['CODE_SAFE_01']
    );
    console.log(`- Drifted Feature Score: ${featScoreDrift.feature_score.toFixed(4)} (Expected: > 1.0)`);
}

runAudit().catch(err => console.error(err));
