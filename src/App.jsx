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

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { filterConceptIds } from "./navigation.js";
import { Sidebar } from "./Sidebar.jsx";
import { preferredTheme, readStoredTheme, saveTheme } from "./theme.js";

const Detail = lazy(() => import("./Detail.jsx").then((module) => ({ default: module.Detail })));
const Graph = lazy(() => import("./Graph.jsx").then((module) => ({ default: module.Graph })));

export function App({ bundle }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedId, setSelectedId] = useState(bundle.nodes[0]?.data.id || null);
  const [resetSignal, setResetSignal] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(max-width: 860px)").matches,
  );
  const [theme, setTheme] = useState(() => readStoredTheme() || preferredTheme());
  const [manualTheme, setManualTheme] = useState(() => Boolean(readStoredTheme()));
  const conceptIds = useMemo(() => new Set(bundle.nodes.map((node) => node.data.id)), [bundle.nodes]);
  const matchingIds = useMemo(
    () => filterConceptIds(bundle, { search, typeFilter }),
    [bundle, search, typeFilter],
  );
  const selectConcept = useCallback((conceptId) => setSelectedId(conceptId), []);

  useEffect(() => {
    if (selectedId && !conceptIds.has(selectedId)) {
      setSelectedId(bundle.nodes[0]?.data.id || null);
    }
  }, [bundle.nodes, conceptIds, selectedId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (manualTheme || typeof window === "undefined") {
      return undefined;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setTheme(preferredTheme(media));
    media.addEventListener("change", updateTheme);
    return () => media.removeEventListener("change", updateTheme);
  }, [manualTheme]);

  function resetView() {
    setSelectedId(null);
    setResetSignal((value) => value + 1);
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("");
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    setManualTheme(true);
    saveTheme(nextTheme);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-start">
          <button
            className="icon-button sidebar-toggle"
            type="button"
            aria-controls="bundle-sidebar"
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? "Hide file sidebar" : "Show file sidebar"}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
              <path d="M5.75 3v10" stroke="currentColor" strokeWidth="1.25" />
              <path d="M3.5 5.25h1" stroke="currentColor" strokeWidth="1.25" />
              <path d="M3.5 7.75h1" stroke="currentColor" strokeWidth="1.25" />
            </svg>
          </button>
          <div className="title">
            <strong>{bundle.name}</strong>
            <span className="muted">OKF bundle</span>
          </div>
        </div>
        <div className="controls">
          <select
            aria-label="Filter by type"
            id="type-filter"
            name="type-filter"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">All types</option>
            {bundle.types.map((type) => (
              <option value={type} key={type}>
                {type}
              </option>
            ))}
          </select>
          <button type="button" onClick={resetView}>
            Reset view
          </button>
          <button
            className="icon-button theme-toggle"
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.25" />
                <path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M12.4 3.6l-1.05 1.05M4.65 11.35 3.6 12.4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12.9 10.2A5.2 5.2 0 0 1 5.8 3.1 5.25 5.25 0 1 0 12.9 10.2Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {bundle.errors.length ? (
        <aside className="error-banner" role="alert">
          <strong>{bundle.errors.length} concept file(s) could not load.</strong>
          <details>
            <summary>Show errors</summary>
            <ul>
              {bundle.errors.map((error) => (
                <li key={error.path}>
                  <code>{error.path}.md</code>: {error.message}
                </li>
              ))}
            </ul>
          </details>
        </aside>
      ) : null}

      <main className="workspace" data-sidebar-open={sidebarOpen || undefined}>
        {sidebarOpen ? (
          <aside className="sidebar-pane" id="bundle-sidebar">
            <Sidebar
              bundle={bundle}
              matchingIds={matchingIds}
              search={search}
              typeFilter={typeFilter}
              selectedId={selectedId}
              onSearchChange={setSearch}
              onClearFilters={clearFilters}
              onSelect={selectConcept}
            />
          </aside>
        ) : null}
        <Suspense fallback={<section className="graph loading-panel muted">Loading graph…</section>}>
          <Graph
            bundle={bundle}
            matchingIds={matchingIds}
            selectedId={selectedId}
            resetSignal={resetSignal}
            theme={theme}
            onSelect={selectConcept}
          />
        </Suspense>
        <Suspense fallback={<section className="detail loading-panel muted">Loading concept…</section>}>
          <Detail bundle={bundle} selectedId={selectedId} onSelect={selectConcept} />
        </Suspense>
      </main>
    </div>
  );
}
