#!/usr/bin/env bun

/**
 * Build script for the arasaka action.
 * Bundles the entrypoint and MCP servers for the orphan v1 branch.
 *
 * Output layout matches the published v1 branch:
 *   dist/arasaka/<raw action files>
 *   dist/.github/workflows/{develop,queue,review}.yml
 */

import { $ } from "bun";
import { cp, mkdir, copyFile, readFile, writeFile } from "fs/promises";

const DIST = "./dist";
const DIST_ARASAKA = `${DIST}/arasaka`;
const UPSTREAM_MCP = "./upstream/src/mcp";
const UPSTREAM_ENTRYPOINTS = "./upstream/src/entrypoints";
const UPSTREAM_SCRIPTS = "./upstream/scripts";

// 1. Clean and create output directories
await $`rm -rf ${DIST}`;
await mkdir(`${DIST_ARASAKA}/src/mcp`, { recursive: true });
await mkdir(`${DIST_ARASAKA}/src/entrypoints`, { recursive: true });
await mkdir(`${DIST_ARASAKA}/scripts`, { recursive: true });
await mkdir(`${DIST}/.github/workflows`, { recursive: true });

// 2. Bundle main entrypoint
console.log("Bundling main entrypoint...");
const mainResult = await Bun.build({
  entrypoints: ["./src/entrypoints/run.ts"],
  outdir: DIST_ARASAKA,
  target: "bun",
  loader: { ".md": "text" },
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
    outdir: `${DIST_ARASAKA}/src/mcp`,
    target: "bun",
  });
  if (!result.success) {
    console.error(`MCP server build failed for ${server}:`, result.logs);
    process.exit(1);
  }
  // Rename .js to .ts so prepareMcpConfig paths resolve correctly
  const jsName = server.replace(".ts", ".js");
  await $`mv ${DIST_ARASAKA}/src/mcp/${jsName} ${DIST_ARASAKA}/src/mcp/${server}`;
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
    outdir: `${DIST_ARASAKA}/src/entrypoints`,
    target: "bun",
  });
  if (!result.success) {
    console.error(`Entrypoint build failed for ${entry}:`, result.logs);
    process.exit(1);
  }
  // Rename .js to .ts for path compatibility
  const jsName = entry.replace(".ts", ".js");
  await $`mv ${DIST_ARASAKA}/src/entrypoints/${jsName} ${DIST_ARASAKA}/src/entrypoints/${entry}`;
}

// 5. Copy scripts
console.log("Copying scripts...");
await copyFile(
  `${UPSTREAM_SCRIPTS}/git-push.sh`,
  `${DIST_ARASAKA}/scripts/git-push.sh`,
);
await copyFile(
  "./scripts/write_preset.py",
  `${DIST_ARASAKA}/scripts/write_preset.py`,
);
await $`chmod +x ${DIST_ARASAKA}/scripts/git-push.sh`;

// 6. Copy preset content consumed by write_preset.py at runtime
console.log("Copying preset content...");
await cp("./content", `${DIST_ARASAKA}/content`, { recursive: true });

// 7. Copy preset composite actions
console.log("Copying preset actions...");
await cp("./actions", `${DIST_ARASAKA}/actions`, { recursive: true });

// 8. Generate v1-specific action.yml with patched paths
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

await writeFile(`${DIST_ARASAKA}/action.yml`, actionYml);

// 9. Generate reusable workflow entrypoints for v1 consumers
console.log("Generating reusable workflows...");
const workflows = ["develop.yml", "queue.yml", "review.yml"];

for (const workflow of workflows) {
  let workflowYml = await readFile(`./workflows/${workflow}`, "utf-8");
  workflowYml = workflowYml
    .replace(/__ARASAKA_OWNER_REPO__/g, "mzpkdev/preemclaud")
    .replace(/__ARASAKA_REF__/g, "v1");
  await writeFile(`${DIST}/.github/workflows/${workflow}`, workflowYml);
}

// 10. Minimal package.json
await writeFile(`${DIST_ARASAKA}/package.json`, '{"private":true}\n');

console.log("Build complete. Output in dist/");
