/**
 * Tokenizer Utility
 * Provides deterministic counting logic for text features.
 */

/**
 * Tokenizes text using a robust regex.
 * @param {string} text 
 * @returns {string[]}
 */
export function tokenize(text) {
  if (!text) return [];
  return text.match(/[\w]+|[^\s\w]/g) || [];
}

/**
 * Counts the number of tokens in a string.
 * @param {string} text 
 * @returns {number}
 */
export function countTokens(text) {
  return tokenize(text).length;
}

/**
 * Counts the number of sentences based on terminal punctuation.
 * @param {string} text 
 * @returns {number}
 */
export function countSentences(text) {
  if (!text) return 0;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.length;
}

/**
 * Counts the number of lines.
 * @param {string} text 
 * @returns {number}
 */
export function countLines(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

/**
 * Counts the number of paragraphs (separated by double newlines).
 * @param {string} text 
 * @returns {number}
 */
export function countParagraphs(text) {
  if (!text) return 0;
  return text.split(/\r?\n\r?\n/).filter(p => p.trim().length > 0).length;
}
