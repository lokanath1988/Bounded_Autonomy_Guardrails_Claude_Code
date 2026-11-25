import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/index.js';

/**
 * Refactoring Suggester Agent
 * Specializes in recommending architectural improvements and refactoring opportunities
 */
export const refactoringSuggester: AgentDefinition = {
  description: 'Recommends architectural improvements, design pattern applications, and code modernization opportunities.',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'sonnet'
};
