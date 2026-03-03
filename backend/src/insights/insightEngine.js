import { extractSignals } from './signalExtractor.js';
import { detectEvents } from './eventDetector.js';
import { buildProbeInsight } from './probeInsightBuilder.js';
import { aggregateSystemEvents } from './crossProbeAggregator.js';
import { generateSummaryAndConfidence } from './summaryGenerator.js';
import { getDriftRunById, getDriftProbeResultsByDriftRunId } from '../repositories/driftRepository.js';
import { logger } from '../logger/logger.js';

/**
 * Orchestrates the full Stage 7 pipeline.
 * @param {Object} driftData - The drift_metrics.json object
 * @returns {Object} Final insight report
 */
export async function processInsights(driftData) {
    const start = process.hrtime.bigint();

    // Layer 1: Extract Signals
    const profiles = extractSignals(driftData);

    // Layer 2 & 3: Detect Events and Build Probe Insights
    const probeInsights = [];
    const suppressedEventsGlobal = [];

    for (const profile of profiles) {
        const events = detectEvents(profile);
        const insight = buildProbeInsight(profile, events);

        probeInsights.push(insight);

        // Collect suppressed events for transparency
        if (insight.suppressed_events && insight.suppressed_events.length > 0) {
            suppressedEventsGlobal.push(...insight.suppressed_events.map(e => ({
                probe_id: profile.probe_id,
                ...e
            })));
        }
    }

    // Layer 4: Aggregate System Events
    const systemEvents = aggregateSystemEvents(probeInsights);

    // Layer 5: Generate Summary & Confidence
    const {
        summary, dominant_event, run_confidence, consistency_hash, metadata
    } = generateSummaryAndConfidence(driftData, probeInsights, systemEvents);

    const insightDurationMs = Number((process.hrtime.bigint() - start) / 1000000n);

    // Final Report Assembly
    return {
        run_id: driftData.run_id,
        generated_at: new Date().toISOString(),
        baseline_id: driftData.baseline_id,
        classification: driftData.run_decision.classification,
        summary,
        dominant_event,
        run_confidence,
        consistency_hash,
        probe_insights: probeInsights,
        system_events: systemEvents,
        suppressed_events: suppressedEventsGlobal,
        metadata: {
            stage: 7,
            version: "2.0",
            insight_duration_ms: insightDurationMs,
            ...metadata
        }
    };
}

/**
 * DB-Native Insight Generation.
 * Loads context from Postgres.
 * @param {string} driftRunId - Drift Run UUID
 */
export async function processInsightsFromDB(driftRunId) {
    const start = process.hrtime.bigint();

    // 1. Load Drift Run Data
    const driftRun = await getDriftRunById(driftRunId);
    if (!driftRun) throw new Error(`Drift run not found: ${driftRunId}`);

    // 2. Load Drift Probe Results
    const probeResults = await getDriftProbeResultsByDriftRunId(driftRunId);

    // Reconstruct driftData for deterministic logic
    const driftData = {
        run_id: driftRun.original_run_id,
        baseline_id: driftRun.baseline_id,
        run_decision: {
            drift_detected: driftRun.drift_detected,
            trigger_reason: driftRun.trigger_reason,
            weighted_mean: driftRun.weighted_mean,
            classification: driftRun.classification,
            drift_state: driftRun.drift_state
        },
        probe_results: probeResults.map(p => ({
            probe_id: p.probe_id,
            embedding_score: p.embedding_score,
            feature_score: p.feature_score,
            raw_probe_score: p.raw_probe_score,
            final_probe_score: p.final_probe_score,
            volatility: p.volatility,
            segment_scores: p.segment_scores,
            cluster_scores: p.cluster_scores
        }))
    };

    // 3. Call core logic
    const result = await processInsights(driftData);

    const dbInsightDurationMs = Number((process.hrtime.bigint() - start) / 1000000n);

    logger.info({
        driftRunId,
        insight_duration_ms: dbInsightDurationMs,
        dominant_event: result.dominant_event
    }, 'Insight generation complete');

    return result;
}
