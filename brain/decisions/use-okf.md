---
type: Decision
title: Use OKF for agent memories
description: Store agent memories as linked Markdown concepts with YAML frontmatter.
tags: [decision, memory, okf]
status: stable
generated: {by: 'cursor-agent/claude-sonnet-5', at: '2026-09-02T15:24:00+03:00'}
sources:
  - id: okf-spec
    resource: https://github.com/AnimaApp/second-brain-template/blob/main/skills/okf/reference/SPEC.md
    title: Open Knowledge Format v0.2 specification
---

# Decision

Use Open Knowledge Format v0.2 for durable agent memories. Keep each memory
readable without a database, service, or model provider.[^okf-spec]

# Context

The [agent second brain](/projects/second-brain.md) needs portable files,
normal Git history, and deterministic checks.

[^okf-spec]: Open Knowledge Format v0.2 specification
