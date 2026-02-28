import { FeatureRegistry } from './registry.js';
import { PATTERNS } from './utils/regexUtils.js';

/**
 * Feature Extraction Engine
 */

/**
 * Splitting CoT content from visible text.
 * @param {string} rawText 
 * @returns {Object} { visible_text, cot_text, cot_present, cot_start_index }
 */
export function splitCOT(rawText) {
    if (!rawText) {
        return { visible_text: '', cot_text: '', cot_present: false, cot_start_index: -1 };
    }

    const match = rawText.match(PATTERNS.COT_THINK_TAGS);
    if (match) {
        const cot_text = match[1];
        const visible_text = rawText.replace(match[0], '').trim();
        const cot_present = true;
        const cot_start_index = match.index;
        return { visible_text, cot_text, cot_present, cot_start_index };
    }

    return { visible_text: rawText, cot_text: '', cot_present: false, cot_start_index: -1 };
}

/**
 * Extracts deterministic features from a completed Run object.
 * 
 * @param {Object} runJson - The completed Run object containing probe responses.
 * @param {Object} probeMetadata - Mapping of probe_id to metadata objects.
 * @returns {Promise<Object>} Structured feature vectors per probe.
 */
export async function extractFeatures(runJson, probeMetadata) {
    if (!runJson || !runJson.probe_results) {
        throw new Error('Invalid runJson: missing probe_results');
    }

    const result = {
        run_id: runJson.run_id,
        feature_schema_version: "1.0",
        probe_results: []
    };

    result.probe_results = await Promise.all(runJson.probe_results.map(async (probe) => {
        const rawText = probe.response_text || '';
        const meta = probeMetadata[probe.probe_id] || { probe_id: probe.probe_id };

        // Fix 1: Separate CoT from visible text
        const { visible_text, cot_text, cot_present, cot_start_index } = splitCOT(rawText);

        const features = {};

        // Run all features in parallel
        const featurePromises = FeatureRegistry.map(async (feature) => {
            let value;
            if (feature.category === 'REASONING') {
                value = await feature.compute(rawText, { ...meta, cot_text, cot_present, cot_start_index });
            } else {
                value = await feature.compute(visible_text, meta);
            }
            return { name: feature.name, value };
        });

        const computedFeatures = await Promise.all(featurePromises);
        computedFeatures.forEach(f => {
            features[f.name] = f.value;
        });

        return {
            probe_id: probe.probe_id,
            features
        };
    }));

    return result;
}
