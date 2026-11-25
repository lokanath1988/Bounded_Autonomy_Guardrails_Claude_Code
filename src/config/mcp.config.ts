/**
 * Model Context Protocol (MCP) server configurations
 *
 * Required MCP Servers:
 * 1. GitHub - For PR/repo operations
 * 2. ESLint - For code linting and style analysis
 *
 * Documentation:
 * - MCP Protocol: https://modelcontextprotocol.io
 * - GitHub MCP: https://github.com/github/github-mcp-server
 * - ESLint MCP: https://eslint.org/docs/latest/use/mcp
 */

import type { McpServerConfig } from '@anthropic-ai/claude-agent-sdk';

export const mcpServersConfig = {
  /**
   * GitHub MCP Server
   * Provides tools for GitHub API operations
   *
   * Configuration:
   * - type: 'stdio' - Uses standard input/output for communication
   * - command: 'npx' - Execute through npm package runner
   * - args: ['-y', '@modelcontextprotocol/server-github'] - Automatically download and run GitHub MCP
   * - env: Maps GITHUB_TOKEN env var to GITHUB_PERSONAL_ACCESS_TOKEN (expected by server)
   *
   * Note: GITHUB_TOKEN is optional (recommended for private repos and higher rate limits).
   * The GitHub MCP server expects GITHUB_PERSONAL_ACCESS_TOKEN as the env var name.
   * We map our GITHUB_TOKEN from .env to this expected name.
   */
  github: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || ''
    }
  } as McpServerConfig,

  /**
   * ESLint MCP Server
   * Provides tools for linting and code quality analysis
   *
   * Configuration:
   * - type: 'stdio' - Uses standard input/output for communication
   * - command: 'npx' - Execute through npm package runner
   * - args: ['-y', '@eslint/mcp@latest'] - Automatically download and run latest ESLint MCP
   * - env: {} - No special environment variables required
   */
  eslint: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@eslint/mcp@latest'],
    env: {}
  } as McpServerConfig
};
