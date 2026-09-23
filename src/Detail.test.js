// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Detail } from "./Detail.jsx";

const bundle = {
  nodes: [
    { data: { id: "notes/current", label: "Current", type: "Note", color: "#000" } },
    { data: { id: "notes/other", label: "Other", type: "Note", color: "#000" } },
  ],
  edges: [],
  bodies: {
    "notes/current": "**Bold** [internal](other.md)\n\n| A | B |\n| - | - |\n| 1 | 2 |",
  },
};

describe("concept details", () => {
  it("renders GFM and preserves internal navigation links", () => {
    const html = renderToStaticMarkup(createElement(Detail, {
      bundle,
      selectedId: "notes/current",
      onSelect() {},
    }));

    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain('<a class="internal" href="#">internal</a>');
    expect(html).toContain("<table>");
  });
});


it("renders recovered paths as Sandpack-safe links with canonical tooltips", () => {
  const html = renderToStaticMarkup(createElement(Detail, {
    bundle: { ...bundle, bodies: {
      "notes/current": "[recovered](/brain/notes/other.md#section) [missing](/brain/missing.md)",
    } },
    selectedId: "notes/current",
    onSelect() {},
  }));
  expect(html).toContain('<a class="internal" href="#" title="Non-canonical path; use /notes/other.md#section">recovered</a>');
  expect(html).toContain('class="external" href="/brain/missing.md"');
});
