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

import { buildUndirectedEdges } from "./brain.js";

const GRAPH_THEMES = {
  light: {
    text: "#191c22",
    border: "#596170",
    edge: "#b8c0cc",
    accent: "#1a56d0",
  },
  dark: {
    text: "#e6e9ee",
    border: "#9ea7b3",
    edge: "#3b434f",
    accent: "#74a0ff",
  },
};

function graphStyle(theme) {
  const colors = GRAPH_THEMES[theme] || GRAPH_THEMES.light;
  return [
    {
      selector: "node",
      style: {
        "background-color": "data(color)",
        label: "data(label)",
        color: colors.text,
        "font-size": 11,
        "text-valign": "bottom",
        "text-margin-y": 4,
        "text-wrap": "wrap",
        "text-max-width": 120,
        width: "data(size)",
        height: "data(size)",
        "border-width": 1,
        "border-color": colors.border,
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
        "border-color": colors.accent,
      },
    },
    {
      selector: "edge",
      style: {
        width: 1.5,
        "line-color": colors.edge,
        "curve-style": "bezier",
      },
    },
    {
      selector: "edge:selected",
      style: {
        "line-color": colors.accent,
        width: 2.5,
      },
    },
    {
      selector: ".dim",
      style: { opacity: 0.15 },
    },
  ];
}

export function Graph({ bundle, matchingIds, selectedId, resetSignal, theme, onSelect }) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);

  useEffect(() => {
    const graph = cytoscape({
      container: containerRef.current,
      elements: [...bundle.nodes, ...buildUndirectedEdges(bundle.edges)],
      style: graphStyle(theme),
      layout: { name: "cose", animate: false, padding: 30 },
      minZoom: 0.2,
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
    if (graph) {
      graph.style(graphStyle(theme));
    }
  }, [theme]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    graph.layout({ name: "cose", animate: false, padding: 30 }).run();
  }, [bundle]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    graph.nodes().forEach((node) => {
      node.toggleClass("dim", !matchingIds.has(node.id()));
    });
    graph.edges().forEach((edge) => {
      edge.toggleClass("dim", edge.source().hasClass("dim") || edge.target().hasClass("dim"));
    });
  }, [bundle, matchingIds]);

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

  function changeZoom(factor) {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    const level = Math.min(graph.maxZoom(), Math.max(graph.minZoom(), graph.zoom() * factor));
    graph.zoom({
      level,
      renderedPosition: { x: graph.width() / 2, y: graph.height() / 2 },
    });
  }

  function fitGraph() {
    graphRef.current?.fit(undefined, 30);
  }

  return (
    <section className="graph" aria-label="Concept graph">
      <div ref={containerRef} className="graph-canvas" />
      <div className="graph-controls" aria-label="Graph zoom controls">
        <button type="button" aria-label="Zoom in" onClick={() => changeZoom(1.2)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => changeZoom(1 / 1.2)}>
          −
        </button>
        <button className="graph-fit" type="button" aria-label="Fit graph to view" onClick={fitGraph}>
          Fit
        </button>
      </div>
    </section>
  );
}
