import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/index.js';

/**
 * Test Coverage Analyzer Agent
 * Specializes in evaluating test completeness and identifying missing test coverage
 */
export const testCoverageAnalyzer: AgentDefinition = {
  description: 'Analyzes test coverage and identifies missing test cases for functions, branches, and edge cases. Recommends high-priority test additions.',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  model: 'sonnet'
};
