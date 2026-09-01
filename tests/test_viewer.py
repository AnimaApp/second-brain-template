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

import json
import re
from pathlib import Path
from textwrap import dedent

import pytest

from okf_tools.viewer.generator import generate_visualization


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dedent(text).lstrip(), encoding="utf-8")


def _make_bundle(root: Path) -> None:
    _write(
        root / "projects" / "brain.md",
        """
        ---
        type: Project
        title: Second brain
        description: A shared memory bundle.
        tags: [memory]
        generated: {by: 'process:template', at: '2026-08-31T00:00:00Z'}
        ---
        See the [decision](../decisions/format.md).
        """,
    )
    _write(
        root / "decisions" / "format.md",
        """
        ---
        type: Decision
        title: Use OKF
        description: Keep memories in OKF.
        status: stable
        verified: {by: 'human:owner', at: '2026-08-31T00:00:00Z'}
        ---
        Return to the [project](/projects/brain.md).
        """,
    )
    _write(root / "index.md", "# Subdirectories\n\n* [projects](projects/index.md)\n")
    _write(
        root / "log.md",
        "# Directory Update Log\n\n## 2026-08-31\n* Created the bundle.\n",
    )


def _bundle_data(html: str) -> dict:
    match = re.search(r"window\.BUNDLE\s*=\s*(\{.*?\});", html, re.DOTALL)
    assert match
    return json.loads(match.group(1))


def test_viewer_excludes_reserved_files_and_resolves_both_link_forms(tmp_path: Path):
    bundle = tmp_path / "bundle"
    _make_bundle(bundle)
    output = tmp_path / "viz.html"
    stats = generate_visualization(bundle, output, bundle_name="Memory")
    data = _bundle_data(output.read_text(encoding="utf-8"))

    assert stats["concepts"] == 2
    assert {node["data"]["id"] for node in data["nodes"]} == {
        "projects/brain",
        "decisions/format",
    }
    assert {
        (edge["data"]["source"], edge["data"]["target"])
        for edge in data["edges"]
    } == {
        ("projects/brain", "decisions/format"),
        ("decisions/format", "projects/brain"),
    }


def test_viewer_uses_stable_generic_type_colors(tmp_path: Path):
    bundle = tmp_path / "bundle"
    _make_bundle(bundle)
    first = tmp_path / "first.html"
    second = tmp_path / "second.html"
    generate_visualization(bundle, first)
    generate_visualization(bundle, second)

    first_data = _bundle_data(first.read_text(encoding="utf-8"))
    second_data = _bundle_data(second.read_text(encoding="utf-8"))
    assert first_data["palette"] == second_data["palette"]
    assert set(first_data["palette"]) == {"Decision", "Project"}


def test_viewer_payload_contains_trust_signals(tmp_path: Path):
    bundle = tmp_path / "bundle"
    _make_bundle(bundle)
    output = tmp_path / "viz.html"
    generate_visualization(bundle, output)
    data = _bundle_data(output.read_text(encoding="utf-8"))
    by_id = {node["data"]["id"]: node["data"] for node in data["nodes"]}
    assert by_id["decisions/format"]["trust_tier"] == "human-reviewed"
    assert by_id["projects/brain"]["trust_tier"] == "unverified"


def test_viewer_formats_bundle_data_as_indented_json(tmp_path: Path):
    bundle = tmp_path / "bundle"
    _make_bundle(bundle)
    output = tmp_path / "viz.html"
    generate_visualization(bundle, output)

    assert 'window.BUNDLE = {\n  "nodes": [' in output.read_text(encoding="utf-8")


def test_viewer_rejects_missing_bundle(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        generate_visualization(tmp_path / "missing", tmp_path / "viz.html")
