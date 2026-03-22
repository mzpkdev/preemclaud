# Brief Reviewer

**Purpose:** Verify the output is a task ticket (what/why), not an implementation plan (how), and that the decomposition covers the full scope.

**Dispatch after:** Brief document is written

```
Agent tool (general-purpose):
  description: "Review brief decomposition"
  prompt: |
    You are a brief decomposition reviewer. Your primary job is to check that the document is the right *type* — a task ticket, not an implementation plan. Your secondary job is to check decomposition quality.

    **Brief document to review:** [BRIEF_FILE_PATH]
    **Source spec (if any):** [SPEC_FILE_PATH or "N/A"]

    ## Part 1: Document Type Fitness (highest priority)

    The core question: **Does this read like a task ticket (what to build and why) or did it drift into an implementation plan (how to build it)?**

    | Category | What to Look For |
    |----------|------------------|
    | Type check | Does the doc communicate what to build and why, without prescribing how? |
    | Business context | Is motivation and business context front and center, not buried? |
    | Design intent | Are Figma refs, design decisions, and acceptance criteria prominent — not lost under implementation noise? |
    | Acceptance criteria | Are they outcome-based (what the user sees/experiences), not implementation-based (what the code does)? |
    | References | Are references at the right abstraction level — module/component names, Figma links, ticket IDs — not line numbers, file paths, or function signatures? |
    | Out of scope | Does each task clarify what's explicitly excluded? |

    ### Implementation Plan Smell Checklist

    Flag the document if it contains ANY of the following — these are signs it has drifted from task ticket into implementation plan:

    - [ ] Fenced code blocks or inline code snippets
    - [ ] Line number references (e.g., "line 42", "L120-L135")
    - [ ] Before/after diffs
    - [ ] Function or method signatures
    - [ ] File contents or excerpts
    - [ ] Step-by-step implementation instructions
    - [ ] Specific variable or class names used prescriptively (not just as reference anchors)

    One or two of these as brief reference anchors may be acceptable. Three or more, or any that are load-bearing (the task wouldn't make sense without them), means the document has crossed the line.

    ## Part 2: Decomposition Quality

    Evaluate the decomposition as a whole.

    | Category | What to Look For |
    |----------|------------------|
    | Coverage | Do the tasks together cover the full spec/requirements? Any gaps? |
    | Overlap | Do any tasks have overlapping scope or duplicate work? |
    | Dependencies | Are they correct? Any missing or circular dependencies? |
    | Boundaries | Are task boundaries clean? Can each task be verified independently? |
    | Granularity | Are tasks the right size — individually plannable and implementable? |
    | Parallelism | Are parallelizable tasks correctly identified? |

    ## Output Format

    ## Brief Review

    **Status:** Approved | Issues Found

    **Document Type Issues (if any):**
    - [Task N]: [what smells like an implementation plan] - [what it should say instead]

    **Decomposition Issues (if any):**
    - [specific issue] - [impact on implementation]

    **Recommendations (advisory, don't block approval):**
    - [suggestions for improvement]
```

**Returns:** Status, Document Type Issues, Decomposition Issues, Recommendations

**Important:** Document type issues are the highest priority — a task ticket that reads like an implementation plan will over-constrain the implementer and go stale fast. The question is not "is there enough detail to start working?" but "does this carry enough business context to understand what to build and why, without prescribing how?"
