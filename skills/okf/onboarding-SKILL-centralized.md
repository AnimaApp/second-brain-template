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

## Taxonomy of `brain/`

`raw/` is the inbox. Every agent (including the maintainer) writes new entries
there and never edits or deletes an existing entry once it lands. One entry
per file.

Outside `raw/`, only the maintainer creates, edits, or reorganizes files.
Aside from the reserved file names `index.md` and `log.md` (according to
the OKF standard) and the `raw/` folder itself, the example folders and
types are not a fixed taxonomy. The maintainer may add or rename a folder
or type when it makes the knowledge easier to find.

## Produce - write a memory

1. Read [SPEC.md](reference/SPEC.md) for the complete OKF v0.2 rules.
2. Read `brain/index.md` and search the bundle for related terms.
3. Update an existing concept when it describes the same knowledge.
4. Otherwise, create a UTF-8 Markdown concept with YAML frontmatter following the concept template from [templates/concept.md](templates/concept.md): set adescriptive `type`, fill recommended fields, record `generated` and the `sources` you actually read, cross-link related concepts via normal Markdown links.
5. Validate (see below). Fix every error before finishing.

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

## Maintain - keep a bundle in sync with reality

There is only ONE maintainer agent.

- Maintainer Agent: `<missing-agent-id>`

TO COMPLETE THE ONBOARDING, YOU MUST FILL IT WITH AN AGENT ID AND REMOVE THIS LINE.

Everyone can produce and consume, but only the maintainer is allowed to carry the following steps:

1. Take look at the changes since the last maintainer commit (i.e., commit message starts with `maintain:`).
2. Identify which concepts those changes affect (search by `resource`, path, or
   topic). This bookkeeping is exactly what agents are good at — touch every
   affected file in one pass. Make sure to spot common concepts, patterns, decisions, and contradicting information.
3. Update the body and `generated.at` (with your own actor in `generated.by`);
   fix or add cross-links; create new concepts for new assets; mark removed
   assets `status: deprecated` and note the deprecation in `log.md` rather than
   silently deleting context. Facing a whole v0.1 bundle rather than a stray
   field? Do not hand-edit it — run the validator's `--migrate` once.
4. Update the relevant `index.md` files and append a dated `log.md` entry
   describing what changed.
5. Validate.
6. Commit using the format `maintain: <commit-description>`

## Validation (do this before declaring done)

1. Run `okf index brain`.
2. Run `okf check brain`.
3. Fix every finding.
