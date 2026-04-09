#!/usr/bin/env bun
// @bun

// upstream/src/github/operations/git-config.ts
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

// upstream/src/github/api/config.ts
var GITHUB_API_URL = process.env.GITHUB_API_URL || "https://api.github.com";
var GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL || "https://github.com";

// upstream/src/github/operations/git-config.ts
var SSH_SIGNING_KEY_PATH = join(homedir(), ".ssh", "claude_signing_key");
async function cleanupSshSigning() {
  try {
    await rm(SSH_SIGNING_KEY_PATH, { force: true });
    console.log("\u2713 SSH signing key cleaned up");
  } catch (error) {
    console.log("No SSH signing key to clean up");
  }
}

// upstream/src/entrypoints/cleanup-ssh-signing.ts
async function run() {
  try {
    await cleanupSshSigning();
  } catch (error) {
    console.error("Failed to cleanup SSH signing key:", error);
  }
}
if (import.meta.main) {
  run();
}
