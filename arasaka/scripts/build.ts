#!/usr/bin/env bun

/**
 * Build script for the arasaka action.
 * Bundles the entrypoint and MCP servers for the orphan v1 branch.
 *
 * Output layout matches what prepareMcpConfig() expects:
 *   dist/src/mcp/<server>.ts  (bundled JS, named .ts for path compat)
 *   dist/src/entrypoints/<entry>.ts
 *   dist/scripts/git-push.sh
 *   dist/run.js               (main entrypoint)
 */

import { $ } from "bun";
import { mkdir, copyFile, readFile, writeFile } from "fs/promises";

const DIST = "./dist";
const UPSTREAM_MCP = "./upstream/src/mcp";
const UPSTREAM_ENTRYPOINTS = "./upstream/src/entrypoints";
const UPSTREAM_SCRIPTS = "./upstream/scripts";

// 1. Clean and create output directories
await $`rm -rf ${DIST}`;
await mkdir(`${DIST}/src/mcp`, { recursive: true });
await mkdir(`${DIST}/src/entrypoints`, { recursive: true });
await mkdir(`${DIST}/scripts`, { recursive: true });

// 2. Bundle main entrypoint
console.log("Bundling main entrypoint...");
const mainResult = await Bun.build({
  entrypoints: ["./src/entrypoints/run.ts"],
  outdir: DIST,
  target: "bun",
});
if (!mainResult.success) {
  console.error("Main entrypoint build failed:", mainResult.logs);
  process.exit(1);
}

// 3. Bundle each MCP server separately (spawned as child processes)
const mcpServers = [
  "github-comment-server.ts",
  "github-file-ops-server.ts",
  "github-inline-comment-server.ts",
  "github-actions-server.ts",
];

for (const server of mcpServers) {
  console.log(`Bundling MCP server: ${server}...`);
  const result = await Bun.build({
    entrypoints: [`${UPSTREAM_MCP}/${server}`],
    outdir: `${DIST}/src/mcp`,
    target: "bun",
  });
  if (!result.success) {
    console.error(`MCP server build failed for ${server}:`, result.logs);
    process.exit(1);
  }
  // Rename .js to .ts so prepareMcpConfig paths resolve correctly
  const jsName = server.replace(".ts", ".js");
  await $`mv ${DIST}/src/mcp/${jsName} ${DIST}/src/mcp/${server}`;
}

// 4. Bundle cleanup and post-buffered-inline-comments entrypoints
const extraEntrypoints = [
  "cleanup-ssh-signing.ts",
  "post-buffered-inline-comments.ts",
];

for (const entry of extraEntrypoints) {
  console.log(`Bundling entrypoint: ${entry}...`);
  const result = await Bun.build({
    entrypoints: [`${UPSTREAM_ENTRYPOINTS}/${entry}`],
    outdir: `${DIST}/src/entrypoints`,
    target: "bun",
  });
  if (!result.success) {
    console.error(`Entrypoint build failed for ${entry}:`, result.logs);
    process.exit(1);
  }
  // Rename .js to .ts for path compatibility
  const jsName = entry.replace(".ts", ".js");
  await $`mv ${DIST}/src/entrypoints/${jsName} ${DIST}/src/entrypoints/${entry}`;
}

// 5. Copy scripts
console.log("Copying scripts...");
await copyFile(
  `${UPSTREAM_SCRIPTS}/git-push.sh`,
  `${DIST}/scripts/git-push.sh`,
);
await $`chmod +x ${DIST}/scripts/git-push.sh`;

// 6. Generate v1-specific action.yml with patched paths
console.log("Generating v1 action.yml...");
let actionYml = await readFile("./action.yml", "utf-8");

// Patch entrypoint path (v1 branch root IS the dist/ dir, so no dist/ prefix)
actionYml = actionYml.replace(
  "bun run ${GITHUB_ACTION_PATH}/src/entrypoints/run.ts",
  "bun run ${GITHUB_ACTION_PATH}/run.js",
);
// Patch cleanup paths (v1 branch root IS the dist/ dir)
actionYml = actionYml.replace(
  "bun run ${GITHUB_ACTION_PATH}/upstream/src/entrypoints/cleanup-ssh-signing.ts",
  "bun run ${GITHUB_ACTION_PATH}/src/entrypoints/cleanup-ssh-signing.ts",
);
actionYml = actionYml.replace(
  "bun run ${GITHUB_ACTION_PATH}/upstream/src/entrypoints/post-buffered-inline-comments.ts",
  "bun run ${GITHUB_ACTION_PATH}/src/entrypoints/post-buffered-inline-comments.ts",
);
// Remove the bun install step for v1 (everything is pre-bundled, package.json has no deps)
actionYml = actionYml.replace(
  /    - name: Install Dependencies\n.*\n.*\n.*\n.*bun install --production\n/,
  "",
);

await writeFile(`${DIST}/action.yml`, actionYml);

// 7. Minimal package.json
await writeFile(`${DIST}/package.json`, '{"private":true}\n');

console.log("Build complete. Output in dist/");
