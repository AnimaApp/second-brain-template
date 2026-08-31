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

from datetime import datetime, timezone
from pathlib import Path

from okf_tools.validation import validate_bundle


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _codes(bundle: Path) -> set[str]:
    return {finding.code for finding in validate_bundle(bundle).findings}


def test_conformance_rejects_missing_frontmatter(tmp_path: Path):
    _write(tmp_path / "note.md", "# No frontmatter\n")
    report = validate_bundle(tmp_path)
    assert [finding.code for finding in report.errors] == ["missing_frontmatter"]


def test_conformance_rejects_invalid_yaml_and_missing_type(tmp_path: Path):
    _write(tmp_path / "bad.md", "---\ntype: [\n---\n")
    _write(tmp_path / "missing.md", "---\ntitle: Missing type\n---\n")
    assert _codes(tmp_path) >= {"invalid_frontmatter", "missing_type"}


def test_conformance_rejects_invalid_reserved_files(tmp_path: Path):
    _write(tmp_path / "index.md", "Not an index.\n")
    _write(tmp_path / "log.md", "# Wrong\n")
    assert _codes(tmp_path) >= {"invalid_index_structure", "invalid_log_structure"}


def test_unknown_types_and_keys_are_conformant(tmp_path: Path):
    _write(
        tmp_path / "custom.md",
        "---\ntype: My New Type\ncustom_key: anything\n---\n\n# Custom\n",
    )
    report = validate_bundle(tmp_path)
    assert report.errors == []
    assert report.warnings == []


def test_optional_family_and_link_findings_are_warnings(tmp_path: Path):
    _write(
        tmp_path / "note.md",
        "---\n"
        "type: Memory\n"
        "status: unknown\n"
        "generated: {by: bad, at: yesterday}\n"
        "verified: [{by: 'human:owner'}]\n"
        "sources:\n"
        "  - {id: source, resource: ./missing.md}\n"
        "---\n\n"
        "See [missing](missing.md). Claim.[^other]\n\n[^other]: Other.\n",
    )
    report = validate_bundle(tmp_path)
    codes = {finding.code for finding in report.warnings}
    assert report.errors == []
    assert codes >= {
        "invalid_status",
        "invalid_actor",
        "invalid_datetime",
        "missing_datetime",
        "missing_local_path",
        "broken_link",
        "unmatched_source_footnote",
    }


def test_stale_concept_is_a_warning(tmp_path: Path):
    _write(
        tmp_path / "note.md",
        "---\ntype: Memory\nstale_after: '2026-01-01T00:00:00Z'\n---\n",
    )
    report = validate_bundle(
        tmp_path,
        now=datetime(2026, 8, 31, tzinfo=timezone.utc),
    )
    assert [finding.code for finding in report.warnings] == ["stale_concept"]


def test_valid_index_and_log_are_conformant(tmp_path: Path):
    _write(
        tmp_path / "index.md",
        '---\nokf_version: "0.2"\n---\n\n# Memories\n\n* [One](one.md) - Example.\n',
    )
    _write(
        tmp_path / "log.md",
        "# Directory Update Log\n\n## 2026-08-31\n* Added one.\n\n## 2026-08-30\n* Started.\n",
    )
    _write(tmp_path / "one.md", "---\ntype: Memory\n---\n")
    report = validate_bundle(tmp_path)
    assert report.errors == []


def test_attested_computation_checks_declarations_not_execution(tmp_path: Path):
    _write(
        tmp_path / "calculation.md",
        "---\n"
        "type: Attested Computation\n"
        "parameters: [{name: count, type: integer, required: true}]\n"
        "attester: {resource: ./missing.py}\n"
        "---\n",
    )
    codes = _codes(tmp_path)
    assert "missing_runtime" in codes
    assert "missing_local_path" in codes
    assert "invalid_inline_computation" in codes


def test_valid_inline_computation_has_one_fenced_block(tmp_path: Path):
    _write(
        tmp_path / "calculation.md",
        "---\ntype: Attested Computation\nruntime: python\n---\n\n"
        "# Computation\n\n```python\nprint(1)\n```\n",
    )
    assert validate_bundle(tmp_path).findings == []
