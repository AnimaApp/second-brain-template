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

from pathlib import Path

from okf_tools.bundle.document import OKFDocument
from okf_tools.bundle.index import (
    build_index_contents,
    find_index_drift,
    regenerate_indexes,
)


def _write_concept(path: Path, type_name: str, title: str, description: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    document = OKFDocument(
        frontmatter={
            "type": type_name,
            "title": title,
            "description": description,
        },
        body=f"# {title}\n",
    )
    path.write_text(document.serialize(), encoding="utf-8")


def test_indexes_are_deterministic_and_preserve_root_version(tmp_path: Path):
    bundle = tmp_path / "bundle"
    _write_concept(bundle / "projects" / "alpha.md", "Project", "Alpha", "First project.")
    _write_concept(bundle / "decisions" / "format.md", "Decision", "Format", "Use OKF.")
    (bundle / "index.md").write_text(
        '---\nokf_version: "0.2"\n---\n\n# Old\n\n* [Old](old.md)\n',
        encoding="utf-8",
    )
    (bundle / "log.md").write_text(
        "# Directory Update Log\n\n## 2026-08-31\n* Added concepts.\n",
        encoding="utf-8",
    )

    assert find_index_drift(bundle)
    regenerate_indexes(bundle)
    first = build_index_contents(bundle)
    assert not find_index_drift(bundle)
    assert regenerate_indexes(bundle) == []
    assert build_index_contents(bundle) == first

    root_index = (bundle / "index.md").read_text(encoding="utf-8")
    assert root_index.startswith('---\nokf_version: "0.2"\n---')
    assert "log.md" not in root_index
    assert "decisions/index.md" in root_index
    assert "projects/index.md" in root_index


def test_generator_excludes_reserved_files(tmp_path: Path):
    bundle = tmp_path / "bundle"
    _write_concept(bundle / "notes" / "one.md", "Memory", "One", "One memory.")
    (bundle / "notes" / "log.md").write_text(
        "# Directory Update Log\n\n## 2026-08-31\n* Added one.\n",
        encoding="utf-8",
    )
    regenerate_indexes(bundle)
    index = (bundle / "notes" / "index.md").read_text(encoding="utf-8")
    assert "one.md" in index
    assert "log.md" not in index


def test_generator_removes_obsolete_index(tmp_path: Path):
    bundle = tmp_path / "bundle"
    obsolete = bundle / "empty" / "index.md"
    obsolete.parent.mkdir(parents=True)
    obsolete.write_text("# Empty\n\n* [Gone](gone.md)\n", encoding="utf-8")

    regenerate_indexes(bundle)
    assert not obsolete.exists()
