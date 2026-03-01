/**
 * Stage 7: Insight Generator — Orchestrator
 */

import { extractSignals } from './signalExtractor.js';
import { detectEvents } from './eventDetector.js';
import { buildProbeInsight } from './probeInsightBuilder.js';
import { aggregateSystemEvents } from './crossProbeAggregator.js';
import { generateSummaryAndConfidence } from './summaryGenerator.js';

/**
 * Orchestrates the full Stage 7 pipeline.
 * @param {Object} driftData - The drift_metrics.json object
 * @returns {Object} Final insight report
 */
export async function processInsights(driftData) {
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
            ...metadata
        }
    };
}
