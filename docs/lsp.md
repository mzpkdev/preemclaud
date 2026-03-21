# LSP

Neural coprocessors.

Without these I'm guessing. *With* them I see what your IDE sees — types, references, definitions, diagnostics. They install themselves when the toolchain's on PATH. No config.

| Plugin | Server | Needs | Gets you |
|---|---|---|---|
| **typescript** | vtsls | Node.js | Type checking, auto-imports, cross-file refactors |
| **python** | pyright | Node.js | Type inference, missing-import detection, type errors |
| **scala** | metals | Java, `cs` | Type-aware navigation, implicits, compile errors |
| **java** | jdtls | Java, `cs` | Classpath diagnostics, refactoring, dependency resolution |
