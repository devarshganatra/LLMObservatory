import fs from 'fs';
import path from 'path';
import { processDrift } from './src/drift/driftEngine.js';

const RUNS_DIR = path.resolve('../data/runs');
const FEATURES_DIR = path.resolve('../data/features');
const BASELINE_PATH = path.resolve('../data/baselines/baseline_final.json');
const DRIFT_METRICS_DIR = path.resolve('../data/drift_metrics');
const PERSISTENCE_PATH = path.resolve('../data/drift_metrics/persistence_state.json');

async function main() {
    const runId = process.argv[2];
    if (!runId) {
        console.error('Usage: node detect-drift.js <run_id>');
        process.exit(1);
    }

    // 1. Load Baseline
    if (!fs.existsSync(BASELINE_PATH)) {
        console.error('[ERROR] Final baseline not found. Run recompute-final-baseline.js first.');
        process.exit(1);
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

    // 2. Load Run & Features
    const runPath = path.join(RUNS_DIR, `run_${runId}.json`);
    const featurePath = path.join(FEATURES_DIR, `features_run_${runId}.json`);

    if (!fs.existsSync(runPath)) {
        console.error(`[ERROR] Run file not found: ${runPath}`);
        process.exit(1);
    }
    const runData = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    const featuresData = fs.existsSync(featurePath)
        ? JSON.parse(fs.readFileSync(featurePath, 'utf8'))
        : { probe_results: [] };

    // 3. Load Persistence State
    let prevState = { state: 'STABLE', clean_count: 0 };
    if (fs.existsSync(PERSISTENCE_PATH)) {
        prevState = JSON.parse(fs.readFileSync(PERSISTENCE_PATH, 'utf8'));
    }

    console.log(`[DRIFT] Analyzing Run: ${runId}`);
    console.log(`[DRIFT] Current State: ${prevState.state}`);

    // 4. Process Drift
    const result = await processDrift(runData, featuresData, baseline, prevState);

    // 5. Save Results
    if (!fs.existsSync(DRIFT_METRICS_DIR)) fs.mkdirSync(DRIFT_METRICS_DIR, { recursive: true });

    // Update persistence state
    const newState = { state: result.run_decision.drift_state, clean_count: result.run_decision.clean_count };
    fs.writeFileSync(PERSISTENCE_PATH, JSON.stringify(newState, null, 2));

    // Save detailed metrics
    const resultPath = path.join(DRIFT_METRICS_DIR, `drift_${runId}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

    // 6. Print Summary
    console.log('\n--- Drift Report ---');
    console.log(`Classification: ${result.run_decision.classification}`);
    console.log(`Drift Detected: ${result.run_decision.drift_detected}`);
    console.log(`Trigger Reason: ${result.run_decision.trigger_reason}`);
    console.log(`Weighted Mean Score: ${result.run_decision.weighted_mean.toFixed(4)}`);
    console.log(`Final State: ${newState.state}`);
    console.log("Feature baseline sample_size:", baseline.sample_size);
    console.log("Feature baseline probes:", Object.keys(baseline).length);

    if (result.run_decision.drift_detected) {
        console.log('\nDrifted Probes:');
        result.probe_results.filter(p => p.raw_probe_score > 0.8).forEach(p => {
            console.log(` - ${p.probe_id}: score=${p.raw_probe_score.toFixed(4)} (vol=${p.volatility})`);
        });
    }
    console.log('--------------------\n');
    console.log(`Full report saved to: ${resultPath}`);
}

main().catch(err => {
    console.error(`[FATAL] ${err.stack}`);
    process.exit(1);
});
