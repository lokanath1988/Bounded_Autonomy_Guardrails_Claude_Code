import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk';
import type { Options as SDKOptions } from '@anthropic-ai/claude-agent-sdk';
import { logger } from './utils/logger.js';
import { mcpServersConfig } from './config/mcp.config.js';
import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester
} from './agents/index.js';
import {
  buildOrchestratorPrompt,
  CODE_QUALITY_ANALYZER_PROMPT,
  TEST_COVERAGE_ANALYZER_PROMPT,
  REFACTORING_SUGGESTER_PROMPT
} from './prompts/index.js';
import {
  ReviewReport,
  ReviewReportSchema,
  CodeQualityResult,
  CodeQualityResultSchema,
  TestCoverageResult,
  TestCoverageResultSchema,
  RefactoringSuggestion,
  RefactoringSuggestionSchema
} from './types/index.js';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  model?: string;
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents using Claude Agent SDK to analyze pull requests
 * and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private model: string;

  constructor(options: OrchestratorOptions = {}) {
    this.model = options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
  }

  /**
   * Review a pull request using Agent SDK-coordinated subagent analysis
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startTime = Date.now();
    logger.info('Starting PR review', { owner, repo, prNumber });

    try {
      // Log agent and prompt initialization
      logger.debug('Initializing agents for Agent SDK', {
        qualityAnalyzer: 'code-quality-analyzer',
        testAnalyzer: 'test-coverage-analyzer',
        refactoringAnalyzer: 'refactoring-suggester'
      });

      logger.debug('MCP servers configured', {
        servers: Object.keys(mcpServersConfig)
      });

      // Build orchestrator prompt
      const orchestratorPrompt = buildOrchestratorPrompt(owner, repo, prNumber);
      logger.debug('Orchestrator prompt built');

      // Fetch actual PR files from GitHub
      logger.debug('Fetching PR files from GitHub', { owner, repo, prNumber });
      const prFiles = await this.fetchPullRequestFiles(owner, repo, prNumber);
      logger.info('Fetched PR files', {
        owner,
        repo,
        prNumber,
        fileCount: prFiles.length,
        files: prFiles.map(f => f.filename)
      });

      if (prFiles.length === 0) {
        logger.warn('No files changed in PR', { owner, repo, prNumber });
      }

      // Analyze each file with all three agents in parallel using Agent SDK
      const fileAnalyses: Array<{
        file: string;
        codeQuality: CodeQualityResult;
        testCoverage: TestCoverageResult;
        refactorings: RefactoringSuggestion;
      }> = [];

      for (const file of prFiles) {
        logger.debug('Analyzing PR file', {
          file: file.filename,
          patch: file.patch ? `${file.patch.length} chars` : 'no patch'
        });

        // Run three agent analyses in parallel using Agent SDK Task tool
        const [qualityResult, testResult, refactorResult] = await Promise.all([
          this.runCodeQualityAnalysisWithSDK(owner, repo, prNumber, file.filename, file.patch),
          this.runTestCoverageAnalysisWithSDK(owner, repo, prNumber, file.filename, file.patch),
          this.runRefactoringAnalysisWithSDK(owner, repo, prNumber, file.filename, file.patch)
        ]);

        fileAnalyses.push({
          file: file.filename,
          codeQuality: qualityResult,
          testCoverage: testResult,
          refactorings: refactorResult
        });
      }

      // Aggregate results into ReviewReport
      const report = this.aggregateResults(owner, repo, prNumber, fileAnalyses);

      // Validate output with Zod schema
      const validatedReport = ReviewReportSchema.parse(report);

      const duration = Date.now() - startTime;
      logger.info('PR review completed', {
        owner,
        repo,
        prNumber,
        filesAnalyzed: fileAnalyses.length,
        duration
      });

      return validatedReport;
    } catch (error) {
      logger.error('PR review failed', {
        owner,
        repo,
        prNumber,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Run code quality analysis using Agent SDK with subagent
   */
  private async runCodeQualityAnalysisWithSDK(
    owner: string,
    repo: string,
    prNumber: number,
    filename: string,
    patch?: string
  ): Promise<CodeQualityResult> {
    logger.debug('Running code quality analysis with Agent SDK', {
      file: filename,
      hasPatch: !!patch,
      patchSize: patch ? patch.length : 0
    });

    try {
      // Create analysis prompt for the subagent
      const analysisPrompt = `Analyze this code file for quality issues.

File: ${filename}

Code patch:
\`\`\`
${patch || '(no patch content)'}
\`\`\`

Use the Task tool to invoke the 'code-quality-analyzer' subagent to perform this analysis. The subagent will use Skill tools (/typescript-patterns, /javascript-best-practices, /security-analysis) where appropriate. Return ONLY the JSON results.`;

      logger.debug('Code Quality Analyzer invoking Agent SDK query', {
        file: filename,
        model: this.model
      });

      // Use Agent SDK query with registered subagents and MCP servers
      const sdkOptions: SDKOptions = {
        model: this.model,
        agents: {
          'code-quality-analyzer': codeQualityAnalyzer,
          'test-coverage-analyzer': testCoverageAnalyzer,
          'refactoring-suggester': refactoringSuggester
        },
        tools: ['Read', 'Grep', 'Glob', 'Bash', 'Task', 'Skill'],
        allowedTools: ['Task', 'Skill', 'Read', 'Grep', 'Glob', 'mcp__github', 'mcp__eslint'],
        mcpServers: mcpServersConfig,
        cwd: process.cwd()
      };

      const queryResult = sdkQuery({
        prompt: analysisPrompt,
        options: sdkOptions
      });

      // Collect messages from query
      let responseText = '';
      for await (const message of queryResult) {
        if (message.type === 'assistant' && message.message?.content?.[0]?.type === 'text') {
          responseText += (message.message.content[0] as any).text;
        }
      }

      // Parse JSON from response
      const parsed = this.extractJSON<any>(responseText);

      if (!parsed) {
        const preview = responseText.substring(0, 300);
        logger.error('Code quality JSON parsing failed', {
          file: filename,
          responsePreview: preview,
          totalLength: responseText.length
        });
        throw new Error('No valid JSON object found in model response');
      }

      // Normalize and validate
      const normalized = {
        ...parsed,
        file: filename,
        issues: (parsed.issues || []).map((issue: any) => ({
          ...issue,
          category: this.normalizeCategory(issue.category),
          severity: issue.severity?.toLowerCase() || 'medium'
        }))
      };

      const result = CodeQualityResultSchema.parse(normalized);

      logger.debug('Code quality analysis completed', { file: filename, score: result.overallScore });
      return result;
    } catch (error) {
      logger.error('Code quality analysis failed', {
        file: filename,
        error: error instanceof Error ? error.message : String(error)
      });
      // Return error result with proper schema compliance
      return {
        file: filename,
        issues: [
          {
            line: 1,
            description: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'high' as const,
            category: 'best-practice' as const,
            suggestion: 'Please ensure valid source code is provided'
          }
        ],
        overallScore: 0,
        summary: 'Code quality analysis could not be completed due to an error'
      };
    }
  }

  /**
   * Run test coverage analysis using Agent SDK with subagent
   */
  private async runTestCoverageAnalysisWithSDK(
    owner: string,
    repo: string,
    prNumber: number,
    filename: string,
    patch?: string
  ): Promise<TestCoverageResult> {
    logger.debug('Running test coverage analysis with Agent SDK', {
      file: filename,
      hasPatch: !!patch,
      patchSize: patch ? patch.length : 0
    });

    try {
      const analysisPrompt = `Analyze test coverage for this code file.

File: ${filename}

Code patch:
\`\`\`
${patch || '(no patch content)'}
\`\`\`

Use the Task tool to invoke the 'test-coverage-analyzer' subagent to perform this analysis. Return ONLY the JSON results.`;

      logger.debug('Test Coverage Analyzer invoking Agent SDK query', {
        file: filename,
        model: this.model
      });

      const sdkOptions: SDKOptions = {
        model: this.model,
        agents: {
          'code-quality-analyzer': codeQualityAnalyzer,
          'test-coverage-analyzer': testCoverageAnalyzer,
          'refactoring-suggester': refactoringSuggester
        },
        tools: ['Read', 'Grep', 'Glob', 'Bash', 'Task'],
        allowedTools: ['Task', 'Skill', 'Read', 'Grep', 'Glob', 'mcp__github', 'mcp__eslint'],
        mcpServers: mcpServersConfig,
        cwd: process.cwd()
      };

      const queryResult = sdkQuery({
        prompt: analysisPrompt,
        options: sdkOptions
      });

      let responseText = '';
      for await (const message of queryResult) {
        if (message.type === 'assistant' && message.message?.content?.[0]?.type === 'text') {
          responseText += (message.message.content[0] as any).text;
        }
      }

      const parsed = this.extractJSON<any>(responseText);

      if (!parsed) {
        const preview = responseText.substring(0, 500);
        logger.debug('Response preview', {
          file: filename,
          responsePreview: preview,
          totalLength: responseText.length
        });
        throw new Error('No valid JSON object found in model response');
      }

      const normalized = {
        ...parsed,
        file: filename,
        untestedPaths: (parsed.untestedPaths || []).map((path: any) => ({
          ...path,
          type: this.normalizeTestType(path.type),
          priority: this.normalizePriority(path.priority)
        }))
      };

      const result = TestCoverageResultSchema.parse(normalized);

      logger.debug('Test coverage analysis completed', { file: filename, coverage: result.coverageEstimate });
      return result;
    } catch (error) {
      logger.error('Test coverage analysis failed', {
        file: filename,
        error: error instanceof Error ? error.message : String(error)
      });
      // Return error result with proper schema compliance
      return {
        file: filename,
        hasTests: false,
        testFiles: [],
        untestedPaths: [
          {
            type: 'function' as const,
            location: 'entire-file',
            reasoning: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            priority: 'critical' as const,
            suggestedTest: 'Unable to generate suggestions due to analysis error'
          }
        ],
        coverageEstimate: 0,
        summary: 'Test coverage analysis could not be completed due to an error'
      };
    }
  }

  /**
   * Run refactoring analysis using Agent SDK with subagent
   */
  private async runRefactoringAnalysisWithSDK(
    owner: string,
    repo: string,
    prNumber: number,
    filename: string,
    patch?: string
  ): Promise<RefactoringSuggestion> {
    logger.debug('Running refactoring analysis with Agent SDK', {
      file: filename,
      hasPatch: !!patch,
      patchSize: patch ? patch.length : 0
    });

    try {
      const analysisPrompt = `Suggest refactoring opportunities for this code file.

File: ${filename}

Code patch:
\`\`\`
${patch || '(no patch content)'}
\`\`\`

Use the Task tool to invoke the 'refactoring-suggester' subagent to perform this analysis. Return ONLY the JSON results.`;

      logger.debug('Refactoring Suggester invoking Agent SDK query', {
        file: filename,
        model: this.model
      });

      const sdkOptions: SDKOptions = {
        model: this.model,
        agents: {
          'code-quality-analyzer': codeQualityAnalyzer,
          'test-coverage-analyzer': testCoverageAnalyzer,
          'refactoring-suggester': refactoringSuggester
        },
        tools: ['Read', 'Grep', 'Glob', 'Bash', 'Task'],
        allowedTools: ['Task', 'Skill', 'Read', 'Grep', 'Glob', 'mcp__github', 'mcp__eslint'],
        mcpServers: mcpServersConfig,
        cwd: process.cwd()
      };

      const queryResult = sdkQuery({
        prompt: analysisPrompt,
        options: sdkOptions
      });

      let responseText = '';
      for await (const message of queryResult) {
        if (message.type === 'assistant' && message.message?.content?.[0]?.type === 'text') {
          responseText += (message.message.content[0] as any).text;
        }
      }

      const parsed = this.extractJSON<any>(responseText);

      if (!parsed) {
        const preview = responseText.substring(0, 500);
        logger.debug('Response preview', {
          file: filename,
          responsePreview: preview,
          totalLength: responseText.length
        });
        throw new Error('No valid JSON object found in model response');
      }

      const normalized = {
        ...parsed,
        file: filename,
        suggestions: (parsed.suggestions || []).map((sug: any) => ({
          ...sug,
          type: this.normalizeRefactoringType(sug.type),
          impact: sug.impact?.toLowerCase().replace(/s$/, '') || 'medium'
        }))
      };

      const result = RefactoringSuggestionSchema.parse(normalized);

      logger.debug('Refactoring analysis completed', { file: filename, suggestions: result.suggestions.length });
      return result;
    } catch (error) {
      logger.error('Refactoring analysis failed', {
        file: filename,
        error: error instanceof Error ? error.message : String(error)
      });
      // Return error result with proper schema compliance
      return {
        file: filename,
        suggestions: [
          {
            type: 'extract-function' as const,
            location: 'entire-file',
            impact: 'high' as const,
            description: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            before: 'N/A',
            after: 'N/A',
            benefits: 'Unable to generate suggestions due to analysis error'
          }
        ],
        summary: 'Refactoring analysis could not be completed due to an error'
      };
    }
  }

  /**
   * Extract JSON object from text response
   */
  private extractJSON<T>(text: string): T | null {
    let parsed: T | null = null;
    let braceCount = 0;
    let jsonStart = -1;
    let inString = false;
    let consecutiveBackslashes = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '\\') {
        consecutiveBackslashes++;
      } else {
        if (char === '"' && consecutiveBackslashes % 2 === 0) {
          inString = !inString;
        }
        consecutiveBackslashes = 0;
      }

      if (inString) continue;

      if (char === '{') {
        if (braceCount === 0) jsonStart = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && jsonStart !== -1) {
          const jsonStr = text.substring(jsonStart, i + 1);
          try {
            parsed = JSON.parse(jsonStr);
            break;
          } catch (e) {
            try {
              const fixedJson = jsonStr
                .replace(/,\s*([}\]])/g, '$1')
                .replace(/:\s*$/gm, '');
              parsed = JSON.parse(fixedJson);
              break;
            } catch {
              jsonStart = -1;
              braceCount = 0;
              continue;
            }
          }
        }
      }
    }

    return parsed;
  }

  /**
   * Normalize category enum value
   */
  private normalizeCategory(category: string): string {
    if (!category) return 'best-practice';
    const normalized = category.toLowerCase().replace(/s$/, '');

    const categoryMap: Record<string, string> = {
      'security': 'security',
      'performance': 'performance',
      'maintainability': 'maintainability',
      'best-practice': 'best-practice',
      'best-practices': 'best-practice',
      'bug-risk': 'bug-risk',
      'style': 'style'
    };

    return categoryMap[normalized] || 'best-practice';
  }

  /**
   * Normalize test type enum value
   */
  private normalizeTestType(type: string): string {
    if (!type) return 'function';
    const normalized = type.toLowerCase().replace(/s$/, '');

    const typeMap: Record<string, string> = {
      'function': 'function',
      'class': 'class',
      'branch': 'branch',
      'edge-case': 'edge-case',
      'edge': 'edge-case',
      'edgecase': 'edge-case'
    };

    return typeMap[normalized] || 'function';
  }

  /**
   * Normalize priority enum value
   */
  private normalizePriority(priority: string): string {
    if (!priority) return 'medium';
    const normalized = priority.toLowerCase().replace(/s$/, '');

    const priorityMap: Record<string, string> = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };

    return priorityMap[normalized] || 'medium';
  }

  /**
   * Normalize refactoring type enum value
   */
  private normalizeRefactoringType(type: string): string {
    if (!type) return 'extract-function';
    const normalized = type.toLowerCase().replace(/s$/, '');

    const typeMap: Record<string, string> = {
      'extract-function': 'extract-function',
      'extract-func': 'extract-function',
      'extract-class': 'extract-function',
      'extract-clas': 'extract-function',
      'rename': 'rename',
      'modernize': 'modernize',
      'simplify': 'simplify',
      'pattern-improvement': 'pattern-improvement',
      'pattern-improv': 'pattern-improvement'
    };

    return typeMap[normalized] || 'extract-function';
  }

  /**
   * Fetch actual files and diffs from a GitHub pull request
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Array of files with patches
   */
  private async fetchPullRequestFiles(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<Array<{ filename: string; patch?: string }>> {
    try {
      // Use GitHub API to get PR files
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json'
      };

      // Add authentication token if available
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
      }

      logger.debug('Fetching PR files from GitHub API', { url: apiUrl });

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorMsg = `GitHub API error: ${response.status} ${response.statusText}`;
        logger.error('Failed to fetch PR files', {
          owner,
          repo,
          prNumber,
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(errorMsg);
      }

      const files = await response.json() as Array<{
        filename: string;
        patch?: string;
        status: string;
      }>;

      logger.info('Successfully fetched PR files from GitHub API', {
        owner,
        repo,
        prNumber,
        fileCount: files.length,
        filenames: files.map(f => f.filename)
      });

      // Filter out deleted files and return filename + patch
      const result = files
        .filter(f => f.status !== 'removed')
        .map(f => ({
          filename: f.filename,
          patch: f.patch
        }));

      logger.debug('Filtered PR files', {
        totalFiles: files.length,
        includedFiles: result.length,
        filenames: result.map(f => f.filename)
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Error fetching PR files from GitHub', {
        owner,
        repo,
        prNumber,
        error: errorMsg
      });
      throw error;
    }
  }

  /**
   * Aggregate results from all subagents into a ReviewReport
   */
  private aggregateResults(
    owner: string,
    repo: string,
    prNumber: number,
    fileAnalyses: Array<{
      file: string;
      codeQuality: CodeQualityResult;
      testCoverage: TestCoverageResult;
      refactorings: RefactoringSuggestion;
    }>
  ): ReviewReport {
    const fileReviews = fileAnalyses.map(analysis => ({
      file: analysis.file,
      codeQuality: analysis.codeQuality,
      testCoverage: analysis.testCoverage,
      refactorings: analysis.refactorings
    }));

    // Calculate summary metrics
    const totalFiles = fileAnalyses.length;
    const overallScore = Math.round(
      fileAnalyses.reduce((sum, f) => sum + f.codeQuality.overallScore, 0) /
        Math.max(1, totalFiles)
    );

    const criticalIssues = fileAnalyses.reduce(
      (sum, f) =>
        sum +
        f.codeQuality.issues.filter(i => i.severity === 'critical').length,
      0
    );

    const highPriorityTests = fileAnalyses.reduce(
      (sum, f) =>
        sum +
        f.testCoverage.untestedPaths.filter(p => p.priority === 'critical')
          .length,
      0
    );

    const refactoringOpportunities = fileAnalyses.reduce(
      (sum, f) =>
        sum + f.refactorings.suggestions.filter(s => s.impact === 'high').length,
      0
    );

    // Build recommendations from all results
    const recommendations = this.buildRecommendations(fileAnalyses);

    return {
      pullRequest: {
        owner,
        repo,
        number: prNumber
      },
      fileReviews,
      summary: {
        totalFiles,
        overallScore,
        criticalIssues,
        highPriorityTests,
        refactoringOpportunities
      },
      recommendations,
      metadata: {
        analyzedAt: new Date().toISOString(),
        duration: 0, // Set by caller if needed
        agentVersions: {
          'code-quality-analyzer': '1.0.0',
          'test-coverage-analyzer': '1.0.0',
          'refactoring-suggester': '1.0.0'
        }
      }
    };
  }

  /**
   * Build top recommendations from all analyses
   */
  private buildRecommendations(
    fileAnalyses: Array<{
      file: string;
      codeQuality: CodeQualityResult;
      testCoverage: TestCoverageResult;
      refactorings: RefactoringSuggestion;
    }>
  ) {
    const recommendations = [];

    // Collect critical issues
    for (const analysis of fileAnalyses) {
      for (const issue of analysis.codeQuality.issues) {
        if (issue.severity === 'critical') {
          recommendations.push({
            priority: 'critical' as const,
            category: issue.category,
            description: issue.description,
            files: [analysis.file]
          });
        }
      }
    }

    // Collect high-priority test gaps
    for (const analysis of fileAnalyses) {
      for (const untested of analysis.testCoverage.untestedPaths) {
        if (untested.priority === 'critical') {
          recommendations.push({
            priority: 'high' as const,
            category: 'test-coverage',
            description: `Missing tests for ${untested.location}: ${untested.reasoning}`,
            files: [analysis.file]
          });
        }
      }
    }

    // Collect high-impact refactoring suggestions
    for (const analysis of fileAnalyses) {
      for (const suggestion of analysis.refactorings.suggestions) {
        if (suggestion.impact === 'high') {
          recommendations.push({
            priority: 'high' as const,
            category: 'refactoring',
            description: `${suggestion.type}: ${suggestion.description}`,
            files: [analysis.file]
          });
        }
      }
    }

    // Return top 10 recommendations
    return recommendations.slice(0, 10);
  }
}
