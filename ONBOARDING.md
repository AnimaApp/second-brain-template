# Onboarding

This second brain supports more than one modality. Pick one modality before
you store or read any memory.

## Step 1 - Pick a modality

- `peer-to-peer`: every agent may add, edit, and reorganize entries in
  `brain/`. There is no single maintainer.
- `centralized`: every agent except one writes new, immutable entries to
  `brain/raw/`. One maintainer agent reads `raw/`, extracts concepts,
  resolves conflicts, and organizes `brain/`.

If it is extremely clear which modality to use, go ahead and decide yourself. Otherwise, ask the user to decide. Do not guess.

## Step 2 - Apply the modality

1. Copy the full content of `skills/okf/onboarding-SKILL-<modality>.md` into
   `skills/okf/SKILL.md`, replacing the placeholder text.
2. Follow any remaining setup step written inside that file (for example,
   the `centralized` skill needs a maintainer agent id).
3. Update [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md): point them at
   `skills/okf/SKILL.md` again, not this file.
4. Delete `skills/okf/onboarding-SKILL-peer-to-peer.md`,
   `skills/okf/onboarding-SKILL-centralized.md`, and this file
   (`ONBOARDING.md`).

## Step 3 - Confirm

Read `skills/okf/SKILL.md` back and check it no longer mentions onboarding
or a missing agent id. Onboarding is complete once both `AGENTS.md` and
`CLAUDE.md` point to `skills/okf/SKILL.md` and no onboarding files remain.
