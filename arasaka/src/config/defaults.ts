/**
 * Hardcoded defaults for Arasaka — not exposed as action inputs.
 * Prompt and comment assets live in arasaka/content/ as .md files (single source of truth).
 * This file loads them and assembles the exported constants.
 */

import personaMd from "../../content/prompt/persona.md";
import formatMd from "../../content/prompt/format.md";
import instructionsMd from "../../content/prompt/instructions.md";
import initialCommentMd from "../../content/comments/states/initial.md";
import commentTemplateMd from "../../content/comments/templates/comment.md";
import headerSuccessMd from "../../content/comments/templates/header-success.md";
import headerFailureMd from "../../content/comments/templates/header-failure.md";

const ASSET_BASE =
  "https://raw.githubusercontent.com/mzpkdev/preemclaud/main/arasaka/assets";

// ─── Initial comment ───────────────────────────────────────────────────────────
// Posted immediately when the action starts, before Claude has any output.
// Replaces upstream's "Claude Code is working…" text.
export const INITIAL_COMMENT_BODY = initialCommentMd.replace(
  /\{\{ASSET_BASE\}\}/g,
  ASSET_BASE,
);

// ─── Persona ──────────────────────────────────────────────────────────────────
// Tonal preamble prepended to the system prompt. Kept separate for easy tweaking
// without touching the operational instructions below.
export const PERSONA = personaMd;

// ─── Response format ──────────────────────────────────────────────────────────
// Controls document structure. Kept separate from PERSONA (voice) and the
// operational instructions below so each concern can be edited independently.
export const RESPONSE_FORMAT = formatMd;

// ─── System prompt ─────────────────────────────────────────────────────────────
// Sourced from upstream anthropics/claude-code-action behavioral instructions.
// The human-turn prompt file already provides structured GitHub context
// (<github_context>, <tooling>, <trigger_comment>, etc.) — this is the behavioral layer only.
// PERSONA and RESPONSE_FORMAT are prepended for tonal and structural consistency.
export const SYSTEM_PROMPT = `${PERSONA}\n${RESPONSE_FORMAT}\n${instructionsMd}`;

// ─── Header templates ──────────────────────────────────────────────────────────
// Control the {header} line prepended to the comment after execution.
//
// Available variables:
//   {username}  — GitHub login of the user who triggered the action
//   {duration}  — wall-clock time, e.g. "2m 30s" or "45s" (empty if unavailable)
//   {cost}      — API cost, e.g. "$0.42" (empty if unavailable)
//   {job_url}   — GitHub Actions job URL
//   {branch}    — claude branch name (empty if not set)
export const HEADER_TEMPLATE = headerSuccessMd.trim();
export const HEADER_ERROR_TEMPLATE = headerFailureMd.trim();

// ─── Comment template ──────────────────────────────────────────────────────────
// Controls the full post-execution comment format.
//
// Available variables:
//   {header}    — built from HEADER_TEMPLATE / HEADER_ERROR_TEMPLATE above
//   {links}     — e.g. " —— [View job](url) • [`branch`](url) • [Create PR ➔](url)"
//   {content}   — Claude's comment body (spinner removed, stale links stripped)
//   {error}     — error details code block (non-empty only on failure with details)
//   {duration}  — wall-clock time, e.g. "2m 30s" (empty if unavailable)
//   {cost}      — API cost, e.g. "$0.42" (empty if unavailable)
//   {username}  — GitHub login of the user who triggered the action
//   {job_url}   — GitHub Actions job URL
//   {branch}    — claude branch name (empty if not set)
//   {reply_asset} — "issue-reply.svg" or "error-reply.svg" (set by comment-logic)
export const COMMENT_TEMPLATE = commentTemplateMd.replace(
  /\{\{ASSET_BASE\}\}/g,
  ASSET_BASE,
);

// ─── Closing lines ────────────────────────────────────────────────────────────
// Canonical sign-off pool used by the render layer. Derived from the persona
// examples, but kept as structured data so templates do not depend on parsing
// prompt prose.
export const CLOSING_LINES = [
  "Your future is our property.",
  "The family remembers.",
  "Your record reflects your loyalty.",
  "We are patient. We have time.",
  "The family is grateful for your contribution.",
  "Continuity is the highest form of loyalty.",
  "What you build here does not disappear.",
] as const;
