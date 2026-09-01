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

import { useMemo } from "react";

import { buildFolderTree } from "./navigation.js";

function ConceptRows({ concepts, matchingIds, selectedId, onSelect }) {
  const visible = concepts.filter((concept) => matchingIds.has(concept.id));
  if (!visible.length) {
    return null;
  }

  return (
    <ul className="sidebar-concepts">
      {visible.map((concept) => (
        <li key={concept.id}>
          <button
            className="sidebar-concept"
            type="button"
            aria-current={selectedId === concept.id ? "page" : undefined}
            title={concept.id}
            onClick={() => onSelect(concept.id)}
          >
            <span
              className="sidebar-type-dot"
              style={{ background: concept.color }}
              aria-hidden="true"
            />
            <span className="sidebar-concept-label">{concept.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function folderHasMatches(folder, matchingIds) {
  return (
    folder.concepts.some((concept) => matchingIds.has(concept.id)) ||
    folder.folders.some((child) => folderHasMatches(child, matchingIds))
  );
}

function FolderSection({ folder, matchingIds, selectedId, onSelect }) {
  if (!folderHasMatches(folder, matchingIds)) {
    return null;
  }

  return (
    <section className="sidebar-folder">
      <h2 title={folder.path}>{folder.name}</h2>
      <ConceptRows
        concepts={folder.concepts}
        matchingIds={matchingIds}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      {folder.folders.map((child) => (
        <FolderSection
          folder={child}
          matchingIds={matchingIds}
          selectedId={selectedId}
          onSelect={onSelect}
          key={child.path}
        />
      ))}
    </section>
  );
}

export function Sidebar({
  bundle,
  matchingIds,
  search,
  typeFilter,
  selectedId,
  onSearchChange,
  onClearFilters,
  onSelect,
}) {
  const tree = useMemo(() => buildFolderTree(bundle.nodes), [bundle.nodes]);
  const filtering = Boolean(search.trim() || typeFilter);

  return (
    <nav className="sidebar" aria-label="Bundle files">
      <div className="sidebar-search-wrap">
        <svg
          className="sidebar-search-icon"
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.4" />
          <path d="m10.2 10.2 3 3" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <input
          aria-label="Search bundle files"
          id="concept-search"
          name="concept-search"
          type="search"
          placeholder="Search files…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="sidebar-summary" aria-live="polite">
        <span>
          {matchingIds.size} {matchingIds.size === 1 ? "concept" : "concepts"}
        </span>
        {filtering ? (
          <button className="sidebar-clear" type="button" onClick={onClearFilters}>
            Clear
          </button>
        ) : null}
      </div>

      <div className="sidebar-scroll">
        {matchingIds.size ? (
          <>
            <ConceptRows
              concepts={tree.concepts}
              matchingIds={matchingIds}
              selectedId={selectedId}
              onSelect={onSelect}
            />
            {tree.folders.map((folder) => (
              <FolderSection
                folder={folder}
                matchingIds={matchingIds}
                selectedId={selectedId}
                onSelect={onSelect}
                key={folder.path}
              />
            ))}
          </>
        ) : (
          <div className="sidebar-empty">
            <strong>No matching concepts</strong>
            <span>Try a different search or type.</span>
          </div>
        )}
      </div>
    </nav>
  );
}
