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

## Produce - write a memory

1. Read [SPEC.md](reference/SPEC.md) for the complete OKF v0.2 rules.
2. Read `brain/index.md` and search the bundle for related terms.
3. Update an existing concept when it describes the same knowledge.
4. Otherwise, create a UTF-8 Markdown concept with YAML frontmatter following the concept template from [templates/concept.md](templates/concept.md): set adescriptive `type`, fill recommended fields, record `generated` and the `sources` you actually read, cross-link related concepts via normal Markdown links.
5. Validate (see below). Fix every error before finishing.

The example folders and types are not a fixed taxonomy. Add a folder or type
when it makes the knowledge easier to find.

## Maintain - keep a bundle in sync with reality

1. Identify which concepts the change affects (search by `resource`, path, or
   topic). This bookkeeping is exactly what agents are good at — touch every
   affected file in one pass.
2. Update the body and `generated.at` (with your own actor in `generated.by`);
   fix or add cross-links; create new concepts for new assets; mark removed
   assets `status: deprecated` and note the deprecation in `log.md` rather than
   silently deleting context. Facing a whole v0.1 bundle rather than a stray
   field? Do not hand-edit it — run the validator's `--migrate` once.
3. Update the relevant `index.md` files and append a dated `log.md` entry
   describing what changed.
4. Validate.

### Consume — use a bundle as context

1. Read the bundle-root `index.md` first for progressive disclosure, then follow
   links only into the concepts relevant to the task.
2. Weigh what you read: `status: draft`/`deprecated`, a `stale_after` already
   past, or no `verified` entry all mean "check before relying on this". Treat
   broken links as not-yet-written knowledge, not errors.
3. Need a number an `Attested Computation` covers? Run *its* computation with
   values bound to the declared `parameters` — never write your own query.
4. If you learn something durable while working, switch to **maintain** and
   write it back.

## Validation (do this before declaring done)

1. Run `okf index brain`.
2. Run `okf check brain`.
3. Fix every finding.
