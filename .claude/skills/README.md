Claude Skills
This directory contains Claude Skills - reusable domain expertise that agents can invoke.
What Are Skills?
Skills are markdown files that provide Claude with specialized knowledge for specific tasks. They're loaded automatically by the Claude Agent SDK when agents invoke them.
Provided Example
javascript-best-practices/ - Complete example skill for JavaScript code review
Review this to understand the skill format
See how it provides best practices, common pitfalls, and output format
Your Task
Create 3 additional skills (minimum 2 required):
Required Skills
typescript-patterns/ - TypeScript-specific analysis
Type safety best practices
Advanced TypeScript patterns
Common type issues
security-analysis/ - Security-focused code review
OWASP Top 10 vulnerabilities
Secure coding practices
Common security mistakes
Optional Skills (Choose 1+)
python-code-review/ - Python idioms and patterns
performance-optimization/ - Performance analysis
accessibility/ - Web accessibility (for frontend code)
Your custom skill - Any domain expertise you want to add
Skill File Structure
Each skill must be in its own folder with a `SKILL.md` file:
```
.claude/skills/
├── javascript-best-practices/
│   └── SKILL.md               ✅ Provided example
├── typescript-patterns/
│   └── SKILL.md               TODO: Create
├── security-analysis/
│   └── SKILL.md               TODO: Create
└── python-code-review/
    └── SKILL.md               TODO: Create
```
SKILL.md Format
```markdown
---
description: Brief description of what this skill provides
---

# Skill Name

Brief introduction

## Section 1: Topic Area

Content, guidelines, examples

## Section 2: Another Topic

More content

## Output:

What format/guidance the skill should return
```
How Agents Invoke Skills
In your agent prompts, use:
```
For .ts files: invoke Skill "typescript-patterns"
```
The Claude Agent SDK will:
Load the SKILL.md file
Inject its content into the agent's context
Agent uses the knowledge to provide expert analysis
Tips for Writing Skills
✅ DO:
Be specific and actionable
Include code examples
Organize by category
Provide severity guidelines
Show good vs bad patterns
❌ DON'T:
Make it too long (keep under 500 lines)
Include full tutorials (just key points)
Duplicate general knowledge Claude already has
Use generic advice (be domain-specific)
Example: Invoking a Skill
In `code-quality-analyzer` prompt:
```typescript
## Process:
1. Read the code file with Read tool
2. Invoke Skills based on file type:
   - .ts/.tsx files: invoke Skill "typescript-patterns"
   - .js/.jsx files: invoke Skill "javascript-best-practices"
   - .py files: invoke Skill "python-code-review"
   - ALL files: invoke Skill "security-analysis"
3. Analyze using the skill's guidance
4. Return structured feedback
```
Resources
Claude Agent SDK Skills Documentation
Example: See `javascript-best-practices/SKILL.md` in this directory
