/**
 * Verification Script for Stage 7 Insight Generator
 */

import fs from 'fs';
import path from 'path';
import { processInsights } from './src/insights/insightEngine.js';

async function runVerification() {
    console.log('--- Stage 7 Insight Generator: Production Verification ---');

    const metricsPath = path.resolve('../data/drift_metrics/drift_1772301106345.json');
    if (!fs.existsSync(metricsPath)) {
        console.error('Test drift metrics not found.');
        return;
    }
    const driftData = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));

    // 1. IDEMPOTENCY TEST
    console.log('\n[TEST 1] Idempotency & Determinism');
    const report1 = await processInsights(driftData);
    const report2 = await processInsights(driftData);

    // Exclude generated_at from byte comparison
    const { generated_at: t1, ...functional1 } = report1;
    const { generated_at: t2, ...functional2 } = report2;

    const isIdempotent = JSON.stringify(functional1) === JSON.stringify(functional2);
    const hashMatches = report1.consistency_hash === report2.consistency_hash;

    console.log(`- Reports are byte-identical: ${isIdempotent}`);
    console.log(`- Consistency hashes match: ${hashMatches}`);
    console.log(`- Hash: ${report1.consistency_hash}`);

    if (!isIdempotent) throw new Error('Idempotency failure!');

    // 2. ARTIFICIAL DRIFT TEST: Guardrail Softening
    console.log('\n[TEST 2] Scenario: Dangerous Guardrail Softening');

    // Clone and manipulate drift data
    const driftDataSoft = JSON.parse(JSON.stringify(driftData)); // Deep clone

    // Manipulate SEC_CODE_01 to show softening
    const secProbe = driftDataSoft.probe_results.find(p => p.probe_id === 'SEC_CODE_01');
    secProbe.cluster_scores.guardrail = 1.2; // Strong deviation
    secProbe.segment_scores.safety = 1.5;   // Supporting signal
    secProbe.feature_details.hard_refusal = {
        live: 0,
        baseline: 0.8, // Used to be high
        delta: -0.8    // Now zero (softened)
    };

    // Manipulate SEC_CODE_02 to reinforce
    const secProbe2 = driftDataSoft.probe_results.find(p => p.probe_id === 'SEC_CODE_02');
    secProbe2.cluster_scores.guardrail = 1.0;
    secProbe2.feature_details.hard_refusal = {
        live: 0,
        baseline: 0.9,
        delta: -0.9
    };

    const reportSoft = await processInsights(driftDataSoft);
    console.log(`- Summary: "${reportSoft.summary}"`);
    console.log(`- Dominant Event: ${reportSoft.dominant_event}`);
    console.log(`- Confidence: ${reportSoft.run_confidence.toFixed(4)}`);

    if (reportSoft.dominant_event !== 'GUARDRAIL_SOFTENING') {
        throw new Error(`Expected GUARDRAIL_SOFTENING, got ${reportSoft.dominant_event}`);
    }

    // 3. EVENT CAP & PRIORITY TEST
    console.log('\n[TEST 3] Scenario: Event Cap & Priority Tie-breaking');

    const driftDataMulti = JSON.parse(JSON.stringify(driftData));
    const probe = driftDataMulti.probe_results[0]; // CODE_SAFE_01

    // Trigger 4 events on a single probe
    probe.cluster_scores.structural = 2.0;
    probe.feature_details.token_count.delta = 100; // VERBOSITY_INCREASE
    probe.feature_details.code_block_count = { delta: 10 }; // CODE_EXPANSION
    probe.segment_scores.code = 1.0; // reinforcing code

    probe.cluster_scores.tone = 2.0;
    probe.feature_details.hedge_ratio = { delta: 0.5 }; // HEDGING_INCREASE
    probe.feature_details.assertiveness_ratio = { delta: 0.5 }; // ASSERTIVENESS_INCREASE

    const reportMulti = await processInsights(driftDataMulti);
    const p0 = reportMulti.probe_insights[0];
    console.log(`- Probe Events (Capped at 2): ${p0.events.length}`);
    console.log(`- Suppressed Events: ${p0.suppressed_events.length}`);
    console.log(`- Top Event: ${p0.events[0].event_type}`);
    console.log(`- Second Event: ${p0.events[1].event_type}`);

    if (p0.events.length > 2) throw new Error('Event cap failed!');

    console.log('\n[SUCCESS] Stage 7 Verification Complete.');
}

runVerification().catch(err => {
    console.error('\n[FAILED]', err);
    process.exit(1);
});
