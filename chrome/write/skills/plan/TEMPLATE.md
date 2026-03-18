# <Plan Title>
> Codename: **<adjective-noun>** | From: **<spec/brief-codename or "prompt">**

  <N> work units · ~<N> files
  ──────────────────────────────────────────────────────────────────

<Summary — what this builds, approach, and architecture. 2-5 sentences scaled to complexity. For simple plans, one sentence suffices. For complex plans with multiple layers or services, expand to cover the key architectural decisions.>

<Optional bullet list of caveats — anything non-obvious the executor should watch for. Omit if none.>

  ──────────────────────────────────────────────────────────────────

<Work unit index — one line per unit with dependency arrows and file counts>

1  <Name>                                      <N> files
2  <Name>                                ← #1  <N> files
3  <Name>                            ← #1, #2  <N> files

  ──────────────────────────────────────────────────────────────────

1  <Name>
     C   <exact/path/to/new-file.ext>
     M   <exact/path/to/existing-file.ext>

     [ ] <step>
     [ ] <step>

     Verify: <exact commands or manual check>

2  <Name>  ← #1
     M   <exact/path/to/file.ext>

     [ ] <step>
     [ ] <step>

     Verify: <exact commands or manual check>
