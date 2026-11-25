import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';
import { ReviewReportSchema } from '../src/types/index.js';


vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(({ prompt }: { prompt: string }) => {
    return (async function* () {
      let result: unknown;

      if (prompt.includes('test coverage') || prompt.includes('Test coverage')) {
        result = {
          file: 'mock-file.ts',
          hasTests: true,
          testFiles: ['tests/mock-file.test.ts'],
          untestedPaths: [],
          coverageEstimate: 85,
          summary: 'Mock test coverage analysis completed successfully'
        };
      } else if (
        prompt.includes('refactoring') ||
        prompt.includes('Refactoring') ||
        prompt.includes('Suggest refactoring')
      ) {
        result = {
          file: 'mock-file.ts',
          suggestions: [],
          summary: 'Mock refactoring analysis completed successfully'
        };
      } else {
        result = {
          file: 'mock-file.ts',
          issues: [],
          overallScore: 90,
          summary: 'Mock code quality analysis completed successfully'
        };
      }

      yield {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result)
            }
          ]
        }
      };
    })();
  })
}));

/**
 * Tests for CodeReviewOrchestrator
 */

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    // Mock the global fetch function to return sample PR files
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/pulls/') && url.includes('/files')) {
        // Return mock PR files
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => [
            {
              filename: 'src/main.ts',
              patch: '+export const greeting = "Hello World";\n',
              status: 'modified'
            },
            {
              filename: 'src/utils/helper.ts',
              patch: '+export function greet(name: string) { return `Hello ${name}`; }\n',
              status: 'added'
            },
            {
              filename: 'tests/main.test.ts',
              patch: '+test("should greet", () => { expect(greeting).toBe("Hello World"); });\n',
              status: 'added'
            }
          ]
        } as any);
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestrator = new CodeReviewOrchestrator();
      expect(orchestrator).toBeDefined();
    });

    it('should initialize with custom model option', () => {
      const customModel = 'claude-haiku-4-5-20251001';
      const orchestrator = new CodeReviewOrchestrator({ model: customModel });
      expect(orchestrator).toBeDefined();
    });

    it('should use ANTHROPIC_MODEL from environment if not provided', () => {
      process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
      const orchestrator = new CodeReviewOrchestrator();
      expect(orchestrator).toBeDefined();
    });
  });

  describe('reviewPullRequest', () => {
    it('should return a ReviewReport object', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('test-owner', 'test-repo', 123);

      expect(report).toBeDefined();
      expect(report.pullRequest).toBeDefined();
      expect(report.fileReviews).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.metadata).toBeDefined();
    });

    it('should validate output with Zod schema', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('test-owner', 'test-repo', 456);

      // This should not throw if the report matches the schema
      const validatedReport = ReviewReportSchema.parse(report);
      expect(validatedReport).toBeDefined();
    });

    it('should populate correct PR metadata', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const owner = 'facebook';
      const repo = 'react';
      const prNumber = 789;

      const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

      expect(report.pullRequest.owner).toBe(owner);
      expect(report.pullRequest.repo).toBe(repo);
      expect(report.pullRequest.number).toBe(prNumber);
    });

    it('should include file reviews for analyzed files', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('test-owner', 'test-repo', 100);

      expect(report.fileReviews.length).toBeGreaterThan(0);

      // Check that each file review has required structure
      for (const fileReview of report.fileReviews) {
        expect(fileReview.file).toBeDefined();
        expect(fileReview.codeQuality).toBeDefined();
        expect(fileReview.testCoverage).toBeDefined();
        expect(fileReview.refactorings).toBeDefined();
      }
    });

    it('should include code quality analysis results', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('test-owner', 'test-repo', 200);

      for (const fileReview of report.fileReviews) {
        const quality = fileReview.codeQuality;
        expect(quality.file).toBeDefined();
        expect(quality.issues).toBeDefined();
        expect(Array.isArray(quality.issues)).toBe(true);
        expect(quality.overallScore).toBeGreaterThanOrEqual(0);
        expect(quality.overallScore).toBeLessThanOrEqual(100);
        expect(quality.summary).toBeDefined();
      }
    });

    it('should include test coverage analysis results', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('test-owner', 'test-repo', 300);

      for (const fileReview of report.fileReviews) {
        const coverage = fileReview.testCoverage;
        expect(coverage.file).toBeDefined();
        expect(coverage.hasTests).toBeDefined();
        expect(coverage.testFiles).toBeDefined();
        expect(Array.isArray(coverage.testFiles)).toBe(true);
        expect(coverage.untestedPaths).toBeDefined();
        expect(Array.isArray(coverage.untestedPaths)).toBe(true);
        expect(coverage.coverageEstimate).toBeGreaterThanOrEqual(0);
        expect(coverage.coverageEstimate).toBeLessThanOrEqual(100);
      }
    });

    it('should include refactoring suggestions', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('test-owner', 'test-repo', 400);

      for (const fileReview of report.fileReviews) {
        const refactoring = fileReview.refactorings;
        expect(refactoring.file).toBeDefined();
        expect(refactoring.suggestions).toBeDefined();
        expect(Array.isArray(refactoring.suggestions)).toBe(true);
        expect(refactoring.summary).toBeDefined();
      }
    });

    it('should include summary statistics', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('test-owner', 'test-repo', 500);

      const summary = report.summary;
      expect(summary.totalFiles).toBeGreaterThanOrEqual(0);
      expect(summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(summary.overallScore).toBeLessThanOrEqual(100);
      expect(summary.criticalIssues).toBeGreaterThanOrEqual(0);
      expect(summary.highPriorityTests).toBeGreaterThanOrEqual(0);
      expect(summary.refactoringOpportunities).toBeGreaterThanOrEqual(0);
    });

    it('should include metadata with timestamps', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('test-owner', 'test-repo', 600);

      const metadata = report.metadata;
      expect(metadata.analyzedAt).toBeDefined();
      expect(metadata.duration).toBeGreaterThanOrEqual(0);
      expect(metadata.agentVersions).toBeDefined();
      expect(metadata.agentVersions['code-quality-analyzer']).toBeDefined();
      expect(metadata.agentVersions['test-coverage-analyzer']).toBeDefined();
      expect(metadata.agentVersions['refactoring-suggester']).toBeDefined();
    });

    it('should include recommendations', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('test-owner', 'test-repo', 700);

      const recommendations = report.recommendations;
      expect(Array.isArray(recommendations)).toBe(true);

      // Check structure of each recommendation
      for (const rec of recommendations) {
        expect(rec.priority).toBeDefined();
        expect(['critical', 'high', 'medium', 'low']).toContain(rec.priority);
        expect(rec.category).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.files).toBeDefined();
        expect(Array.isArray(rec.files)).toBe(true);
      }
    });
  });

  describe('Complex Code Parsing', () => {
    it('should handle complex code with escaped quotes and special characters', async () => {
      // Mock fetch to include complex payment code with escaped quotes
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/pulls/') && url.includes('/files')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => [
              {
                filename: 'src/premium.ts',
                // Complex payment code with escaped quotes and special patterns
                patch: `+interface PaymentDetails {
+  cardNumber: string;  // e.g., "4532-1234-5678-9010"
+  expiryDate: string;  // Format: "MM/YY"
+  cvv: string;        // e.g., "123"
+}
+
+const validateCard = (card: PaymentDetails) => {
+  const regex = /^\\d{16}$/;  // 16 digits
+  if (!regex.test(card.cardNumber)) throw new Error("Invalid");
+};`,
                status: 'added'
              }
            ]
          } as any);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('test-owner', 'test-repo', 999);

      expect(report).toBeDefined();
      expect(report.fileReviews).toHaveLength(1);
      expect(report.fileReviews[0].file).toBe('src/premium.ts');
    });
  });

  describe('Architecture Verification', () => {
    it('Requirement 1: All three subagent definitions contain appropriate tools', async () => {
      // Import agent definitions to verify their structure
      const agents = await import('../src/agents/index.js');

      expect(agents.codeQualityAnalyzer).toBeDefined();
      expect(agents.testCoverageAnalyzer).toBeDefined();
      expect(agents.refactoringSuggester).toBeDefined();

      // Verify tools arrays exist and are non-empty
      expect(agents.codeQualityAnalyzer.tools).toBeDefined();
      expect(Array.isArray(agents.codeQualityAnalyzer.tools)).toBe(true);
      expect(agents.codeQualityAnalyzer.tools.length).toBeGreaterThan(0);

      expect(agents.testCoverageAnalyzer.tools).toBeDefined();
      expect(Array.isArray(agents.testCoverageAnalyzer.tools)).toBe(true);

      expect(agents.refactoringSuggester.tools).toBeDefined();
      expect(Array.isArray(agents.refactoringSuggester.tools)).toBe(true);
    });

    it('Requirement 2: Code Quality Analyzer includes Skill tool', async () => {
      const agents = await import('../src/agents/index.js');

      expect(agents.codeQualityAnalyzer.tools).toContain('Skill');
      expect(agents.codeQualityAnalyzer.description).toMatch(/skill/i);
    });

    it('Requirement 3: Code Quality prompt explicitly instructs use of three Skills', async () => {
      const prompts = await import('../src/prompts/index.js');

      expect(prompts.CODE_QUALITY_ANALYZER_PROMPT).toBeDefined();
      const prompt = prompts.CODE_QUALITY_ANALYZER_PROMPT;

      // Verify all three Skills are mentioned
      expect(prompt).toContain('/typescript-patterns');
      expect(prompt).toContain('/javascript-best-practices');
      expect(prompt).toContain('/security-analysis');

      // Verify section about Skill invocation exists
      expect(prompt).toMatch(/using claude skills|skill.*invocation/i);
    });

    it('Requirement 4: Orchestration calls Agent SDK query()', () => {
      const fs = require('fs');
      const path = require('path');
      const orchestratorPath = path.join(__dirname, '../dist/orchestrator.js');
      const content = fs.readFileSync(orchestratorPath, 'utf-8');

      // Verify sdkQuery is imported
      expect(content).toContain('sdkQuery');

      // Verify query() is actually called (not just imported)
      expect(content).toContain('sdkQuery({');

      // Verify client.messages.create is NOT used
      expect(content).not.toContain('client.messages.create');
    });

    it('Requirement 5: All three subagents are registered in Agent SDK', () => {
      const fs = require('fs');
      const path = require('path');
      const orchestratorPath = path.join(__dirname, '../dist/orchestrator.js');
      const content = fs.readFileSync(orchestratorPath, 'utf-8');

      // Verify all three agents are registered
      expect(content).toContain('code-quality-analyzer');
      expect(content).toContain('test-coverage-analyzer');
      expect(content).toContain('refactoring-suggester');

      // Verify they're in an agents object within query configuration
      expect(content).toMatch(/agents\s*:\s*{/);
    });

    it('Requirement 6: Task tool is in allowedTools for Agent SDK', () => {
      const fs = require('fs');
      const path = require('path');
      const orchestratorPath = path.join(__dirname, '../dist/orchestrator.js');
      const content = fs.readFileSync(orchestratorPath, 'utf-8');

      // Verify Task appears in allowedTools configuration
      expect(content).toContain('allowedTools');
      expect(content).toMatch(/allowedTools.*Task/);
    });

    it('Requirement 7: mcpServersConfig is passed to Agent SDK query()', () => {
      const fs = require('fs');
      const path = require('path');
      const orchestratorPath = path.join(__dirname, '../dist/orchestrator.js');
      const content = fs.readFileSync(orchestratorPath, 'utf-8');

      // Verify mcpServersConfig is imported and used
      expect(content).toContain('mcpServersConfig');

      // Verify it's passed to query options
      expect(content).toMatch(/mcpServers\s*:\s*mcpServersConfig/);
    });

    it('Agent definitions are proper SDK AgentDefinition type', async () => {
      const agents = await import('../src/agents/index.js');

      // Verify they have the required AgentDefinition properties
      ['codeQualityAnalyzer', 'testCoverageAnalyzer', 'refactoringSuggester'].forEach(agentName => {
        const agent = agents[agentName];
        expect(agent.description).toBeDefined();
        expect(typeof agent.description).toBe('string');
        expect(agent.prompt).toBeDefined();
        expect(typeof agent.prompt).toBe('string');
        expect(agent.tools).toBeDefined();
        expect(Array.isArray(agent.tools)).toBe(true);
      });
    });
  });

  describe('Integration', () => {
    // These tests require actual API keys and should be skipped in CI
    it.skip('should review a real small PR', async () => {
      // Test with a real public PR
      // NOTE: Only run manually with valid API keys configured
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1);
      expect(report).toBeDefined();
    });
  });
});
