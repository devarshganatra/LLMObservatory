/**
 * Stage 7: Layer 5 — Summary & Confidence Generator
 */

import crypto from 'crypto';
import { TEMPLATES, CATEGORY_DESCRIPTIONS, EVENT_PRIORITY } from './config.js';

/**
 * Generates human-readable summary, geometric confidence, and consistency hash.
 * @param {Object} driftData - Raw Stage 6 drift data
 * @param {Array} probeInsights - Results from Layer 3
 * @param {Array} systemEvents - Results from Layer 4
 * @returns {Object} Summary, confidence, and hash
 */
export function generateSummaryAndConfidence(driftData, probeInsights, systemEvents) {
    const runDecision = driftData.run_decision;
    const classification = runDecision.classification;
    const persistenceState = runDecision.drift_state;

    // 1. Dominant System Event Selection (Tie-breaking by Priority)
    let dominantEvent = null;
    if (systemEvents.length > 0) {
        const topDominance = systemEvents[0].dominance_score;
        const candidates = systemEvents.filter(e => e.dominance_score === topDominance);

        if (candidates.length === 1) {
            dominantEvent = candidates[0];
        } else {
            // Priority tie-break
            dominantEvent = candidates.sort((a, b) => {
                const pA = EVENT_PRIORITY.indexOf(a.event_type);
                const pB = EVENT_PRIORITY.indexOf(b.event_type);
                return (pA !== -1 ? pA : 99) - (pB !== -1 ? pB : 99);
            })[0];
        }
    }

    // 2. Summary Generation
    let summary = '';
    if (dominantEvent) {
        const template = TEMPLATES[dominantEvent.event_type];
        const n = dominantEvent.affected_count;
        const mainCat = Object.entries(dominantEvent.category_distribution).sort((a, b) => b[1] - a[1])[0][0];
        const catDesc = CATEGORY_DESCRIPTIONS[mainCat] || 'various';

        summary = template.replace('{N}', n).replace('{cat}', catDesc);
    } else {
        // Fallback summaries
        if (classification === 'INFO') summary = TEMPLATES.INFO_DEFAULT;
        else if (classification === 'WARNING') summary = TEMPLATES.WARNING_DEFAULT;
        else if (classification === 'CRITICAL') summary = TEMPLATES.CRITICAL_DEFAULT;
    }

    // 3. Run-Level Confidence (Geometric Mean)
    // ratio = probes_with_events / total_probes
    const totalProbes = probeInsights.length;
    const probesWithEvents = probeInsights.filter(p => p.events.length > 0).length;
    const ratio = totalProbes > 0 ? (probesWithEvents / totalProbes) : 0;

    // mean_system_conf
    const meanSysConf = systemEvents.length > 0
        ? systemEvents.reduce((a, b) => a + b.mean_confidence, 0) / systemEvents.length
        : 0;

    const persistenceFactor = { 'STABLE': 0.0, 'PENDING': 0.5, 'CONFIRMED': 1.0 }[persistenceState] ?? 0.0;

    const baseConf = Math.sqrt(ratio * meanSysConf);
    const runConfidence = Math.min(1.0, baseConf * (0.7 + 0.3 * persistenceFactor));

    // 4. Consistency Hash
    const hashPayload = JSON.stringify([
        probeInsights.map(p => p.events.map(e => e.event_type)),
        systemEvents.map(s => s.event_type),
        dominantEvent?.event_type || null
    ]);
    const consistencyHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    return {
        summary,
        dominant_event: dominantEvent?.event_type || null,
        run_confidence: Number(runConfidence.toFixed(4)),
        consistency_hash: consistencyHash,
        metadata: {
            probes_with_events: probesWithEvents,
            total_probes: totalProbes,
            persistence_state: persistenceState
        }
    };
}
