/**
 * Stage 7: Layer 2 — Event Detection Engine
 */

import { EVENT_THRESHOLDS, MIN_CONFIDENCE_GATE } from './config.js';

/**
 * Detects behavioral events from a signal profile.
 * @param {Object} profile - Normalized signal profile
 * @returns {Array} List of detected events
 */
export function detectEvents(profile) {
    const events = [];

    // Helper: Universal Confidence Formula
    const getConf = (primary, threshold, reinforcing = 0, reThreshold = 1.0) => {
        const primExcess = Math.max(0, Math.min(1.0, (primary / threshold) - 1.0));
        const reExcess = Math.max(0, Math.min(1.0, (reinforcing / reThreshold) - 1.0));
        let conf = 0.7 * primExcess + 0.3 * reExcess;

        // Volatility Dampening
        if (profile.volatility === 'high') conf *= 0.5;
        if (profile.volatility === 'medium_high') conf *= 0.75;

        return Number(conf.toFixed(4));
    };

    // ─── Guardrail Logic ──────────────────────────────────────────────────
    if (profile.cl_guardrail >= EVENT_THRESHOLDS.cl_guardrail) {
        const conf = getConf(profile.cl_guardrail, EVENT_THRESHOLDS.cl_guardrail, profile.seg_safety, EVENT_THRESHOLDS.seg_safety);

        const isTIGHTENING = profile.delta_hard_refusal > 0 || profile.delta_soft_refusal > 0 || profile.base_hard_refusal < 0.5;
        const isSOFTENING = profile.delta_hard_refusal < 0 || profile.delta_soft_refusal < 0;

        if (isSOFTENING && profile.base_hard_refusal >= 0.5) {
            events.push({ event_type: 'GUARDRAIL_SOFTENING', confidence: conf, primary_signal: 'cl_guardrail', primary_value: profile.cl_guardrail });
        } else if (isTIGHTENING) {
            events.push({ event_type: 'GUARDRAIL_TIGHTENING', confidence: conf, primary_signal: 'cl_guardrail', primary_value: profile.cl_guardrail });
        }

        if (profile.category === 'SAFETY_COMPLIANCE' && profile.cl_guardrail >= 0.4) {
            events.push({ event_type: 'REFUSAL_INTENSITY_CHANGE', confidence: conf, primary_signal: 'cl_guardrail', primary_value: profile.cl_guardrail });
        }
    }

    // ─── Code Logic ──────────────────────────────────────────────────────
    if (profile.cl_structural >= EVENT_THRESHOLDS.cl_structural && profile.seg_code >= EVENT_THRESHOLDS.seg_code) {
        const conf = getConf(profile.cl_structural, EVENT_THRESHOLDS.cl_structural, profile.seg_code, EVENT_THRESHOLDS.seg_code);
        if (profile.delta_code_block_count < 0) {
            events.push({ event_type: 'CODE_SUPPRESSION', confidence: conf, primary_signal: 'cl_structural', primary_value: profile.cl_structural });
        } else if (profile.delta_code_block_count > 0) {
            events.push({ event_type: 'CODE_EXPANSION', confidence: conf, primary_signal: 'cl_structural', primary_value: profile.cl_structural });
        }
    }

    if (profile.seg_full >= EVENT_THRESHOLDS.seg_full && ['CODE_GENERATION', 'CODE_EXPLANATION', 'ALGORITHMIC_REASONING'].includes(profile.category)) {
        const conf = getConf(profile.seg_full, EVENT_THRESHOLDS.seg_full, profile.seg_code, EVENT_THRESHOLDS.seg_code);
        events.push({ event_type: 'ALGORITHM_SHIFT', confidence: conf, primary_signal: 'seg_full', primary_value: profile.seg_full });
    }

    if (profile.seg_safety >= EVENT_THRESHOLDS.seg_safety && profile.category === 'SECURITY_AWARENESS') {
        const conf = getConf(profile.seg_safety, EVENT_THRESHOLDS.seg_safety, profile.cl_guardrail, EVENT_THRESHOLDS.cl_guardrail);
        events.push({ event_type: 'SECURITY_PATTERN_CHANGE', confidence: conf, primary_signal: 'seg_safety', primary_value: profile.seg_safety });
    }

    // ─── Structural Logic ─────────────────────────────────────────────────
    if (profile.cl_structural >= EVENT_THRESHOLDS.cl_structural) {
        const conf = getConf(profile.cl_structural, EVENT_THRESHOLDS.cl_structural);
        if (profile.delta_token_count > 0) {
            events.push({ event_type: 'VERBOSITY_INCREASE', confidence: conf, primary_signal: 'cl_structural', primary_value: profile.cl_structural });
        } else if (profile.delta_token_count < 0) {
            events.push({ event_type: 'VERBOSITY_DECREASE', confidence: conf, primary_signal: 'cl_structural', primary_value: profile.cl_structural });
        }

        if (profile.category === 'INSTRUCTION_FOLLOWING') {
            events.push({ event_type: 'FORMAT_DRIFT', confidence: conf, primary_signal: 'cl_structural', primary_value: profile.cl_structural });
        }
    }

    if (profile.cl_compliance >= EVENT_THRESHOLDS.cl_compliance) {
        const conf = getConf(profile.cl_compliance, EVENT_THRESHOLDS.cl_compliance, profile.cl_structural, EVENT_THRESHOLDS.cl_structural);
        events.push({ event_type: 'CONSTRAINT_ADHERENCE_CHANGE', confidence: conf, primary_signal: 'cl_compliance', primary_value: profile.cl_compliance });
    }

    // ─── Tone Logic ──────────────────────────────────────────────────────
    if (profile.cl_tone >= EVENT_THRESHOLDS.cl_tone) {
        const conf = getConf(profile.cl_tone, EVENT_THRESHOLDS.cl_tone);
        if (profile.delta_hedge_ratio > 0) {
            events.push({ event_type: 'HEDGING_INCREASE', confidence: conf, primary_signal: 'cl_tone', primary_value: profile.cl_tone });
        }
        if (profile.delta_assertiveness_ratio > 0) {
            events.push({ event_type: 'ASSERTIVENESS_INCREASE', confidence: conf, primary_signal: 'cl_tone', primary_value: profile.cl_tone });
        }
    }

    // ─── Identity Logic ──────────────────────────────────────────────────
    if (profile.cl_identity >= EVENT_THRESHOLDS.cl_identity && profile.category === 'SYSTEM_CONTEXT') {
        const conf = getConf(profile.cl_identity, EVENT_THRESHOLDS.cl_identity, profile.seg_full, EVENT_THRESHOLDS.seg_full);
        events.push({ event_type: 'SYSTEM_IDENTITY_SHIFT', confidence: conf, primary_signal: 'cl_identity', primary_value: profile.cl_identity });
    }

    // Filter by gate
    return events.filter(e => e.confidence >= MIN_CONFIDENCE_GATE);
}
