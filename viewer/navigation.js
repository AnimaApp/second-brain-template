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

function conceptSort(left, right) {
  return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
}

export function filterConceptIds(bundle, { search = "", typeFilter = "" } = {}) {
  const query = search.trim().toLowerCase();
  const matches = new Set();

  for (const node of bundle.nodes) {
    const data = node.data;
    if (typeFilter && data.type !== typeFilter) {
      continue;
    }

    const haystack = [
      data.label,
      data.id,
      data.type,
      data.description,
      ...(data.tags || []),
      bundle.bodies[data.id] || "",
    ]
      .join(" ")
      .toLowerCase();
    if (!query || haystack.includes(query)) {
      matches.add(data.id);
    }
  }

  return matches;
}

export function buildFolderTree(nodes) {
  const root = { name: "", path: "", concepts: [], folders: new Map() };

  for (const node of nodes) {
    const data = node.data;
    const parts = data.id.split("/").filter(Boolean);
    const folderParts = parts.slice(0, -1);
    let folder = root;
    let path = "";

    for (const name of folderParts) {
      path = path ? `${path}/${name}` : name;
      if (!folder.folders.has(name)) {
        folder.folders.set(name, { name, path, concepts: [], folders: new Map() });
      }
      folder = folder.folders.get(name);
    }

    folder.concepts.push({
      id: data.id,
      label: data.label,
      type: data.type,
      color: data.color,
    });
  }

  function finalize(folder) {
    return {
      name: folder.name,
      path: folder.path,
      concepts: [...folder.concepts].sort(conceptSort),
      folders: [...folder.folders.values()]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(finalize),
    };
  }

  return finalize(root);
}
