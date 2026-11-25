import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { logger, logReviewStart, logReviewComplete, logReviewError } from './utils/logger.js';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  try {
    // Validate command line arguments
    if (!owner || !repo || !prStr) {
      console.error(
        'Usage: npm run dev <owner> <repo> <pr-number>\n' +
          'Example: npm run dev facebook react 12345'
      );
      process.exit(1);
    }

    const prNumber = parseInt(prStr, 10);
    if (isNaN(prNumber) || prNumber < 1) {
      console.error(`Error: PR number must be a valid positive integer, got "${prStr}"`);
      process.exit(1);
    }

    // Validate authentication (choose ONE method)
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    const hasBedrockCreds =
      !!process.env.AWS_ACCESS_KEY_ID &&
      !!process.env.AWS_SECRET_ACCESS_KEY;

    if (!hasApiKey && !hasBedrockCreds) {
      console.error(
        'Error: No authentication configured.\n' +
          'Please set ONE of the following:\n' +
          '  1. ANTHROPIC_API_KEY (for Anthropic API)\n' +
          '  2. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (for AWS Bedrock)\n' +
          'See .env.example for configuration details.'
      );
      process.exit(1);
    }

    // Log authentication method
    if (hasBedrockCreds) {
      if (!process.env.AWS_REGION) {
        console.error('Error: AWS_REGION is required for Bedrock authentication');
        process.exit(1);
      }
      logger.info('🔐 Using AWS Bedrock authentication', { region: process.env.AWS_REGION });
    } else {
      logger.info('🔐 Using Anthropic API authentication');
    }

    // Validate ANTHROPIC_MODEL environment variable
    const model = process.env.ANTHROPIC_MODEL;
    if (!model) {
      console.error(
        'Error: ANTHROPIC_MODEL environment variable is required.\n' +
          'Set it in your .env file. Examples:\n' +
          '  - Anthropic API: claude-sonnet-4-5-20250929\n' +
          '  - AWS Bedrock: us.anthropic.claude-sonnet-4-5-20250929-v1:0'
      );
      process.exit(1);
    }

    logger.info('Starting code review', { owner, repo, prNumber, model });

    // Create orchestrator instance
    const orchestrator = new CodeReviewOrchestrator({ model });

    // Log review start
    logReviewStart(owner, repo, prNumber);

    // Run review
    const startTime = Date.now();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);
    const duration = Date.now() - startTime;

    // Log review completion
    logReviewComplete(owner, repo, prNumber, report.summary.overallScore, duration);

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
      logger.info('Created reports directory', { path: reportsDir });
    }

    // Generate and save reports
    const generator = new ReportGenerator();

    // Markdown report
    const markdownReport = generator.generateMarkdownReport(report);
    const markdownPath = path.join(reportsDir, `${owner}-${repo}-${prNumber}-review.md`);
    fs.writeFileSync(markdownPath, markdownReport, 'utf-8');
    logger.info('Markdown report saved', { path: markdownPath });
    console.log(`\n📄 Markdown report: ${markdownPath}`);

    // HTML report
    const htmlReport = generator.generateHTMLReport(report);
    const htmlPath = path.join(reportsDir, `${owner}-${repo}-${prNumber}-review.html`);
    fs.writeFileSync(htmlPath, htmlReport, 'utf-8');
    logger.info('HTML report saved', { path: htmlPath });
    console.log(`🌐 HTML report: ${htmlPath}`);

    // JSON report
    const jsonReport = generator.generateJSONReport(report);
    const jsonPath = path.join(reportsDir, `${owner}-${repo}-${prNumber}-review.json`);
    fs.writeFileSync(jsonPath, jsonReport, 'utf-8');
    logger.info('JSON report saved', { path: jsonPath });
    console.log(`📊 JSON report: ${jsonPath}`);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Code Review Summary');
    console.log('='.repeat(60));
    console.log(`Repository: ${owner}/${repo}#${prNumber}`);
    console.log(`Overall Score: ${report.summary.overallScore}/100`);
    console.log(`Files Reviewed: ${report.summary.totalFiles}`);
    console.log(`Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`Test Coverage Gaps: ${report.summary.highPriorityTests}`);
    console.log(`Refactoring Opportunities: ${report.summary.refactoringOpportunities}`);
    console.log(`Duration: ${duration}ms`);
    console.log('='.repeat(60) + '\n');

    logger.info('Code review completed successfully', {
      owner,
      repo,
      prNumber,
      score: report.summary.overallScore,
      duration
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logReviewError(
      process.argv[2] || 'unknown',
      process.argv[3] || 'unknown',
      parseInt(process.argv[4] || '0', 10),
      errorObj
    );
    console.error(
      'Error during code review:',
      errorObj.message
    );
    process.exit(1);
  }
}

main();
