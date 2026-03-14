---
description: Create a detailed implementation plan before writing code. Use this skill whenever the user has a spec, requirements, feature request, or multi-step task and wants to plan the approach before jumping into code. Trigger on phrases like 'plan this out', 'write a plan', 'implementation plan', 'break this down into tasks', 'how should we implement', 'let me think through the implementation', '/plan', or any time the user shares requirements/specs and the next step is clearly to figure out how to build it — not to start building it. Also trigger when the user says things like 'I have a spec' or 'here are the requirements' and hasn't asked to start coding yet.
user-invocable: true
disable-model-invocation: false
---

# Write Plan

Create a detailed, step-by-step implementation plan for the user's task. Plans should be thorough enough that each step is unambiguous, but not so rigid that they can't adapt to what the engineer discovers along the way.

## Announce

When this skill is invoked, immediately tell the user which skill is running and what it will do — before any other work begins.

> Daemon `write:plan` online. Breaking down the work.

## Composability

This skill supports two execution modes:

- **Interactive** (default) — the user invoked the skill directly. Wrap execution with `EnterPlanMode` / `ExitPlanMode` to present output for approval.
- **Non-interactive** — the calling prompt includes framing like "plan and execute autonomously", "return a plan", or comes from an orchestrator/subagent dispatch. Skip plan mode tools and output directly.

## Output

Write the plan to the project's `.claude/plans/` directory using a whimsical two-word `<adjective>-<noun>.md` pattern (e.g., `sleepy-axolotl.md`, `cosmic-teapot.md`).

## Steps

### 1. Research

Don't plan blind. Before writing any tasks, build a working understanding of the relevant parts of the codebase. This isn't optional — a plan written without research will miss conventions, duplicate existing abstractions, and create integration pain.

#### Understand the requirements
Read the spec or requirements carefully. Identify every functional requirement, constraint, and acceptance criterion. If anything is ambiguous, ask the user before proceeding.

#### Understand the project
- Read CLAUDE.md, README, and the project manifest (package.json, pyproject.toml, Cargo.toml, etc.) to understand the stack, conventions, and any project-specific rules.
- Scan the directory structure to understand how the codebase is organized — where things live, what the naming conventions are.

#### Explore the relevant code
- Use Explore agents or targeted Glob/Grep to find the files and modules related to the spec. Don't just guess where things are — look.
- Read the actual files where new code will integrate with existing code. Understand the interfaces, data flow, and patterns already in use.
- Look for existing abstractions that the new code should reuse rather than duplicate.

#### Understand the quality toolchain
- Find the test directory and read a few representative test files to learn the framework, style, assertion patterns, and level of coverage.
- Check for test configuration (jest.config, pytest.ini, etc.) and any test utilities or fixtures the project provides.
- If the project has no tests, note that — it affects the testing strategy in the plan.
- **Discover all quality checks the project uses beyond tests.** Look for linter configs (`.eslintrc`, `ruff.toml`, `.flake8`, `.golangci.yml`), formatters (`prettier`, `black`, `rustfmt`), type checkers (`tsconfig.json` strict mode, `mypy.ini`, `pyright`), and any other static analysis tools. Check the project manifest for lint/format scripts (e.g., `"lint": "eslint ."` in package.json, or a `[tool.ruff]` section in pyproject.toml). Also check for pre-commit hooks (`.pre-commit-config.yaml`, `.husky/`) or CI config (`.github/workflows/`) that reveal which checks run on every push.
- Record what you find — the exact commands to run each check — because verification steps in the plan need to use them.

#### Write research notes
Capture your findings in the **Research Notes** section of the plan document. This gives the implementer the same context you had when you wrote the plan — relevant files, patterns observed, key interfaces, testing conventions. Keep it concise but specific (file paths, function names, patterns by example).

Also track any **gaps and assumptions** found during research — ambiguous requirements, missing context, or places where you had to make a judgment call. These feed directly into the summary's "Risks / open questions" section so the user can address them before implementation starts.

### 2. Scope check

If the spec covers multiple independent subsystems, suggest breaking it into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

### 3. Write the Plan

Produce the plan using the template in `TEMPLATE.md`.

#### Task granularity

Each step should be a single, concrete action — something that takes a few minutes and has a clear "done" state.

Good steps:
- "Write the failing test for X"
- "Run the test suite to confirm it fails"
- "Implement the minimal code to make the test pass"
- "Run tests and confirm they pass"
- "Commit"

Bad steps:
- "Add validation" (vague — what validation? where? what are the rules?)
- "Set up the module" (too broad — what files? what interfaces?)

The right granularity depends on the task's complexity. Simple CRUD operations don't need the same level of hand-holding as a tricky algorithmic change. Use your judgment, but err toward more detail when in doubt.

#### Testing strategy

Adapt the testing approach to what makes sense for the task and the project:

**Test-first (TDD)** — Use when:
- The behavior is well-defined upfront (clear inputs → expected outputs)
- You're building business logic, data transformations, or algorithms
- The project already practices TDD

**Test-after** — Use when:
- The task is exploratory or the interface isn't settled yet
- You're doing UI work, integrations, or prototyping
- Writing the test first would require mocking everything and test nothing real

**No automated tests** — Use when:
- The task is pure configuration, documentation, or static assets
- The project has no test infrastructure and adding it isn't in scope

Whatever the approach, always include a verification step — even if it's "run the app and confirm X works manually." Every task should have a way to know it's done correctly.

#### Verification beyond tests

Tests are only one part of verification. Each work unit's verification step should run **every relevant quality check the project has**, not just the test suite. During research you discovered the project's quality toolchain — now use it. A good verification step for a TypeScript project might look like:

- [ ] Verify: `npm run lint` passes with no new warnings
- [ ] Verify: `npm run typecheck` (or `npx tsc --noEmit`) passes with no errors
- [ ] Verify: `npm run format:check` (or `npx prettier --check .`) reports no unformatted files
- [ ] Verify: `npm test` passes

For a Python project it might be `ruff check .`, `mypy .`, `black --check .`, `pytest`. For Go: `golangci-lint run`, `go vet`, `go test ./...`. Adapt to whatever the project actually uses.

The point is: if the project has a linter, the plan should run it. If it has a formatter, the plan should check formatting. If it has type checking, the plan should verify types. Don't just default to "run tests" when there are other checks that could catch issues earlier. Think of it this way — if the implementer follows your plan and opens a PR, what checks will CI run? The plan's verification steps should catch the same things locally so there are no surprises.

#### Key rules
- **Exact file paths** — always. No "in the appropriate directory."
- **Complete code** — if a step involves writing code, include the code. Not "add error handling" but the actual error handling code.
- **Exact commands with expected output** — so the engineer can verify without guessing.
- **Checkbox syntax** (`- [ ]`) on every step for progress tracking.
- **DRY, YAGNI** — don't plan features that aren't in the spec. Don't duplicate logic across tasks.
- **Frequent commits** — each task ends with a commit. Working software at every checkpoint.

### 4. Review

After completing each chunk of the plan, dispatch a reviewer subagent if subagents are available:

1. Spawn a general-purpose subagent with the reviewer prompt (see `agents/reviewer.md`)
   - Provide: the chunk content and the path to the spec/requirements
2. If issues found: fix them, re-dispatch the reviewer, repeat until approved
3. If approved: proceed to next chunk

**Chunk boundaries:** Use `## Chunk N: <name>` headings. Each chunk should be under 1000 lines and logically self-contained.

If subagents aren't available, do a self-review pass checking for: TODOs/placeholders, incomplete steps, missing verification, spec gaps, and files with unclear responsibilities.

If the review loop exceeds 3 iterations on the same chunk, surface it to the user for guidance rather than spinning.

### 5. Save

Write the plan to a file per the [output](#output) convention. After saving, tell the user where it landed and give a brief overview:

**"Plan saved to `.claude/plans/<codename>.md`."**

Then output a summary using this exact template:

```
**Approach:** <1-2 sentences on the high-level strategy>

**Decisions:**
- <decision and why — one line each, skip if none>

**Questions:**
- <ambiguity, missing context, or assumption that needs user input — one line each, or "None" if fully resolved>

**Scope:** <N tasks, ~M files touched>
```

This lets the user quickly assess the direction without opening the file. Keep each section punchy — details live in the plan.

Keep plans concise and actionable. Don't over-plan — just enough to say "yes, do that" or to dispatch work units to subagents.
