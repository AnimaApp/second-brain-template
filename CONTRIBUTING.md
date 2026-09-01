# Contributing

Contributions fall into three groups:

- Changes to [SPEC.md](SPEC.md) change the Open Knowledge Format standard.
  Open an issue before a format change.
- Changes to `okf_tools/` change deterministic bundle tools.
- Changes to `brain/` change the starter memory bundle.

Before you submit a pull request:

1. Install the development dependencies from [README.md](README.md).
2. Run `okf index brain`.
3. Run `okf check brain`.
4. Run `pytest`.
5. Run `pre-commit run --all-files`.

## Contributor License Agreement

Contributions must include a Contributor License Agreement. You retain the
copyright to your contribution and give the project permission to distribute
it. See <https://cla.developers.google.com/>.

## Code reviews

All submissions need review through a GitHub pull request.
