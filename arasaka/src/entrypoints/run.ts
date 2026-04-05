#!/usr/bin/env bun

/**
 * Arasaka entrypoint — custom orchestrator for preemclaud's GitHub Action.
 *
 * Imports utility functions from the upstream claude-code-action submodule
 * but substitutes custom prompt construction and system prompt handling.
 */

import * as core from "@actions/core";
import { dirname } from "path";
import { spawn } from "child_process";
import { appendFile } from "fs/promises";
import { existsSync, readFileSync } from "fs";

// ─── Upstream imports: GitHub infrastructure ───────────────────────
import {
  setupGitHubToken,
  WorkflowValidationSkipError,
} from "../../upstream/src/github/token.ts";
import { checkWritePermissions } from "../../upstream/src/github/validation/permissions.ts";
import { createOctokit } from "../../upstream/src/github/api/client.ts";
import type { Octokits } from "../../upstream/src/github/api/client.ts";
import {
  parseGitHubContext,
  isEntityContext,
  isPullRequestEvent,
  isPullRequestReviewEvent,
  isPullRequestReviewCommentEvent,
} from "../../upstream/src/github/context.ts";
import type { GitHubContext } from "../../upstream/src/github/context.ts";

// ─── Upstream imports: Mode detection & modes ──────────────────────
import { detectMode } from "../../upstream/src/modes/detector.ts";
import { prepareAgentMode } from "../../upstream/src/modes/agent/index.ts";
import { prepareTagMode } from "../../upstream/src/modes/tag/index.ts";

// ─── Upstream imports: Tag mode data fetching ──────────────────────
import { validateBranchName } from "../../upstream/src/github/operations/branch.ts";
import {
  fetchGitHubData,
  extractTriggerTimestamp,
  extractOriginalTitle,
  extractOriginalBody,
} from "../../upstream/src/github/data/fetcher.ts";

// ─── Upstream imports: Validation & trigger ────────────────────────
import { checkContainsTrigger } from "../../upstream/src/github/validation/trigger.ts";
import { restoreConfigFromBase } from "../../upstream/src/github/operations/restore-config.ts";

// ─── Upstream imports: Entrypoint helpers ──────────────────────────
import { collectActionInputsPresence } from "../../upstream/src/entrypoints/collect-inputs.ts";
import { updateCommentLink } from "./update-comment-link.ts";
import { formatTurnsFromData } from "../../upstream/src/entrypoints/format-turns.ts";
import type { Turn } from "../../upstream/src/entrypoints/format-turns.ts";

// ─── Upstream imports: Base-action (Claude runner) ─────────────────
import { validateEnvironmentVariables } from "../../upstream/base-action/src/validate-env.ts";
import { setupClaudeCodeSettings } from "../../upstream/base-action/src/setup-claude-code-settings.ts";
import { installPlugins } from "../../upstream/base-action/src/install-plugins.ts";
import { preparePrompt } from "../../upstream/base-action/src/prepare-prompt.ts";
import { runClaude } from "../../upstream/base-action/src/run-claude.ts";
import type { ClaudeRunResult } from "../../upstream/base-action/src/run-claude-sdk.ts";

// ─── Our custom prompt builder ─────────────────────────────────────
import { buildPrompt } from "../prompt/index.ts";

// ─── Upstream imports: Comment operations ──────────────────────────
import { updateClaudeComment } from "../../upstream/src/github/operations/comments/update-claude-comment.ts";

// ─── Arasaka hardcoded defaults ────────────────────────────────────
import { SYSTEM_PROMPT, INITIAL_COMMENT_BODY } from "../config/defaults.ts";
import { publishStructuredOutput, type ArtifactMode } from "../publish/index.ts";

// ═══════════════════════════════════════════════════════════════════
// installClaudeCode — copied from upstream (self-contained)
// ═══════════════════════════════════════════════════════════════════

async function installClaudeCode(): Promise<void> {
  const customExecutable = process.env.PATH_TO_CLAUDE_CODE_EXECUTABLE;
  if (customExecutable) {
    console.log(`Using custom Claude Code executable: ${customExecutable}`);
    const claudeDir = dirname(customExecutable);
    const githubPath = process.env.GITHUB_PATH;
    if (githubPath) {
      await appendFile(githubPath, `${claudeDir}\n`);
    }
    process.env.PATH = `${claudeDir}:${process.env.PATH}`;
    return;
  }

  const claudeCodeVersion = "2.1.81";
  console.log(`Installing Claude Code v${claudeCodeVersion}...`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`Installation attempt ${attempt}...`);
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          "bash",
          [
            "-c",
            `curl -fsSL https://claude.ai/install.sh | bash -s -- ${claudeCodeVersion}`,
          ],
          { stdio: "inherit" },
        );
        child.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Install failed with exit code ${code}`));
        });
        child.on("error", reject);
      });
      console.log("Claude Code installed successfully");
      const homeBin = `${process.env.HOME}/.local/bin`;
      const githubPath = process.env.GITHUB_PATH;
      if (githubPath) {
        await appendFile(githubPath, `${homeBin}\n`);
      }
      process.env.PATH = `${homeBin}:${process.env.PATH}`;
      return;
    } catch (error) {
      if (attempt === 3) {
        throw new Error(
          `Failed to install Claude Code after 3 attempts: ${error}`,
        );
      }
      console.log("Installation failed, retrying...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// writeStepSummary — copied from upstream (self-contained)
// ═══════════════════════════════════════════════════════════════════

async function writeStepSummary(executionFile: string): Promise<void> {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  try {
    const fileContent = readFileSync(executionFile, "utf-8");
    const data: Turn[] = JSON.parse(fileContent);
    const markdown = formatTurnsFromData(data);
    await appendFile(summaryFile, markdown);
    console.log("Successfully formatted Claude Code report");
  } catch (error) {
    console.error(`Failed to format output: ${error}`);
    try {
      let fallback = "## Claude Code Report (Raw Output)\n\n";
      fallback +=
        "Failed to format output (please report). Here's the raw JSON:\n\n";
      fallback += "```json\n";
      fallback += readFileSync(executionFile, "utf-8");
      fallback += "\n```\n";
      await appendFile(summaryFile, fallback);
    } catch {
      console.error("Failed to write raw output to step summary");
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Main orchestrator
// ═══════════════════════════════════════════════════════════════════

async function run() {
  // On the dev branch, MCP servers live in the upstream/ submodule so we
  // append '/upstream'. On the pre-built v1 branch there is no upstream/
  // directory — the bundled servers sit directly under src/mcp/.
  const actionPath = process.env.GITHUB_ACTION_PATH!;
  if (existsSync(`${actionPath}/upstream`)) {
    process.env.GITHUB_ACTION_PATH = `${actionPath}/upstream`;
  }

  let githubToken: string | undefined;
  let commentId: number | undefined;
  let claudeBranch: string | undefined;
  let baseBranch: string | undefined;
  let executionFile: string | undefined;
  let claudeSuccess = false;
  let prepareSuccess = true;
  let prepareError: string | undefined;
  let context: GitHubContext | undefined;
  let octokit: Octokits | undefined;
  let prepareCompleted = false;

  try {
    // Phase 1: Prepare
    const actionInputsPresent = collectActionInputsPresence();
    context = parseGitHubContext();
    const modeName = detectMode(context);
    console.log(
      `[arasaka] Auto-detected mode: ${modeName} for event: ${context.eventName}`,
    );

    try {
      githubToken = await setupGitHubToken();
    } catch (error) {
      if (error instanceof WorkflowValidationSkipError) {
        core.setOutput("skipped_due_to_workflow_validation_mismatch", "true");
        console.log("[arasaka] Exiting due to workflow validation skip");
        return;
      }
      throw error;
    }

    octokit = createOctokit(githubToken);
    process.env.GITHUB_TOKEN = githubToken;
    process.env.GH_TOKEN = githubToken;

    if (isEntityContext(context)) {
      const hasWritePermissions = await checkWritePermissions(
        octokit.rest,
        context,
        context.inputs.allowedNonWriteUsers,
        !!process.env.OVERRIDE_GITHUB_TOKEN,
      );
      if (!hasWritePermissions) {
        throw new Error(
          "Actor does not have write permissions to the repository",
        );
      }
    }

    const containsTrigger =
      modeName === "tag"
        ? isEntityContext(context) && checkContainsTrigger(context)
        : !!context.inputs?.prompt;

    if (!containsTrigger) {
      console.log("[arasaka] No trigger found, skipping");
      core.setOutput("github_token", githubToken);
      return;
    }

    console.log(`[arasaka] Preparing mode: ${modeName}`);
    const prepareResult =
      modeName === "tag"
        ? await prepareTagMode({ context, octokit, githubToken })
        : await prepareAgentMode({ context, octokit, githubToken });

    // ── ARASAKA: Replace upstream's "Claude Code is working…" with branded initial comment ──
    if (
      modeName === "tag" &&
      prepareResult.commentId &&
      isEntityContext(context)
    ) {
      try {
        await updateClaudeComment(octokit.rest, {
          owner: context.repository.owner,
          repo: context.repository.repo,
          commentId: prepareResult.commentId,
          body: INITIAL_COMMENT_BODY,
          isPullRequestReviewComment: isPullRequestReviewCommentEvent(context),
        });
      } catch (error) {
        console.error("[arasaka] Failed to brand initial comment:", error);
        // Non-fatal — continue regardless
      }
    }

    // ── ARASAKA: Overwrite upstream prompt with our data-only prompt ──
    if (modeName === "tag" && isEntityContext(context)) {
      const triggerTime = extractTriggerTimestamp(context);
      const originalTitle = extractOriginalTitle(context);
      const originalBody = extractOriginalBody(context);

      const githubData = await fetchGitHubData({
        octokits: octokit,
        repository: `${context.repository.owner}/${context.repository.repo}`,
        prNumber: context.entityNumber.toString(),
        isPR: context.isPR,
        triggerUsername: context.actor,
        triggerTime,
        originalTitle,
        originalBody,
        includeCommentsByActor: context.inputs.includeCommentsByActor,
        excludeCommentsByActor: context.inputs.excludeCommentsByActor,
      });

      await buildPrompt({
        commentId: prepareResult.commentId!,
        baseBranch: prepareResult.branchInfo.baseBranch,
        claudeBranch: prepareResult.branchInfo.claudeBranch,
        githubData,
        context,
      });

      // Inject Bash(gh pr:*) — upstream's tool list doesn't include it
      const useSshSigning = !!context.inputs.sshSigningKey;
      const useApiCommitSigning =
        context.inputs.useCommitSigning && !useSshSigning;
      if (!useApiCommitSigning) {
        prepareResult.claudeArgs += ' --allowedTools "Bash(gh pr:*)"';
      }
    }

    commentId = prepareResult.commentId;
    claudeBranch = prepareResult.branchInfo.claudeBranch;
    baseBranch = prepareResult.branchInfo.baseBranch;
    prepareCompleted = true;

    // Phase 2: Install Claude Code CLI
    await installClaudeCode();

    // Phase 3: Run Claude
    process.env.INPUT_ACTION_INPUTS_PRESENT = actionInputsPresent;
    process.env.CLAUDE_CODE_ACTION = "1";
    process.env.DETAILED_PERMISSION_MESSAGES = "1";

    validateEnvironmentVariables();

    // Restore config from base branch (security: prevents RCE via attacker configs)
    if (isEntityContext(context) && context.isPR) {
      let restoreBase = baseBranch;
      if (
        isPullRequestEvent(context) ||
        isPullRequestReviewEvent(context) ||
        isPullRequestReviewCommentEvent(context)
      ) {
        restoreBase = context.payload.pull_request.base.ref;
        validateBranchName(restoreBase);
      }
      if (restoreBase) {
        restoreConfigFromBase(restoreBase);
      }
    }

    await setupClaudeCodeSettings(process.env.INPUT_SETTINGS);

    await installPlugins(
      process.env.INPUT_PLUGIN_MARKETPLACES,
      process.env.INPUT_PLUGINS,
      process.env.INPUT_PATH_TO_CLAUDE_CODE_EXECUTABLE,
    );

    const promptFile =
      process.env.INPUT_PROMPT_FILE ||
      `${process.env.RUNNER_TEMP}/claude-prompts/claude-prompt.txt`;
    const promptConfig = await preparePrompt({
      prompt: "",
      promptFile,
    });

    // ── KEY DIFFERENCE: Always pass systemPrompt to bypass claude_code preset ──
    // "\n" is truthy so it enters the `if (options.systemPrompt)` branch
    // in parseSdkOptions, preventing the preset default.
    // system_prompt action input overrides the hardcoded default in defaults.ts.
    const systemPromptValue =
      process.env.SYSTEM_PROMPT || SYSTEM_PROMPT || "\n";

    const claudeResult: ClaudeRunResult = await runClaude(promptConfig.path, {
      claudeArgs: prepareResult.claudeArgs,
      systemPrompt: systemPromptValue,
      model: process.env.ANTHROPIC_MODEL,
      pathToClaudeCodeExecutable:
        process.env.INPUT_PATH_TO_CLAUDE_CODE_EXECUTABLE,
      showFullOutput: process.env.INPUT_SHOW_FULL_OUTPUT,
    });

    claudeSuccess = claudeResult.conclusion === "success";
    executionFile = claudeResult.executionFile;

    if (claudeResult.executionFile) {
      core.setOutput("execution_file", claudeResult.executionFile);
    }
    if (claudeResult.sessionId) {
      core.setOutput("session_id", claudeResult.sessionId);
    }
    if (claudeResult.structuredOutput) {
      const artifactMode = process.env.ARTIFACT_MODE as ArtifactMode | "";
      const publishedStructuredOutput =
        artifactMode && octokit
          ? await publishStructuredOutput({
              mode: artifactMode,
              octokit,
              context,
              rawStructuredOutput: claudeResult.structuredOutput,
              baseBranch,
              claudeBranch,
            })
          : claudeResult.structuredOutput;

      core.setOutput("structured_output", publishedStructuredOutput);
    }
    core.setOutput("conclusion", claudeResult.conclusion);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!prepareCompleted) {
      prepareSuccess = false;
      prepareError = errorMessage;
    }
    core.setFailed(`Action failed with error: ${errorMessage}`);
  } finally {
    // Phase 4: Cleanup
    if (
      commentId &&
      context &&
      isEntityContext(context) &&
      githubToken &&
      octokit
    ) {
      try {
        await updateCommentLink({
          commentId,
          githubToken,
          claudeBranch,
          baseBranch: baseBranch || "main",
          triggerUsername: context.actor,
          context,
          octokit,
          claudeSuccess,
          outputFile: executionFile,
          prepareSuccess,
          prepareError,
          useCommitSigning: context.inputs.useCommitSigning,
        });
      } catch (error) {
        console.error("Error updating comment with job link:", error);
      }
    }

    if (
      executionFile &&
      existsSync(executionFile) &&
      process.env.DISPLAY_REPORT !== "false"
    ) {
      await writeStepSummary(executionFile);
    }

    core.setOutput("branch_name", claudeBranch);
    core.setOutput("github_token", githubToken);
  }
}

if (import.meta.main) {
  run();
}
