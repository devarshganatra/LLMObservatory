/**
 * Stage 6: Drift Detection — Configuration
 * 
 * Contains scoring constants (code-level design decisions)
 * and a loader for external threshold config.
 */

import fs from 'fs';
import path from 'path';

// ─── Segment Weights (Decision B) ──────────────────────────────────────────
export const SEGMENT_WEIGHTS = {
    full: 0.60,
    code: 0.25,
    safety: 0.15
};

// ─── Segment Score Cap (Decision A) ────────────────────────────────────────
export const SEGMENT_SCORE_CAP = 2.0;

// ─── Fusion Weights (Decision D) ──────────────────────────────────────────
export const FUSION_WEIGHTS = {
    embedding: 0.65,
    feature: 0.35
};

// ─── Feature Cluster Weights (Decision C) ─────────────────────────────────
export const CLUSTER_WEIGHTS = {
    STRUCTURAL: 0.15,
    GUARDRAIL: 0.35,
    TONE: 0.15,
    SEMANTIC: 0.20,
    COMPLIANCE: 0.10,
    IDENTITY: 0.05
};

// ─── Volatility Multipliers (Decision E) ──────────────────────────────────
export const VOLATILITY_MULTIPLIERS = {
    low: 1.0,
    medium: 0.8,
    medium_high: 0.6,
    high: 0.4
};

// ─── Feature Score Cap ────────────────────────────────────────────────────
export const FEATURE_SCORE_CAP = 2.0;

// ─── Threshold Loader ─────────────────────────────────────────────────────
const DEFAULT_THRESHOLDS = {
    GLOBAL_MEAN_THRESHOLD: 0.5,
    PROBE_DRIFT_THRESHOLD: 0.8,
    LOW_VOL_QUORUM_COUNT: 2,
    EXTREME_ANOMALY_THRESHOLD: 1.5,
    INFO_THRESHOLD: 0.4,
    WARNING_THRESHOLD: 0.6,
    CLEAN_RUNS_TO_RECOVER: 2
};

let _thresholds = null;

export function loadThresholds() {
    if (_thresholds) return _thresholds;

    const configPath = path.resolve(
        '/Users/devarshganatra/Desktop/llmobservatory/data/config/drift_thresholds.json'
    );

    if (fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, 'utf8');
            _thresholds = { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
            console.log('[DRIFT] Loaded thresholds from config file.');
        } catch (err) {
            console.warn(`[DRIFT] Failed to parse thresholds file, using defaults: ${err.message}`);
            _thresholds = { ...DEFAULT_THRESHOLDS };
        }
    } else {
        console.warn('[DRIFT] No thresholds file found, using defaults.');
        _thresholds = { ...DEFAULT_THRESHOLDS };
    }

    return _thresholds;
}
