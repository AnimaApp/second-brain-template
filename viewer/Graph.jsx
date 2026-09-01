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

import cytoscape from "cytoscape";
import { useEffect, useRef } from "react";

const GRAPH_STYLE = [
  {
    selector: "node",
    style: {
      "background-color": "data(color)",
      label: "data(label)",
      color: "#0f172a",
      "font-size": 11,
      "text-valign": "bottom",
      "text-margin-y": 4,
      "text-wrap": "wrap",
      "text-max-width": 120,
      width: "data(size)",
      height: "data(size)",
      "border-width": 1,
      "border-color": "#0f172a",
    },
  },
  {
    selector: "node[?stale]",
    style: {
      "border-width": 2,
      "border-color": "#b91c1c",
      "border-style": "dashed",
    },
  },
  {
    selector: 'node[status = "deprecated"]',
    style: { opacity: 0.55 },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 3,
      "border-color": "#f59e0b",
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "#cbd5e1",
      "target-arrow-color": "#cbd5e1",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "arrow-scale": 0.9,
    },
  },
  {
    selector: "edge:selected",
    style: {
      "line-color": "#f59e0b",
      "target-arrow-color": "#f59e0b",
      width: 2.5,
    },
  },
  {
    selector: ".dim",
    style: { opacity: 0.15 },
  },
];

export function Graph({ bundle, layout, search, selectedId, typeFilter, resetSignal, onSelect }) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);

  useEffect(() => {
    const graph = cytoscape({
      container: containerRef.current,
      elements: [...bundle.nodes, ...bundle.edges],
      style: GRAPH_STYLE,
      layout: { name: layout, animate: false, padding: 30 },
      maxZoom: 2,
    });
    graphRef.current = graph;

    graph.on("tap", "node", (event) => onSelect(event.target.id()));
    graph.on("tap", (event) => {
      if (event.target === graph) {
        onSelect(null);
      }
    });

    return () => {
      graphRef.current = null;
      graph.destroy();
    };
  }, [bundle, onSelect]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    graph.layout({ name: layout, animate: false, padding: 30 }).run();
  }, [layout, bundle]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    const query = search.trim().toLowerCase();
    graph.nodes().forEach((node) => {
      const data = node.data();
      const haystack = [data.label || "", data.id, ...(data.tags || [])].join(" ").toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const matchesType = !typeFilter || data.type === typeFilter;
      node.toggleClass("dim", !matchesSearch || !matchesType);
    });
    graph.edges().forEach((edge) => {
      edge.toggleClass("dim", edge.source().hasClass("dim") || edge.target().hasClass("dim"));
    });
  }, [bundle, search, typeFilter]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    graph.elements().unselect();
    if (!selectedId) {
      return;
    }
    const node = graph.getElementById(selectedId);
    if (!node.nonempty()) {
      return;
    }
    node.select();
    graph.animate(
      { center: { eles: node }, zoom: Math.max(graph.zoom(), 1) },
      { duration: 200 },
    );
  }, [bundle, selectedId]);

  useEffect(() => {
    const graph = graphRef.current;
    if (graph) {
      graph.fit(undefined, 30);
    }
  }, [resetSignal]);

  return <section ref={containerRef} className="graph" aria-label="Concept graph" />;
}
