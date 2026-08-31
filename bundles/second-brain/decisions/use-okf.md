---
type: Decision
title: Use OKF for agent memories
description: Store agent memories as linked Markdown concepts with YAML frontmatter.
tags: [decision, memory, okf]
status: stable
generated: {by: 'process:template-bootstrap', at: '2026-08-31T00:00:00+03:00'}
---

# Decision

Use Open Knowledge Format v0.2 for durable agent memories. Keep each memory
readable without a database, service, or model provider.

# Context

The [agent second brain](/projects/second-brain.md) needs portable files,
normal Git history, and deterministic checks.
