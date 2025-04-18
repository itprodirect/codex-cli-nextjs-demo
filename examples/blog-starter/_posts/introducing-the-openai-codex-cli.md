---
title: "Introducing the OpenAI Codex CLI"
excerpt: "An introduction to the new OpenAI Codex CLI, summarizing Overview, Key Features, Approval Modes, and Quick Start."
coverImage: "/assets/blog/preview/cover.jpg"
date: "2025-04-17T00:00:00.000Z"
author:
  name: "OpenAI Team"
  picture: "/assets/blog/authors/joe.jpeg"
ogImage:
  url: "/assets/blog/preview/cover.jpg"
---

<div class="text-center mb-8">
  <img src="https://upload.wikimedia.org/wikipedia/commons/4/4a/OpenAI_Logo.svg" alt="OpenAI Logo" class="inline-block w-32 h-auto mb-4" />
</div>

Embark on a new era of developer productivity with the OpenAI Codex CLI, a powerful command-line tool designed to streamline code generation, testing, and deployment through natural language prompts.

## Overview

The OpenAI Codex CLI brings the power of OpenAI’s Codex models directly to your terminal. By leveraging natural language, developers can generate code snippets, refactor existing code, and automate common tasks without leaving the command line.

## Key Features

- **Natural Language Prompts**: Describe the code you need, and Codex CLI produces syntax-correct, ready-to-use snippets.
- **Multi-Language Support**: Generate code in Python, JavaScript, Go, Ruby, and more.
- **Context-Aware Refactoring**: Provide existing files or directories; Codex CLI can improve, optimize, and document your code.
- **Interactive REPL**: Test small code fragments and iterate quickly within an interactive shell.
- **Extensions & Plugins**: Customize workflows by writing plugins for code linting, formatting, and CI/CD integration.

## Approval Modes

Codex CLI ensures compliance and safety with configurable approval modes:

1. **Manual Approvals**: Preview generated changes and accept or reject modifications.
2. **Automated Policies**: Enforce custom rules (e.g., license headers, security policies) before code is applied.
3. **Trusted Workflows**: Grant elevated permissions to specific commands or teammates to bypass reviews when safe.

## Quick Start Instructions

1. **Install the CLI**  
```bash
npm install -g @openai/codex-cli
```  
2. **Authenticate**  
```bash
codex auth login
```  
Follow the interactive prompt to log in with your OpenAI account.  
3. **Generate Code**  
```bash
codex generate "Create a function that reverses a string in JavaScript"
```  
4. **Refactor Code**  
```bash
codex refactor src/utils.js --describe "Improve performance and add JSDoc comments"
```  
5. **Run Interactive REPL**  
```bash
codex repl
```  
Type natural language instructions to experiment with code snippets in real time.

Dive deeper into the [official Codex CLI documentation](https://beta.openai.com/docs/tools/codex-cli) for advanced usage and best practices.