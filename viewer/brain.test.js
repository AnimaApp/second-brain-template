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

import { describe, expect, it } from "vitest";

import {
  buildBacklinks,
  buildBundle,
  conceptIdFromPath,
  isReservedPath,
  isStale,
  normalizeVerified,
  parseDocument,
  resolveConceptLink,
  trustTier,
} from "./brain.js";

const PROJECT = `---
type: Project
title: Second brain
description: A shared memory bundle.
tags: [memory]
generated: {by: 'process:template', at: '2026-08-31T00:00:00Z'}
---

See the [decision](../decisions/format.md#decision).
`;

const DECISION = `---
type: Decision
title: Use OKF
description: Keep memories in OKF.
status: stable
verified: {by: 'human:owner', at: '2026-08-31T00:00:00Z'}
---

Return to the [project](/projects/brain.md).
`;

const FILES = {
  "/brain/index.md": "# Subdirectories\n",
  "/brain/projects/index.md": "# Projects\n",
  "/brain/projects/brain.md": PROJECT,
  "/brain/decisions/format.md": DECISION,
  "/brain/decisions/log.md": "# Log\n",
};

describe("OKF document parsing", () => {
  it("parses frontmatter and keeps timestamps as strings", () => {
    const document = parseDocument(PROJECT);

    expect(document.frontmatter.type).toBe("Project");
    expect(document.frontmatter.generated.at).toBe("2026-08-31T00:00:00Z");
    expect(document.body).toContain("See the [decision]");
  });

  it("reports malformed YAML and unterminated frontmatter", () => {
    expect(() => parseDocument("---\ntype: [broken\n---\n")).toThrow("Invalid YAML");
    expect(() => parseDocument("---\ntype: Memory\n")).toThrow("Unterminated YAML");
  });
});

describe("concept paths and links", () => {
  it("creates concept IDs and excludes reserved files at every level", () => {
    expect(conceptIdFromPath("/brain/projects/brain.md")).toBe("projects/brain");
    expect(isReservedPath("/brain/index.md")).toBe(true);
    expect(isReservedPath("/brain/projects/log.md")).toBe(true);
    expect(isReservedPath("/brain/projects/brain.md")).toBe(false);
  });

  it("resolves relative and bundle-root links without leaving the bundle", () => {
    const ids = new Set(["projects/brain", "decisions/format"]);

    expect(resolveConceptLink("../decisions/format.md", "projects/brain", ids)).toBe("decisions/format");
    expect(resolveConceptLink("/projects/brain.md#goal", "decisions/format", ids)).toBe("projects/brain");
    expect(resolveConceptLink("../../outside.md", "projects/brain", ids)).toBeNull();
    expect(resolveConceptLink("https://example.com", "projects/brain", ids)).toBeNull();
  });
});

describe("bundle graph", () => {
  it("builds nodes, directed edges, bodies, and backlinks", () => {
    const bundle = buildBundle(FILES, { now: new Date("2026-08-31T12:00:00Z") });

    expect(bundle.nodes.map((node) => node.data.id)).toEqual(["decisions/format", "projects/brain"]);
    expect(bundle.edges.map((edge) => [edge.data.source, edge.data.target])).toEqual([
      ["decisions/format", "projects/brain"],
      ["projects/brain", "decisions/format"],
    ]);
    expect(buildBacklinks(bundle.edges)).toEqual({
      "projects/brain": ["decisions/format"],
      "decisions/format": ["projects/brain"],
    });
    expect(bundle.bodies["projects/brain"]).toContain("decision");
  });

  it("uses stable generic type colors", () => {
    const first = buildBundle(FILES);
    const second = buildBundle(FILES);

    expect(first.palette).toEqual(second.palette);
    expect(Object.keys(first.palette)).toEqual(["Decision", "Project"]);
  });

  it("keeps valid concepts and reports malformed concepts", () => {
    const bundle = buildBundle({
      ...FILES,
      "/brain/notes/broken.md": "---\ntype: [broken\n---\n",
    });

    expect(bundle.nodes).toHaveLength(2);
    expect(bundle.errors).toHaveLength(1);
    expect(bundle.errors[0].path).toBe("notes/broken");
    expect(bundle.errors[0].message).toContain("Invalid YAML");
  });
});

describe("trust and freshness", () => {
  it("normalizes verifier events and derives trust tiers", () => {
    const process = { by: "process:check" };
    const human = { by: "human:owner" };

    expect(normalizeVerified({ verified: human })).toEqual([human]);
    expect(trustTier({})).toBe("unverified");
    expect(trustTier({ verified: [process] })).toBe("machine-confirmed");
    expect(trustTier({ verified: [process, human] })).toBe("human-reviewed");
  });

  it("marks only absolute datetimes as stale", () => {
    const now = new Date("2026-08-31T12:00:00Z");

    expect(isStale({ stale_after: "2026-08-31T00:00:00Z" }, now)).toBe(true);
    expect(isStale({ stale_after: "2026-09-01T00:00:00Z" }, now)).toBe(false);
    expect(isStale({ stale_after: "2026-08-31" }, now)).toBe(false);
    expect(isStale({ stale_after: "2026-08-31T00:00:00" }, now)).toBe(false);
  });
});
