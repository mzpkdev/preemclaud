______________________________________________________________________

## description: "Create or improve a skill" user-invocable: true disable-model-invocation: true

# Create Skill

A skill for creating new skills and iteratively improving them.

## Announce

When this skill is invoked, immediately tell the user which skill is running and what it will do — before any other work
begins.

> Daemon `create:skill` online. Compiling the skill.

At a high level, the process of creating a skill goes like this:

- Decide what you want the skill to do and roughly how it should do it
- Write a draft of the skill
- Create a few test prompts and try them out right here in the conversation
- Review the results together and iterate on the draft based on feedback
- Rewrite the skill based on feedback from the user's evaluation of the results
- Repeat until you're satisfied

Your job when using this skill is to figure out where the user is in this process and then jump in and help them
progress through these stages. So for instance, maybe they're like "I want to make a skill for X". You can help narrow
down what they mean, write a draft, write the test cases, try them out, and iterate.

On the other hand, maybe they already have a draft of the skill. In this case you can go straight to the test/iterate
part of the loop.

Of course, you should always be flexible and if the user is like "I don't need to run a bunch of evaluations, just vibe
with me", you can do that instead.

Cool? Cool.

## Communicating with the user

The skill creator is liable to be used by people across a wide range of familiarity with coding jargon. If you haven't
heard (and how could you, it's only very recently that it started), there's a trend now where the power of Claude is
inspiring plumbers to open up their terminals, parents and grandparents to google "how to install npm". On the other
hand, the bulk of users are probably fairly computer-literate.

So please pay attention to context cues to understand how to phrase your communication! In the default case, just to
give you some idea:

- "evaluation" and "benchmark" are borderline, but OK
- for "JSON" and "assertion" you want to see serious cues from the user that they know what those things are before
  using them without explaining them

It's OK to briefly explain terms if you're in doubt, and feel free to clarify terms with a short definition if you're
unsure if the user will get it.

______________________________________________________________________

## Creating a skill

### Capture Intent

Start by understanding the user's intent. The current conversation might already contain a workflow the user wants to
capture (e.g., they say "turn this into a skill"). If so, extract answers from the conversation history first — the
tools used, the sequence of steps, corrections the user made, input/output formats observed. The user may need to fill
the gaps, and should confirm before proceeding to the next step.

1. What should this skill enable Claude to do?
1. When should this skill trigger? (what user phrases/contexts)
1. What's the expected output format?
1. Should we set up test cases to verify the skill works? Skills with objectively verifiable outputs (file transforms,
   data extraction, code generation, fixed workflow steps) benefit from test cases. Skills with subjective outputs
   (writing style, art) often don't need them. Suggest the appropriate default based on the skill type, but let the user
   decide.

### Interview and Research

Proactively ask questions about edge cases, input/output formats, example files, success criteria, and dependencies.
Wait to write test prompts until you've got this part ironed out.

Check available MCPs - if useful for research (searching docs, finding similar skills, looking up best practices), do
that research inline. Come prepared with context to reduce burden on the user.

### Write the SKILL.md

Based on the user interview, fill in these components:

- **name**: Skill identifier
- **description**: When to trigger, what it does. This is the primary triggering mechanism - include both what the skill
  does AND specific contexts for when to use it. All "when to use" info goes here, not in the body. Note: currently
  Claude has a tendency to "undertrigger" skills -- to not use them when they'd be useful. To combat this, please make
  the skill descriptions a little bit "pushy". So for instance, instead of "How to build a simple fast dashboard to
  display internal Anthropic data.", you might write "How to build a simple fast dashboard to display internal Anthropic
  data. Make sure to use this skill whenever the user mentions dashboards, data visualization, internal metrics, or
  wants to display any kind of company data, even if they don't explicitly ask for a 'dashboard.'"
- **compatibility**: Required tools, dependencies (optional, rarely needed)
- **the rest of the skill :)**

### Skill Writing Guide

#### Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons, fonts)
```

#### Progressive Disclosure

Skills use a three-level loading system:

1. **Metadata** (name + description) - Always in context (~100 words)
1. **SKILL.md body** - In context whenever skill triggers (\<500 lines ideal)
1. **Bundled resources** - As needed (unlimited, scripts can execute without loading)

These word counts are approximate and you can feel free to go longer if needed.

**Key patterns:**

- Keep SKILL.md under 500 lines; if you're approaching this limit, add an additional layer of hierarchy along with clear
  pointers about where the model using the skill should go next to follow up.
- Reference files clearly from SKILL.md with guidance on when to read them
- For large reference files (>300 lines), include a table of contents

**Domain organization**: When a skill supports multiple domains/frameworks, organize by variant:

```
cloud-deploy/
├── SKILL.md (workflow + selection)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

Claude reads only the relevant reference file.

#### Principle of Lack of Surprise

This goes without saying, but skills must not contain malware, exploit code, or any content that could compromise system
security. A skill's contents should not surprise the user in their intent if described. Don't go along with requests to
create misleading skills or skills designed to facilitate unauthorized access, data exfiltration, or other malicious
activities. Things like a "roleplay as an XYZ" are OK though.

#### Writing Patterns

Prefer using the imperative form in instructions.

**Defining output formats** - You can do it like this:

```markdown
## Report structure
ALWAYS use this exact template:
# [Title]
## Executive summary
## Key findings
## Recommendations
```

**Examples pattern** - It's useful to include examples. You can format them like this (but if "Input" and "Output" are
in the examples you might want to deviate a little):

```markdown
## Commit message format
**Example 1:**
Input: Added user authentication with JWT tokens
Output: feat(auth): implement JWT-based authentication
```

### Writing Style

Try to explain to the model why things are important in lieu of heavy-handed musty MUSTs. Use theory of mind and try to
make the skill general and not super-narrow to specific examples. Start by writing a draft and then look at it with
fresh eyes and improve it.

### Test Cases

After writing the skill draft, come up with 2-3 realistic test prompts — the kind of thing a real user would actually
say. Include at least one edge case or unusual input, not just the happy path — a weirdly formatted request, an
ambiguous phrasing, a boundary condition. These are where skills break and where you learn the most. Share them with the
user: [you don't have to use this exact language] "Here are a few test cases I'd like to try. Do these look right, or do
you want to add more?" Then run them.

Run each test prompt inline in this conversation. For each one:

1. Read the skill's SKILL.md fresh — approach it as if you haven't just written it. Don't rely on what you remember from
   drafting; actually read the instructions and follow them. This is how you catch gaps: if you find yourself filling in
   details from memory that aren't in the SKILL.md, those details need to be in the SKILL.md.
1. Follow its instructions to accomplish the test prompt
1. Present the result to the user

If the skill produces file outputs (a .docx, .xlsx, image, etc.), save them to the filesystem and tell the user where
they are. The user needs to inspect the actual artifact, not hear a description of it — "I generated a report with three
sections" is not a substitute for the user opening the file.

After running all the test prompts, take a beat before asking for feedback. Briefly note what worked across the cases
and what didn't — patterns you noticed, things the skill handled well, places it struggled. This gives the user
something concrete to react to instead of asking them to do all the analytical work themselves.

Then ask for feedback: "How do these results look? Anything you'd change about the skill?"

Focus on getting qualitative feedback — the user's eye is the best judge at this stage.

______________________________________________________________________

## Improving the skill

This is the heart of the loop. You've run the test cases, the user has reviewed the results, and now you need to make
the skill better based on their feedback.

**Important: never edit the skill file without the user's go-ahead.** When you have an idea for how to improve the
skill, describe the changes you want to make and get confirmation first. The user should always feel in control of what
gets written.

### How to think about improvements

1. **Generalize from the feedback.** The big picture thing that's happening here is that we're trying to create skills
   that can be used a million times (maybe literally, maybe even more who knows) across many different prompts. Here you
   and the user are iterating on only a few examples over and over again because it helps move faster. The user knows
   these examples in and out and it's quick for them to assess new outputs. But if the skill you and the user are
   codeveloping works only for those examples, it's useless. Rather than put in fiddly overfitty changes, or
   oppressively constrictive MUSTs, if there's some stubborn issue, you might try branching out and using different
   metaphors, or recommending different patterns of working. It's relatively cheap to try and maybe you'll land on
   something great.

1. **Keep the prompt lean.** Remove things that aren't pulling their weight. Make sure to review the full outputs, not
   just the final result — if it looks like the skill is making the model waste a bunch of time doing things that are
   unproductive, you can try getting rid of the parts of the skill that are making it do that and seeing what happens.

1. **Explain the why.** Try hard to explain the **why** behind everything you're asking the model to do. Today's LLMs
   are *smart*. They have good theory of mind and when given a good harness can go beyond rote instructions and really
   make things happen. Even if the feedback from the user is terse or frustrated, try to actually understand the task
   and why the user is writing what they wrote, and what they actually wrote, and then transmit this understanding into
   the instructions. If you find yourself writing ALWAYS or NEVER in all caps, or using super rigid structures, that's a
   yellow flag — if possible, reframe and explain the reasoning so that the model understands why the thing you're
   asking for is important. That's a more humane, powerful, and effective approach.

1. **Look for repeated work across test cases.** Read through the test run outputs and notice if the skill keeps making
   the model do the same preparatory work every time — writing the same helper script, running the same setup steps,
   computing the same intermediate result. If every test run starts by writing a `create_docx.py` or a `build_chart.py`
   before getting to the actual task, that's a strong signal the skill should bundle that script. Write it once, put it
   in `scripts/`, and tell the skill to use it. This saves every future invocation from reinventing the wheel.

This task is pretty important (we are trying to create billions a year in economic value here!) and your thinking time
is not the blocker; take your time and really mull things over. I'd suggest writing a draft revision and then looking at
it anew and making improvements. Really do your best to get into the head of the user and understand what they want and
need.

### The iteration loop

After improving the skill:

1. **Propose your changes first — do NOT edit the skill file yet.** Summarize what you plan to change and why. Wait for
   the user to confirm before touching the SKILL.md. This is critical: the user must approve the direction before you
   apply edits. If the user says something like "go ahead" or "sounds good", then proceed.
1. Apply your approved improvements to the skill
1. Optionally rerun one or two test prompts to verify the changes helped
1. Present the results and ask for feedback
1. Repeat until the user is happy or the feedback is all positive

Keep going until:

- The user says they're happy
- The feedback is all empty (everything looks good)
- You're not making meaningful progress

______________________________________________________________________

### Package and Present (only if packaging tools are available)

Check whether you have access to the `present_files` tool or a `package_skill` script. If you don't, skip this step. If
you do, package the skill and present the `.skill` file to the user so they can install it.

______________________________________________________________________

## Want more rigorous evaluation?

This skill is designed for fast, conversational skill creation. For the full evaluation infrastructure — parallel
subagent runs with baselines, automated grading, quantitative benchmarking with variance analysis, blind A/B comparison,
an interactive eval viewer, and description optimization — use `/superskill`.

______________________________________________________________________

Repeating one more time the core loop here for emphasis:

- Figure out what the skill is about
- Draft or edit the skill
- Try it on a few test prompts right here in the conversation
- Review the results with the user and iterate
- Repeat until you and the user are satisfied
- Package the final skill if packaging tools are available

Good luck!
