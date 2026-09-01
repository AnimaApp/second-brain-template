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

const Detail = lazy(() => import("./Detail.jsx").then((module) => ({ default: module.Detail })));
const Graph = lazy(() => import("./Graph.jsx").then((module) => ({ default: module.Graph })));

export function App({ bundle }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [layout, setLayout] = useState("cose");
  const [selectedId, setSelectedId] = useState(bundle.nodes[0]?.data.id || null);
  const [resetSignal, setResetSignal] = useState(0);
  const conceptIds = useMemo(() => new Set(bundle.nodes.map((node) => node.data.id)), [bundle.nodes]);
  const selectConcept = useCallback((conceptId) => setSelectedId(conceptId), []);

  useEffect(() => {
    if (selectedId && !conceptIds.has(selectedId)) {
      setSelectedId(bundle.nodes[0]?.data.id || null);
    }
  }, [bundle.nodes, conceptIds, selectedId]);

  function resetView() {
    setSelectedId(null);
    setResetSignal((value) => value + 1);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="title">
          <strong>{bundle.name}</strong>
          <span className="muted">OKF bundle</span>
        </div>
        <div className="controls">
          <input
            aria-label="Search concepts"
            id="concept-search"
            name="concept-search"
            type="search"
            placeholder="Search title / id / tag"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
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
          <select
            aria-label="Graph layout"
            id="graph-layout"
            name="graph-layout"
            value={layout}
            onChange={(event) => setLayout(event.target.value)}
          >
            <option value="cose">cose (force)</option>
            <option value="concentric">concentric</option>
            <option value="breadthfirst">breadth-first</option>
            <option value="circle">circle</option>
            <option value="grid">grid</option>
          </select>
          <button type="button" onClick={resetView}>
            Reset view
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

      <main className="workspace">
        <Suspense fallback={<section className="graph loading-panel muted">Loading graph…</section>}>
          <Graph
            bundle={bundle}
            layout={layout}
            search={search}
            selectedId={selectedId}
            typeFilter={typeFilter}
            resetSignal={resetSignal}
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
