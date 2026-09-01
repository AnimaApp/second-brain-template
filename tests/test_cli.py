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

from okf_tools.cli import main


def _write_concept(path: Path, body: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"---\ntype: Memory\n---\n\n{body}", encoding="utf-8")


def test_cli_validate_index_check_and_visualize(tmp_path: Path):
    bundle = tmp_path / "bundle"
    _write_concept(bundle / "notes" / "one.md")

    assert main(["validate", str(bundle)]) == 0
    assert main(["index", "--check", str(bundle)]) == 1
    assert main(["index", str(bundle)]) == 0
    assert main(["index", "--check", str(bundle)]) == 0
    assert main(["check", str(bundle)]) == 0
    output = tmp_path / "viewer.html"
    assert main(["visualize", str(bundle), "--out", str(output)]) == 0
    assert output.exists()


def test_cli_visualize_defaults_to_index_html(tmp_path: Path, monkeypatch):
    bundle = tmp_path / "bundle"
    _write_concept(bundle / "notes" / "one.md")
    monkeypatch.chdir(tmp_path)

    assert main(["visualize", str(bundle)]) == 0
    assert (tmp_path / "index.html").exists()


def test_validate_allows_warning_but_check_fails(tmp_path: Path):
    bundle = tmp_path / "bundle"
    _write_concept(bundle / "note.md", "See [missing](missing.md).\n")
    assert main(["validate", str(bundle)]) == 0
    assert main(["check", str(bundle)]) == 1


def test_cli_reports_missing_bundle(tmp_path: Path):
    missing = tmp_path / "missing"
    assert main(["validate", str(missing)]) == 1
    assert main(["index", str(missing)]) == 1
    assert main(["visualize", str(missing)]) == 1
