/**
 * CLI Entry: Generate Insights for a Drifted Run
 */

import fs from 'fs';
import path from 'path';
import { processInsights } from './src/insights/insightEngine.js';

const DRIFT_METRICS_DIR = path.resolve('../data/drift_metrics');
const INSIGHTS_DIR = path.resolve('../data/insights');

async function main() {
    const runId = process.argv[2];
    if (!runId) {
        console.log('Usage: node generate-insights.js <run_id>');
        process.exit(1);
    }

    // Handle optional run_ prefix
    const idOnly = runId.startsWith('run_') ? runId.replace('run_', '') : runId;
    const metricsPath = path.join(DRIFT_METRICS_DIR, `drift_${idOnly}.json`);

    if (!fs.existsSync(metricsPath)) {
        console.error(`[FATAL] Drift metrics not found for run ${idOnly}: ${metricsPath}`);
        process.exit(1);
    }

    console.log(`[INSIGHTS] Analyzing Drift Metrics: ${idOnly}`);

    try {
        const driftData = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
        const insightReport = await processInsights(driftData);

        // Ensure output dir exists
        if (!fs.existsSync(INSIGHTS_DIR)) fs.mkdirSync(INSIGHTS_DIR, { recursive: true });

        const outputPath = path.join(INSIGHTS_DIR, `insights_${idOnly}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(insightReport, null, 2));

        console.log(`\n--- Insight Summary ---`);
        console.log(`Run ID: ${insightReport.run_id}`);
        console.log(`Classification: ${insightReport.classification}`);
        console.log(`Summary: ${insightReport.summary}`);
        console.log(`Confidence: ${insightReport.run_confidence.toFixed(4)}`);
        console.log(`System Events: ${insightReport.system_events.length}`);
        console.log(`Consistency Hash: ${insightReport.consistency_hash.substring(0, 16)}...`);
        console.log(`------------------------\n`);
        console.log(`Full report saved to: ${outputPath}`);

    } catch (err) {
        console.error(`[FATAL] Insight generation failed:`, err);
        process.exit(1);
    }
}

main();
