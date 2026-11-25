/**
 * Subagent exports
 * These are proper Claude Agent SDK AgentDefinition objects ready for registration
 */

export { codeQualityAnalyzer } from './code-quality-analyzer.js';
export { testCoverageAnalyzer } from './test-coverage-analyzer.js';
export { refactoringSuggester } from './refactoring-suggester.js';

/**
 * Agent registry for use with the Agent SDK query configuration
 */
export const agentRegistry = {
  'code-quality-analyzer': () => import('./code-quality-analyzer.js').then(m => m.codeQualityAnalyzer),
  'test-coverage-analyzer': () => import('./test-coverage-analyzer.js').then(m => m.testCoverageAnalyzer),
  'refactoring-suggester': () => import('./refactoring-suggester.js').then(m => m.refactoringSuggester)
} as const;
