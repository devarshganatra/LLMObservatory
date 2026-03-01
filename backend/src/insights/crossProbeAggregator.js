/**
 * Stage 7: Layer 4 — Cross-Probe Aggregator
 */

import {
    SYSTEM_EVENT_MIN_COUNT,
    SYSTEM_EVENT_MIN_CONFIDENCE,
    SINGLE_PROBE_PROMOTION_CONFIDENCE
} from './config.js';

/**
 * Aggregates probe-level events into system-level events.
 * @param {Array} probeInsights - List of insights from Layer 3
 * @returns {Array} List of System Events
 */
export function aggregateSystemEvents(probeInsights) {
    const eventGroups = {}; // key: event_type

    for (const insight of probeInsights) {
        for (const event of insight.events) {
            if (!eventGroups[event.event_type]) {
                eventGroups[event.event_type] = {
                    event_type: event.event_type,
                    affected_probes: [],
                    confidences: [],
                    categories: {},
                    volatilities: {}
                };
            }

            const group = eventGroups[event.event_type];
            group.affected_probes.push(insight.probe_id);
            group.confidences.push(event.confidence);
            group.categories[insight.category] = (group.categories[insight.category] || 0) + 1;
            group.volatilities[insight.volatility] = (group.volatilities[insight.volatility] || 0) + 1;
        }
    }

    const systemEvents = [];

    for (const [type, group] of Object.entries(eventGroups)) {
        const nonHighVolCount = group.volatilities['high'] ? group.affected_probes.length - group.volatilities['high'] : group.affected_probes.length;
        const meanConf = group.confidences.reduce((a, b) => a + b, 0) / group.confidences.length;
        const maxConf = Math.max(...group.confidences);

        // Promotion Rules
        const isMultiProbe = (nonHighVolCount >= SYSTEM_EVENT_MIN_COUNT && meanConf >= SYSTEM_EVENT_MIN_CONFIDENCE);
        const isStrongSingle = (group.affected_probes.length === 1 && maxConf >= SINGLE_PROBE_PROMOTION_CONFIDENCE && group.volatilities['high'] !== 1);

        if (isMultiProbe || isStrongSingle) {
            systemEvents.push({
                event_type: type,
                affected_probes: group.affected_probes,
                affected_count: group.affected_probes.length,
                mean_confidence: Number(meanConf.toFixed(4)),
                max_confidence: Number(maxConf.toFixed(4)),
                // Dominance Score: sqrt(count) * mean_confidence
                dominance_score: Number((Math.sqrt(group.affected_probes.length) * meanConf).toFixed(4)),
                category_distribution: group.categories
            });
        }
    }

    // Sort by dominance descending
    return systemEvents.sort((a, b) => b.dominance_score - a.dominance_score);
}
