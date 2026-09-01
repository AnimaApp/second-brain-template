# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from okf_tools.bundle.index import find_index_drift, regenerate_indexes
from okf_tools.validation import Finding, validate_bundle


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="okf",
        description="Check and browse Open Knowledge Format bundles.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate = subparsers.add_parser(
        "validate",
        help="Check OKF v0.2 conformance and report advisory findings.",
    )
    validate.add_argument("bundle", type=Path)

    index = subparsers.add_parser("index", help="Generate deterministic index.md files.")
    index.add_argument("bundle", type=Path)
    index.add_argument(
        "--check",
        action="store_true",
        help="Report index drift without writing files.",
    )

    check = subparsers.add_parser(
        "check",
        help="Fail on conformance errors, advisory findings, or index drift.",
    )
    check.add_argument("bundle", type=Path)

    visualize = subparsers.add_parser(
        "visualize",
        help="Generate a self-contained HTML graph for a bundle.",
    )
    visualize.add_argument("bundle", type=Path)
    visualize.add_argument(
        "--out",
        type=Path,
        help="Output path (default: ./index.html).",
    )
    visualize.add_argument("--name")
    return parser


def _relative(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return str(path)


def _print_findings(findings: list[Finding], bundle_root: Path) -> None:
    for finding in findings:
        print(
            f"{finding.level.upper()} "
            f"{_relative(finding.path, bundle_root)} "
            f"[{finding.code}] {finding.message}",
            file=sys.stderr,
        )


def _validate(bundle: Path, *, strict: bool) -> int:
    report = validate_bundle(bundle)
    _print_findings(report.findings, bundle)
    failures = report.findings if strict else report.errors
    if failures:
        print(
            f"Bundle check failed with {len(report.errors)} error(s) "
            f"and {len(report.warnings)} warning(s).",
            file=sys.stderr,
        )
        return 1
    print(
        f"Bundle is OKF v0.2 conformant with {len(report.warnings)} warning(s): {bundle}",
        file=sys.stderr,
    )
    return 0


def _check_indexes(bundle: Path) -> int:
    drift = find_index_drift(bundle)
    for path in drift:
        print(
            f"ERROR {_relative(path, bundle)} [index_drift] "
            "Run `okf index` to update this generated index.",
            file=sys.stderr,
        )
    return 1 if drift else 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "validate":
        return _validate(args.bundle, strict=False)
    if args.command == "index":
        if args.check:
            result = _check_indexes(args.bundle)
            if result == 0:
                print(f"Indexes are current: {args.bundle}", file=sys.stderr)
            return result
        if not args.bundle.is_dir():
            print(f"Bundle directory does not exist: {args.bundle}", file=sys.stderr)
            return 1
        written = regenerate_indexes(args.bundle)
        print(f"Updated {len(written)} index file(s): {args.bundle}", file=sys.stderr)
        return 0
    if args.command == "check":
        validation_result = _validate(args.bundle, strict=True)
        index_result = _check_indexes(args.bundle) if args.bundle.is_dir() else 1
        if validation_result == 0 and index_result == 0:
            print(f"Strict checks passed: {args.bundle}", file=sys.stderr)
            return 0
        return 1
    if args.command == "visualize":
        from okf_tools.viewer import generate_visualization

        output = args.out or Path("index.html")
        try:
            stats = generate_visualization(args.bundle, output, bundle_name=args.name)
        except FileNotFoundError as error:
            print(str(error), file=sys.stderr)
            return 1
        print(
            f"Wrote {stats['concepts']} concept(s), {stats['edges']} edge(s), "
            f"{stats['bytes']} bytes to {output}",
            file=sys.stderr,
        )
        return 0
    return 1
