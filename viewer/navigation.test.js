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

import { buildFolderTree, filterConceptIds } from "./navigation.js";

const bundle = {
  nodes: [
    {
      data: {
        id: "welcome",
        label: "Welcome",
        type: "Guide",
        description: "Start here",
        tags: ["intro"],
        color: "#111111",
      },
    },
    {
      data: {
        id: "projects/zebra",
        label: "Zebra project",
        type: "Project",
        description: "Striped work",
        tags: ["animal"],
        color: "#222222",
      },
    },
    {
      data: {
        id: "projects/archive/alpha",
        label: "Alpha project",
        type: "Project",
        description: "Old work",
        tags: ["history"],
        color: "#333333",
      },
    },
    {
      data: {
        id: "decisions/format",
        label: "Choose OKF",
        type: "Decision",
        description: "Portable files",
        tags: ["format"],
        color: "#444444",
      },
    },
  ],
  bodies: {
    welcome: "Read this first.",
    "projects/zebra": "Active delivery notes.",
    "projects/archive/alpha": "Retired lunar research.",
    "decisions/format": "Use Markdown and YAML.",
  },
};

describe("sidebar folder tree", () => {
  it("groups nested paths, keeps root concepts, and sorts folders", () => {
    const tree = buildFolderTree(bundle.nodes);

    expect(tree.concepts.map((concept) => concept.id)).toEqual(["welcome"]);
    expect(tree.folders.map((folder) => folder.path)).toEqual(["decisions", "projects"]);
    expect(tree.folders[1].concepts.map((concept) => concept.id)).toEqual(["projects/zebra"]);
    expect(tree.folders[1].folders[0].concepts.map((concept) => concept.id)).toEqual([
      "projects/archive/alpha",
    ]);
  });

  it("returns an empty tree for an empty bundle", () => {
    expect(buildFolderTree([])).toEqual({ name: "", path: "", concepts: [], folders: [] });
  });
});

describe("concept search", () => {
  it.each([
    ["welcome", ["welcome"]],
    ["PROJECTS/ARCHIVE", ["projects/archive/alpha"]],
    ["animal", ["projects/zebra"]],
    ["portable", ["decisions/format"]],
    ["LUNAR", ["projects/archive/alpha"]],
  ])("matches %s across concept fields", (search, expected) => {
    expect([...filterConceptIds(bundle, { search })]).toEqual(expected);
  });

  it("combines search and type filters", () => {
    expect([...filterConceptIds(bundle, { search: "project", typeFilter: "Project" })]).toEqual([
      "projects/zebra",
      "projects/archive/alpha",
    ]);
    expect([...filterConceptIds(bundle, { search: "project", typeFilter: "Decision" })]).toEqual([]);
  });

  it("returns all concepts for empty filters", () => {
    expect([...filterConceptIds(bundle)]).toEqual(bundle.nodes.map((node) => node.data.id));
  });
});
