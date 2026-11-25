import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/index.js';

/**
 * Code Quality Analyzer Agent
 * Specializes in identifying code quality issues, anti-patterns, and best practice violations
 * Uses Skill invocation for specialized analysis (typescript-patterns, javascript-best-practices, security-analysis)
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description: 'Analyzes code for quality issues, anti-patterns, security vulnerabilities, and best practice violations. Uses specialized analysis skills when relevant.',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  model: 'sonnet'
};
