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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import { Group, Mesh, MeshBasicMaterial, SphereGeometry } from "three";
import SpriteText from "three-spritetext";

import { buildUndirectedEdges } from "./brain.js";

const GRAPH_THEMES = {
  light: {
    text: "#191c22",
    edge: "#b8c0cc",
    accent: "#1a56d0",
    bg: "#edeff3",
  },
  dark: {
    text: "#e6e9ee",
    edge: "#3b434f",
    accent: "#74a0ff",
    bg: "#0e1116",
  },
};

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const parsed = Number.parseInt(value, 16);
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(from, to, ratio) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const mix = (start, end) => Math.round(start + (end - start) * ratio);
  return rgbToHex(mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b));
}

export function Graph({ bundle, matchingIds, selectedId, resetSignal, theme, onSelect }) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const colors = GRAPH_THEMES[theme] || GRAPH_THEMES.light;

  const nodes = useMemo(() => bundle.nodes.map((node) => node.data), [bundle]);
  const links = useMemo(
    () => buildUndirectedEdges(bundle.edges).map((edge) => edge.data),
    [bundle],
  );
  const graphData = useMemo(() => ({ nodes, links }), [nodes, links]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const nodeColor = useCallback(
    (node) => {
      if (!matchingIds.has(node.id)) {
        return mixHex(node.color, colors.bg, 0.85);
      }
      if (node.status === "deprecated") {
        return mixHex(node.color, colors.bg, 0.45);
      }
      return node.color;
    },
    [matchingIds, colors],
  );

  const linkColor = useCallback(
    (link) => {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source;
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      if (!matchingIds.has(sourceId) || !matchingIds.has(targetId)) {
        return mixHex(colors.edge, colors.bg, 0.85);
      }
      if (selectedId && (sourceId === selectedId || targetId === selectedId)) {
        return colors.accent;
      }
      return colors.edge;
    },
    [matchingIds, selectedId, colors],
  );

  const linkWidth = useCallback(
    (link) => {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source;
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      if (selectedId && (sourceId === selectedId || targetId === selectedId)) {
        return 1.4; // thicker highlight for edges touching the selected node
      }
      return 0.8; // base edge thickness; try 0 for the library's default hairline
    },
    [selectedId],
  );

  const nodeThreeObject = useCallback(
    (node) => {
      const dimmed = !matchingIds.has(node.id);

      const sprite = new SpriteText(node.label);
      sprite.color = dimmed ? mixHex(colors.text, colors.bg, 0.7) : colors.text;
      sprite.textHeight = 3;
      sprite.center.y = -1.5; // shift above node, matching the react-force-graph text-nodes example

      if (!node.stale && node.id !== selectedId) {
        return sprite;
      }

      const group = new Group();
      group.add(sprite);

      if (node.stale) {
        const halo = new Mesh(
          new SphereGeometry(2, 8, 8),
          new MeshBasicMaterial({
            color: "#b91c1c",
            wireframe: true,
            transparent: true,
            opacity: dimmed ? 0.25 : 0.9,
          }),
        );
        group.add(halo);
      }

      if (node.id === selectedId) {
        const ring = new Mesh(
          new SphereGeometry(node.stale ? 3 : 2, 12, 12),
          new MeshBasicMaterial({ color: colors.accent, wireframe: true }),
        );
        group.add(ring);
      }

      return group;
    },
    [matchingIds, selectedId, colors],
  );

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !dimensions.width || !dimensions.height) {
      return undefined;
    }
    const timeoutId = setTimeout(() => graph.zoomToFit(400, 30), 250);
    return () => clearTimeout(timeoutId);
  }, [graphData, dimensions.width, dimensions.height]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !selectedId) {
      return;
    }
    const node = nodes.find((candidate) => candidate.id === selectedId);
    if (!node || !Number.isFinite(node.x)) {
      return;
    }
    // Keep the camera's current distance/angle relative to its target (i.e. don't
    // change zoom), just shift that same offset so it now looks at the selected node.
    const { x: camX, y: camY, z: camZ } = graph.cameraPosition();
    const target = graph.controls()?.target;
    const offset = {
      x: camX - (target?.x ?? 0),
      y: camY - (target?.y ?? 0),
      z: camZ - (target?.z ?? 0),
    };
    graph.cameraPosition(
      { x: node.x + offset.x, y: node.y + offset.y, z: node.z + offset.z },
      node,
      600,
    );
  }, [nodes, selectedId]);

  useEffect(() => {
    graphRef.current?.zoomToFit(400, 30);
  }, [resetSignal]);

  function changeZoom(factor) {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    const { x, y, z } = graph.camera().position;
    const scale = 1 / factor;
    graph.cameraPosition({ x: x * scale, y: y * scale, z: z * scale }, undefined, 200);
  }

  function fitGraph() {
    graphRef.current?.zoomToFit(400, 30);
  }

  return (
    <section className="graph" aria-label="Concept graph">
      <div ref={containerRef} className="graph-canvas">
        {dimensions.width > 0 && dimensions.height > 0 ? (
          <ForceGraph3D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            backgroundColor={colors.bg}
            showNavInfo={false}
            nodeLabel={() => ""}
            nodeColor={nodeColor}
            nodeThreeObjectExtend={true}
            nodeThreeObject={nodeThreeObject}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkResolution={6}
            onNodeClick={(node) => onSelect(node.id)}
            onBackgroundClick={() => onSelect(null)}
          />
        ) : null}
      </div>
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
