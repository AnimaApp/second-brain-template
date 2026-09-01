# Agent Second Brain with Open Knowledge Format

This repository is a vendor-neutral second-brain template for coding agents.
It stores durable memories as plain Markdown files with YAML frontmatter.

The template follows the [Open Knowledge Format v0.2 specification](SPEC.md).
It does not need a model API, database, ingestion pipeline, or cloud account.

## Repository layout

```text
brain/                  The memory bundle
okf_tools/              Deterministic OKF tools
viewer/                 Vite and React viewer source
tests/                  Tool and conformance tests
AGENTS.md               Entry point for agents that read AGENTS.md
CLAUDE.md               Entry point for Claude Code
MEMORY_WORKFLOW.md       Canonical memory-writing rules
SPEC.md                  Open Knowledge Format v0.2
```

The starter bundle contains two linked concepts. Its folders and types are
examples, not a fixed taxonomy.

## Install

Use Python 3.11 or newer.

```sh
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
```

Install the local commit hook:

```sh
.venv/bin/pre-commit install
```

Install the viewer dependencies with Node.js 20.19 or newer:

```sh
npm install
```

## Memory workflow

Agents must follow [MEMORY_WORKFLOW.md](MEMORY_WORKFLOW.md). The key rule is
simple: write or change a memory only after the user explicitly asks.

After a memory change, run:

```sh
.venv/bin/okf index brain
.venv/bin/okf check brain
```

Then commit only the memory files and generated indexes. Do not push.

## Commands

### Check SPEC conformance

```sh
.venv/bin/okf validate brain
```

This command fails only for the three conformance rules in SPEC section 11.
It reports optional-field, link, source, and freshness problems as warnings.

### Run strict repository checks

```sh
.venv/bin/okf check brain
```

This command fails on every warning, conformance error, or generated-index
change. This repository policy is stricter than OKF conformance. OKF consumers
must still accept unknown types, extra keys, missing optional fields, broken
links, and missing indexes as the SPEC requires.

### Generate indexes

```sh
.venv/bin/okf index brain
.venv/bin/okf index --check brain
```

The generator is deterministic. It preserves `okf_version` in the root index
and excludes the reserved `index.md` and `log.md` files from concept lists.

### Browse the memory graph

```sh
npm run dev
```

Vite reads every concept under `brain/` and updates the open viewer when a
Markdown file changes. The tracked `index.html` file is the normal Vite entry
file. The repository does not track generated viewer data or build output.

Build and preview the static viewer with:

```sh
npm run build
npm run preview
```

A static deployment includes the bundle state from its build. Rebuild the
viewer after a deployed bundle changes.

## Verification and attestation

The strict checker checks trust metadata, freshness, links, and declared local
files. It never writes a `verified` event and never runs an attester.

OKF v0.2 does not define a portable attester interface. A bundle can declare
an attester, but a problem-specific consumer must execute it safely.

## Tests

```sh
.venv/bin/pytest
.venv/bin/pre-commit run --all-files
npm test
npm run build
```
