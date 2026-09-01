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

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

from okf_tools.bundle.document import OKFDocument, OKFDocumentError
from okf_tools.bundle.paths import resolve_bundle_path

RESERVED_FILENAMES = {"index.md", "log.md"}
VALID_STATUSES = {"draft", "stable", "deprecated"}

_ACTOR_RE = re.compile(r"^(?:human:[^\s:]+|process:[^\s:]+|[^\s/:]+/[^\s/]+)$")
_INDEX_ENTRY_RE = re.compile(r"^\* \[[^]]+\]\([^)]+\)(?: - .+)?$")
_DATE_HEADING_RE = re.compile(r"^## (\d{4}-\d{2}-\d{2})$")
_LINK_RE = re.compile(r"\]\(([^)\s]+)(?:\s+['\"][^)]*['\"])?\)")
_FOOTNOTE_RE = re.compile(r"\[\^([^]]+)\]")
_FOOTNOTE_DEFINITION_RE = re.compile(r"^\[\^([^]]+)\]:", re.MULTILINE)


@dataclass(frozen=True)
class Finding:
    level: str
    code: str
    path: Path
    message: str


@dataclass
class ValidationReport:
    bundle_root: Path
    findings: list[Finding]

    @property
    def errors(self) -> list[Finding]:
        return [finding for finding in self.findings if finding.level == "error"]

    @property
    def warnings(self) -> list[Finding]:
        return [finding for finding in self.findings if finding.level == "warning"]


def _finding(level: str, code: str, path: Path, message: str) -> Finding:
    return Finding(level=level, code=code, path=path, message=message)


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or "T" not in value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed


def _check_datetime(path: Path, name: str, value: Any) -> list[Finding]:
    if _parse_datetime(value) is not None:
        return []
    return [
        _finding(
            "warning",
            "invalid_datetime",
            path,
            f"{name} must be an ISO 8601 datetime with an explicit UTC offset.",
        )
    ]


def _check_actor(path: Path, name: str, value: Any) -> list[Finding]:
    if isinstance(value, str) and _ACTOR_RE.fullmatch(value):
        return []
    return [
        _finding(
            "warning",
            "invalid_actor",
            path,
            f"{name} does not follow the OKF actor convention.",
        )
    ]


def _check_actor_event(path: Path, name: str, value: Any) -> list[Finding]:
    if not isinstance(value, dict):
        return [_finding("warning", "invalid_event", path, f"{name} must be a mapping.")]
    findings = _check_actor(path, f"{name}.by", value.get("by"))
    if "at" in value:
        findings.extend(_check_datetime(path, f"{name}.at", value["at"]))
    elif name.startswith("verified"):
        findings.append(
            _finding("warning", "missing_datetime", path, f"{name}.at is required.")
        )
    return findings


def _check_usage_window(path: Path, name: str, value: Any) -> list[Finding]:
    if not isinstance(value, dict):
        return [
            _finding("warning", "invalid_usage_window", path, f"{name} must be a mapping.")
        ]
    findings: list[Finding] = []
    for key in ("from", "to"):
        if key not in value:
            findings.append(
                _finding(
                    "warning",
                    "invalid_usage_window",
                    path,
                    f"{name}.{key} is required.",
                )
            )
        else:
            findings.extend(_check_datetime(path, f"{name}.{key}", value[key]))
    return findings


def _looks_like_local_path(value: str) -> bool:
    parsed = urlparse(value)
    if parsed.scheme or value.startswith("#"):
        return False
    return value.startswith(("/", ".")) or "/" in value or Path(value).suffix != ""


def _check_local_path(
    bundle_root: Path,
    document_path: Path,
    field_name: str,
    value: Any,
) -> list[Finding]:
    if not isinstance(value, str) or not value or not _looks_like_local_path(value):
        return []
    target = value.split("#", 1)[0]
    resolved = resolve_bundle_path(bundle_root, document_path, target)
    if resolved is not None and resolved.exists():
        return []
    return [
        _finding(
            "warning",
            "missing_local_path",
            document_path,
            f"{field_name} points to a missing local path: {value}",
        )
    ]


def _check_links(bundle_root: Path, path: Path, body: str) -> list[Finding]:
    findings: list[Finding] = []
    for match in _LINK_RE.finditer(body):
        target = match.group(1)
        parsed = urlparse(target)
        if parsed.scheme or target.startswith("#"):
            continue
        bare_target = target.split("#", 1)[0]
        resolved = resolve_bundle_path(bundle_root, path, bare_target)
        if resolved is None or not resolved.exists():
            findings.append(
                _finding(
                    "warning",
                    "broken_link",
                    path,
                    f"Markdown link points to a missing bundle target: {target}",
                )
            )
    return findings


def _check_sources(
    bundle_root: Path,
    path: Path,
    frontmatter: dict[str, Any],
    body: str,
) -> list[Finding]:
    if "sources" not in frontmatter:
        return []
    sources = frontmatter["sources"]
    if not isinstance(sources, list):
        return [
            _finding("warning", "invalid_sources", path, "sources must be a list of mappings.")
        ]

    findings: list[Finding] = []
    source_ids: list[str] = []
    for index, source in enumerate(sources):
        name = f"sources[{index}]"
        if not isinstance(source, dict):
            findings.append(
                _finding("warning", "invalid_source", path, f"{name} must be a mapping.")
            )
            continue
        resource = source.get("resource")
        if not isinstance(resource, str) or not resource:
            findings.append(
                _finding(
                    "warning",
                    "missing_source_resource",
                    path,
                    f"{name}.resource is required.",
                )
            )
        else:
            findings.extend(_check_local_path(bundle_root, path, f"{name}.resource", resource))
        source_id = source.get("id")
        if source_id is not None:
            if not isinstance(source_id, str) or not source_id:
                findings.append(
                    _finding("warning", "invalid_source_id", path, f"{name}.id must be text.")
                )
            else:
                source_ids.append(source_id)
        if "author" in source:
            findings.extend(_check_actor(path, f"{name}.author", source["author"]))
        if "last_modified" in source:
            findings.extend(
                _check_datetime(path, f"{name}.last_modified", source["last_modified"])
            )
        if "usage_count" in source:
            count = source["usage_count"]
            if not isinstance(count, int) or isinstance(count, bool) or count < 0:
                findings.append(
                    _finding(
                        "warning",
                        "invalid_usage_count",
                        path,
                        f"{name}.usage_count must be a non-negative integer.",
                    )
                )
        if "usage_window" in source:
            findings.extend(
                _check_usage_window(path, f"{name}.usage_window", source["usage_window"])
            )

    duplicate_ids = sorted({source_id for source_id in source_ids if source_ids.count(source_id) > 1})
    for source_id in duplicate_ids:
        findings.append(
            _finding(
                "warning",
                "duplicate_source_id",
                path,
                f"Source id is not unique: {source_id}",
            )
        )

    body_without_definitions = "\n".join(
        line for line in body.splitlines() if not _FOOTNOTE_DEFINITION_RE.match(line)
    )
    references = set(_FOOTNOTE_RE.findall(body_without_definitions))
    for source_id in sorted(references - set(source_ids)):
        findings.append(
            _finding(
                "warning",
                "unmatched_source_footnote",
                path,
                f"Footnote has no matching sources[].id: {source_id}",
            )
        )
    return findings


def _check_parameters(path: Path, value: Any) -> list[Finding]:
    if not isinstance(value, list):
        return [
            _finding("warning", "invalid_parameters", path, "parameters must be a list.")
        ]
    findings: list[Finding] = []
    names: set[str] = set()
    for index, parameter in enumerate(value):
        if not isinstance(parameter, dict):
            findings.append(
                _finding(
                    "warning",
                    "invalid_parameter",
                    path,
                    f"parameters[{index}] must be a mapping.",
                )
            )
            continue
        name = parameter.get("name")
        if not isinstance(name, str) or not name:
            findings.append(
                _finding(
                    "warning",
                    "invalid_parameter",
                    path,
                    f"parameters[{index}].name is required.",
                )
            )
        elif name in names:
            findings.append(
                _finding("warning", "duplicate_parameter", path, f"Parameter is not unique: {name}")
            )
        else:
            names.add(name)
        if not isinstance(parameter.get("type"), str) or not parameter.get("type"):
            findings.append(
                _finding(
                    "warning",
                    "invalid_parameter",
                    path,
                    f"parameters[{index}].type is required.",
                )
            )
        if not isinstance(parameter.get("required"), bool):
            findings.append(
                _finding(
                    "warning",
                    "invalid_parameter",
                    path,
                    f"parameters[{index}].required must be true or false.",
                )
            )
    return findings


def _check_computation(
    bundle_root: Path,
    path: Path,
    frontmatter: dict[str, Any],
    body: str,
) -> list[Finding]:
    if frontmatter.get("type") != "Attested Computation":
        return []
    findings: list[Finding] = []
    runtime = frontmatter.get("runtime")
    if not isinstance(runtime, str) or not runtime:
        findings.append(
            _finding(
                "warning",
                "missing_runtime",
                path,
                "Attested Computation concepts need a non-empty runtime.",
            )
        )
    if "parameters" in frontmatter:
        findings.extend(_check_parameters(path, frontmatter["parameters"]))
    section_lines: list[str] = []
    in_section = False
    for line in body.splitlines():
        if line.startswith("# "):
            in_section = line.strip() == "# Computation"
            continue
        if in_section:
            section_lines.append(line)
    fence_count = sum(1 for line in section_lines if line.startswith("```"))
    if "computation" in frontmatter:
        findings.extend(
            _check_local_path(bundle_root, path, "computation", frontmatter["computation"])
        )
        if fence_count:
            findings.append(
                _finding(
                    "warning",
                    "duplicate_computation",
                    path,
                    "Use computation frontmatter or an inline fence, not both.",
                )
            )
    elif fence_count != 2:
        findings.append(
            _finding(
                "warning",
                "invalid_inline_computation",
                path,
                "An inline computation needs one fenced block under '# Computation'.",
            )
        )
    for field_name in ("executor", "attester"):
        value = frontmatter.get(field_name)
        if value is None:
            continue
        if not isinstance(value, dict):
            findings.append(
                _finding(
                    "warning",
                    f"invalid_{field_name}",
                    path,
                    f"{field_name} must be a mapping.",
                )
            )
            continue
        resource = value.get("resource")
        if not isinstance(resource, str) or not resource:
            findings.append(
                _finding(
                    "warning",
                    f"invalid_{field_name}",
                    path,
                    f"{field_name}.resource is required.",
                )
            )
        else:
            findings.extend(_check_local_path(bundle_root, path, f"{field_name}.resource", resource))
        if field_name == "executor" and "receipt" in value:
            receipt = value["receipt"]
            if not isinstance(receipt, list) or not all(
                isinstance(item, str) and item for item in receipt
            ):
                findings.append(
                    _finding(
                        "warning",
                        "invalid_receipt",
                        path,
                        "executor.receipt must be a list of non-empty field names.",
                    )
                )
    return findings


def _check_concept(
    bundle_root: Path,
    path: Path,
    now: datetime,
) -> list[Finding]:
    try:
        doc = OKFDocument.parse(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, OKFDocumentError) as error:
        return [_finding("error", "invalid_frontmatter", path, str(error))]
    if not doc.frontmatter:
        return [
            _finding(
                "error",
                "missing_frontmatter",
                path,
                "Concept documents need a parseable YAML frontmatter block.",
            )
        ]
    try:
        doc.validate()
    except OKFDocumentError as error:
        return [_finding("error", "missing_type", path, str(error))]

    frontmatter = doc.frontmatter
    findings: list[Finding] = []
    if "status" in frontmatter and frontmatter["status"] not in VALID_STATUSES:
        findings.append(
            _finding(
                "warning",
                "invalid_status",
                path,
                "status must be draft, stable, or deprecated.",
            )
        )
    if "generated" in frontmatter:
        findings.extend(_check_actor_event(path, "generated", frontmatter["generated"]))
    if "verified" in frontmatter:
        verified = frontmatter["verified"]
        events: Iterable[Any]
        if isinstance(verified, dict):
            events = [verified]
        elif isinstance(verified, list):
            events = verified
        else:
            events = []
            findings.append(
                _finding(
                    "warning",
                    "invalid_verified",
                    path,
                    "verified must be a mapping or a list of mappings.",
                )
            )
        for index, event in enumerate(events):
            findings.extend(_check_actor_event(path, f"verified[{index}]", event))
    if "stale_after" in frontmatter:
        stale_after = _parse_datetime(frontmatter["stale_after"])
        if stale_after is None:
            findings.extend(_check_datetime(path, "stale_after", frontmatter["stale_after"]))
        elif now >= stale_after:
            findings.append(
                _finding(
                    "warning",
                    "stale_concept",
                    path,
                    f"Concept became stale at {frontmatter['stale_after']}.",
                )
            )
    if "usage_window" in frontmatter:
        findings.extend(_check_usage_window(path, "usage_window", frontmatter["usage_window"]))
    findings.extend(_check_sources(bundle_root, path, frontmatter, doc.body))
    findings.extend(_check_computation(bundle_root, path, frontmatter, doc.body))
    findings.extend(_check_links(bundle_root, path, doc.body))
    for field_name in ("resource",):
        if field_name in frontmatter:
            findings.extend(
                _check_local_path(bundle_root, path, field_name, frontmatter[field_name])
            )
    return findings


def _split_reserved(path: Path) -> tuple[dict[str, Any], str] | None:
    try:
        doc = OKFDocument.parse(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, OKFDocumentError):
        return None
    return doc.frontmatter, doc.body


def _check_index(bundle_root: Path, path: Path) -> list[Finding]:
    parsed = _split_reserved(path)
    if parsed is None:
        return [_finding("error", "invalid_index", path, "index.md is not valid UTF-8 Markdown.")]
    frontmatter, body = parsed
    if path.parent == bundle_root:
        if frontmatter and set(frontmatter) != {"okf_version"}:
            return [
                _finding(
                    "error",
                    "invalid_index_frontmatter",
                    path,
                    "The root index frontmatter can contain only okf_version.",
                )
            ]
    elif frontmatter:
        return [
            _finding(
                "error",
                "invalid_index_frontmatter",
                path,
                "Only the bundle-root index can contain frontmatter.",
            )
        ]

    lines = [line for line in body.splitlines() if line.strip()]
    if not lines or not lines[0].startswith("# "):
        return [
            _finding(
                "error",
                "invalid_index_structure",
                path,
                "index.md must start with a level-one section heading.",
            )
        ]
    entries_in_section = 0
    saw_entry = False
    for line in lines:
        if line.startswith("# "):
            if saw_entry and entries_in_section == 0:
                return [
                    _finding(
                        "error",
                        "invalid_index_structure",
                        path,
                        "Every index section must contain an entry.",
                    )
                ]
            entries_in_section = 0
            saw_entry = True
        elif _INDEX_ENTRY_RE.fullmatch(line):
            entries_in_section += 1
        else:
            return [
                _finding(
                    "error",
                    "invalid_index_structure",
                    path,
                    f"Invalid index line: {line}",
                )
            ]
    if entries_in_section == 0:
        return [
            _finding(
                "error",
                "invalid_index_structure",
                path,
                "Every index section must contain an entry.",
            )
        ]
    return []


def _check_log(path: Path) -> list[Finding]:
    parsed = _split_reserved(path)
    if parsed is None:
        return [_finding("error", "invalid_log", path, "log.md is not valid UTF-8 Markdown.")]
    frontmatter, body = parsed
    if frontmatter:
        return [_finding("error", "invalid_log", path, "log.md cannot contain frontmatter.")]
    lines = [line for line in body.splitlines() if line.strip()]
    if not lines or lines[0] != "# Directory Update Log":
        return [
            _finding(
                "error",
                "invalid_log_structure",
                path,
                "log.md must start with '# Directory Update Log'.",
            )
        ]
    dates: list[str] = []
    entries_after_date = 0
    saw_date = False
    for line in lines[1:]:
        date_match = _DATE_HEADING_RE.fullmatch(line)
        if date_match:
            if saw_date and entries_after_date == 0:
                return [
                    _finding(
                        "error",
                        "invalid_log_structure",
                        path,
                        "Every date heading must contain a list entry.",
                    )
                ]
            try:
                datetime.strptime(date_match.group(1), "%Y-%m-%d")
            except ValueError:
                return [_finding("error", "invalid_log_date", path, f"Invalid date: {line}")]
            dates.append(date_match.group(1))
            entries_after_date = 0
            saw_date = True
        elif line.startswith("* ") and saw_date:
            entries_after_date += 1
        else:
            return [
                _finding(
                    "error",
                    "invalid_log_structure",
                    path,
                    f"Invalid log line: {line}",
                )
            ]
    if not dates or entries_after_date == 0:
        return [
            _finding(
                "error",
                "invalid_log_structure",
                path,
                "log.md needs at least one dated entry.",
            )
        ]
    if dates != sorted(dates, reverse=True):
        return [
            _finding(
                "error",
                "invalid_log_order",
                path,
                "log.md date headings must be newest first.",
            )
        ]
    return []


def validate_bundle(bundle_root: Path, *, now: datetime | None = None) -> ValidationReport:
    bundle_root = Path(bundle_root)
    if not bundle_root.is_dir():
        return ValidationReport(
            bundle_root,
            [_finding("error", "missing_bundle", bundle_root, "Bundle directory does not exist.")],
        )
    reference_time = now or datetime.now(timezone.utc)
    if reference_time.tzinfo is None:
        reference_time = reference_time.replace(tzinfo=timezone.utc)
    findings: list[Finding] = []
    for path in sorted(bundle_root.rglob("*.md")):
        if path.name == "index.md":
            findings.extend(_check_index(bundle_root, path))
        elif path.name == "log.md":
            findings.extend(_check_log(path))
        else:
            findings.extend(_check_concept(bundle_root, path, reference_time))
    return ValidationReport(bundle_root=bundle_root, findings=findings)
