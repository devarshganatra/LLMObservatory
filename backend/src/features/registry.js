import { structuralFeatures } from './categories/structural.js';
import { reasoningFeatures } from './categories/reasoning.js';
import { guardrailFeatures } from './categories/guardrail.js';
import { toneFeatures } from './categories/tone.js';
import { complianceFeatures } from './categories/compliance.js';
import { semanticFeatures } from './categories/semantic.js';
import { identityFeatures } from './categories/identity.js';

/**
 * Registry of all available features.
 */
export const FeatureRegistry = [
    ...structuralFeatures,
    ...reasoningFeatures,
    ...guardrailFeatures,
    ...toneFeatures,
    ...complianceFeatures,
    ...semanticFeatures,
    ...identityFeatures
];
