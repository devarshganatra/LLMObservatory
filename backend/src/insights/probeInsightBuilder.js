/**
 * Stage 7: Layer 3 — Probe Insight Builder
 */

import { MAX_EVENTS_PER_PROBE } from './config.js';

/**
 * Builds structured probe insights and handles the event cap.
 * @param {Object} profile - Signal profile
 * @param {Array} events - Detected events for this probe
 * @returns {Object} Probe insight object
 */
export function buildProbeInsight(profile, events) {
    // Sort events by confidence descending
    const sortedEvents = [...events].sort((a, b) => b.confidence - a.confidence);

    // Apply cap
    const finalEvents = sortedEvents.slice(0, MAX_EVENTS_PER_PROBE);
    const suppressed = sortedEvents.slice(MAX_EVENTS_PER_PROBE).map(e => ({
        ...e,
        reason: 'event_cap_exceeded'
    }));

    // Determine severity
    let severity = 'LOW';
    if (profile.raw_probe_score >= 1.0) severity = 'CRITICAL';
    else if (profile.raw_probe_score >= 0.6) severity = 'HIGH';
    else if (profile.raw_probe_score >= 0.3) severity = 'MODERATE';

    return {
        probe_id: profile.probe_id,
        category: profile.category,
        volatility: profile.volatility,
        raw_probe_score: profile.raw_probe_score,
        final_probe_score: profile.final_probe_score,
        insight_severity: severity,
        dominant_event: finalEvents.length > 0 ? finalEvents[0].event_type : null,
        events: finalEvents,
        suppressed_events: suppressed
    };
}
