# Memory workflow

This repository is a second brain for coding agents. Store memories as Open
Knowledge Format (OKF) concepts under `brain/`.

## When to write

Write or change a memory only after the user explicitly asks you to do so. Do
not create a routine task summary unless the user asks for a memory.

## Safety

- Never store secrets, credentials, tokens, private keys, or session data.
- Never store personal data unless the user explicitly approves that exact data.
- Do not claim human verification. Add `verified` with a `human:` actor only
  after that person explicitly confirms the concept.
- Use the actual agent and version for `generated.by` when you know them. Omit
  `generated` when you do not know the correct identity.

## Write a memory

1. Read `brain/index.md` and search the bundle for related terms.
2. Update an existing concept when it describes the same knowledge.
3. Otherwise, create a UTF-8 Markdown concept with YAML frontmatter.
4. Add a non-empty `type`. Add a clear `title` and `description` when possible.
5. Link related concepts with normal Markdown links.
6. Add `sources` when the memory depends on another artifact.
7. Run `okf index brain`.
8. Run `okf check brain`.
9. Fix every finding before you commit.
10. Commit only the memory files and generated indexes in one focused commit.
11. Never push the commit.

The example folders and types are not a fixed taxonomy. Add a folder or type
when it makes the knowledge easier to find.

## Minimal concept

```markdown
---
type: Decision
title: Use deterministic checks
description: The project checks memory structure before each commit.
status: stable
---

# Decision

Run the repository checks before each memory commit.
```

Read [SPEC.md](reference/SPEC.md) for the complete OKF v0.2 rules.
