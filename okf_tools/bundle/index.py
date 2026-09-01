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

from collections import defaultdict
from pathlib import Path

from okf_tools.bundle.document import OKFDocument, OKFDocumentError

RESERVED_FILENAMES = {"index.md", "log.md"}


def _load_concept(path: Path) -> OKFDocument | None:
    try:
        doc = OKFDocument.parse(path.read_text(encoding="utf-8"))
        doc.validate()
    except (OSError, UnicodeError, OKFDocumentError):
        return None
    return doc


def _index_directories(bundle_root: Path) -> list[Path]:
    directories: set[Path] = set()
    for path in bundle_root.rglob("*.md"):
        if path.name in RESERVED_FILENAMES:
            continue
        current = path.parent
        while True:
            directories.add(current)
            if current == bundle_root:
                break
            current = current.parent
    return sorted(
        directories,
        key=lambda path: (-len(path.relative_to(bundle_root).parts), str(path)),
    )


def _directory_summary(entries: list[tuple[str, str, str, str]]) -> str:
    if len(entries) == 1 and entries[0][3]:
        return entries[0][3]
    return f"Contains {len(entries)} indexed items."


def _build_body(entries: list[tuple[str, str, str, str]]) -> str:
    grouped: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for type_name, title, link, description in entries:
        grouped[type_name or "Other"].append((title, link, description))

    sections: list[str] = []
    for type_name in sorted(grouped, key=str.casefold):
        lines = [f"# {type_name}", ""]
        for title, link, description in sorted(
            grouped[type_name], key=lambda entry: entry[0].casefold()
        ):
            suffix = f" - {description}" if description else ""
            lines.append(f"* [{title}]({link}){suffix}")
        sections.append("\n".join(lines))
    return "\n\n".join(sections) + "\n"


def _root_version_frontmatter(bundle_root: Path) -> str:
    index_path = bundle_root / "index.md"
    if not index_path.exists():
        return ""
    try:
        doc = OKFDocument.parse(index_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, OKFDocumentError):
        return ""
    version = doc.frontmatter.get("okf_version")
    if version is None:
        return ""
    return f'---\nokf_version: "{version}"\n---\n\n'


def build_index_contents(bundle_root: Path) -> dict[Path, str]:
    """Return every generated index path and its deterministic content."""
    bundle_root = Path(bundle_root)
    if not bundle_root.is_dir():
        return {}

    contents: dict[Path, str] = {}
    descriptions: dict[Path, str] = {}
    for directory in _index_directories(bundle_root):
        entries: list[tuple[str, str, str, str]] = []
        for child in sorted(directory.iterdir(), key=lambda path: path.name.casefold()):
            if child.is_file() and child.suffix == ".md":
                if child.name in RESERVED_FILENAMES:
                    continue
                doc = _load_concept(child)
                if doc is None:
                    continue
                frontmatter = doc.frontmatter
                entries.append(
                    (
                        str(frontmatter.get("type") or "Other"),
                        str(frontmatter.get("title") or child.stem),
                        child.name,
                        str(frontmatter.get("description") or ""),
                    )
                )
            elif child.is_dir() and child in descriptions:
                entries.append(
                    (
                        "Subdirectories",
                        child.name,
                        f"{child.name}/index.md",
                        descriptions[child],
                    )
                )
        if not entries:
            continue
        body = _build_body(entries)
        if directory == bundle_root:
            body = _root_version_frontmatter(bundle_root) + body
        contents[directory / "index.md"] = body
        descriptions[directory] = _directory_summary(entries)
    return contents


def existing_index_paths(bundle_root: Path) -> set[Path]:
    return set(Path(bundle_root).rglob("index.md"))


def find_index_drift(bundle_root: Path) -> list[Path]:
    expected = build_index_contents(bundle_root)
    paths = set(expected) | existing_index_paths(bundle_root)
    drift: list[Path] = []
    for path in sorted(paths):
        actual = path.read_text(encoding="utf-8") if path.exists() else None
        if actual != expected.get(path):
            drift.append(path)
    return drift


def regenerate_indexes(bundle_root: Path) -> list[Path]:
    """Write deterministic indexes and remove indexes that are no longer used."""
    bundle_root = Path(bundle_root)
    expected = build_index_contents(bundle_root)
    stale = existing_index_paths(bundle_root) - set(expected)
    for path in sorted(stale):
        path.unlink()
    written: list[Path] = []
    for path, text in sorted(expected.items()):
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            path.write_text(text, encoding="utf-8")
            written.append(path)
    return written
