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

import pytest

from okf_tools.bundle.document import (
    OKFDocument,
    OKFDocumentError,
    is_stale,
    normalize_verified,
    trust_tier,
)


def test_roundtrip_preserves_frontmatter_and_body():
    source = (
        "---\n"
        "type: Decision\n"
        "title: Sample\n"
        "tags: [a, b]\n"
        "generated: {by: 'coding-agent/1.0', at: '2026-08-31T00:00:00+03:00'}\n"
        "---\n\n# Sample\n\nBody text.\n"
    )
    document = OKFDocument.parse(source)
    serialized = document.serialize()
    reparsed = OKFDocument.parse(serialized)

    assert document.frontmatter["type"] == "Decision"
    assert document.frontmatter["generated"]["at"] == "2026-08-31T00:00:00+03:00"
    assert reparsed.frontmatter == document.frontmatter
    assert reparsed.body.strip() == document.body.strip()


def test_parse_no_frontmatter_treats_all_as_body():
    document = OKFDocument.parse("# Hello\n")
    assert document.frontmatter == {}
    assert document.body == "# Hello\n"


def test_unterminated_frontmatter_raises():
    with pytest.raises(OKFDocumentError):
        OKFDocument.parse("---\ntype: Decision\n")


def test_validate_requires_only_type():
    OKFDocument(frontmatter={"type": "Custom Type"}).validate()
    with pytest.raises(OKFDocumentError):
        OKFDocument(frontmatter={"title": "Missing type"}).validate()


def test_verified_normalization_and_trust_tiers():
    human = {"by": "human:owner", "at": "2026-08-31T00:00:00Z"}
    process = {"by": "process:nightly", "at": "2026-08-31T00:00:00Z"}

    assert normalize_verified({"verified": human}) == [human]
    assert trust_tier({}) == "unverified"
    assert trust_tier({"verified": [process]}) == "machine-confirmed"
    assert trust_tier({"verified": [process, human]}) == "human-reviewed"


def test_is_stale_needs_an_explicit_offset():
    now = datetime(2026, 8, 31, 12, 0, tzinfo=timezone.utc)
    assert is_stale({"stale_after": "2026-08-31T00:00:00Z"}, now=now)
    assert not is_stale({"stale_after": "2026-09-01T00:00:00Z"}, now=now)
    assert not is_stale({"stale_after": "2026-08-31"}, now=now)
    assert not is_stale({"stale_after": "2026-08-31T00:00:00"}, now=now)
