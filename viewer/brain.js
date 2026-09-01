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

import { parse as parseYaml } from "yaml";

const RESERVED_NAMES = new Set(["index.md", "log.md"]);
const TYPE_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];
const LINK_RE = /\]\(([^)\s]+\.md)(?:#[A-Za-z0-9_-]*)?\)/g;
const OFFSET_RE = /(?:Z|[+-]\d{2}:\d{2})$/;

function isMapping(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseDocument(text) {
  const lines = text.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== "---") {
    return { frontmatter: {}, body: text };
  }

  const endIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (endIndex === -1) {
    throw new Error("Unterminated YAML frontmatter block");
  }

  const delimiterIndex = endIndex + 1;
  let frontmatter;
  try {
    frontmatter = parseYaml(lines.slice(1, delimiterIndex).join("\n"), { schema: "core" }) ?? {};
  } catch (error) {
    throw new Error(`Invalid YAML in frontmatter: ${error.message}`);
  }
  if (!isMapping(frontmatter)) {
    throw new Error("Frontmatter must be a YAML mapping");
  }

  let body = lines.slice(delimiterIndex + 1).join("\n");
  if (body.startsWith("\n")) {
    body = body.slice(1);
  }
  return { frontmatter, body };
}

export function normalizeVerified(frontmatter) {
  const verified = frontmatter.verified;
  if (isMapping(verified)) {
    return [verified];
  }
  if (Array.isArray(verified)) {
    return verified.filter(isMapping);
  }
  return [];
}

export function trustTier(frontmatter) {
  const verified = normalizeVerified(frontmatter);
  if (!verified.length) {
    return "unverified";
  }
  return verified.some((event) => String(event.by || "").startsWith("human:"))
    ? "human-reviewed"
    : "machine-confirmed";
}

export function isStale(frontmatter, now = new Date()) {
  const staleAfter = String(frontmatter.stale_after || "");
  if (!staleAfter.includes("T") || !OFFSET_RE.test(staleAfter)) {
    return false;
  }
  const instant = new Date(staleAfter);
  return !Number.isNaN(instant.getTime()) && now.getTime() >= instant.getTime();
}

export function conceptIdFromPath(path) {
  return path.replace(/^\/?brain\//, "").replace(/\.md$/, "");
}

export function isReservedPath(path) {
  const name = path.split("/").at(-1);
  return RESERVED_NAMES.has(name);
}

function typeColor(typeName) {
  let hash = 2166136261;
  for (const character of typeName) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return TYPE_COLORS[(hash >>> 0) % TYPE_COLORS.length];
}

export function resolveConceptLink(href, conceptId, conceptIds) {
  const path = href.split("#", 1)[0];
  if (!path.endsWith(".md")) {
    return null;
  }

  const parts = path.startsWith("/")
    ? path.slice(1).split("/")
    : [...conceptId.split("/").slice(0, -1), ...path.split("/")];
  const normalized = [];
  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      if (!normalized.length) {
        return null;
      }
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }

  const target = normalized.join("/").replace(/\.md$/, "");
  return conceptIds.has(target) ? target : null;
}

export function buildBacklinks(edges) {
  const backlinks = {};
  for (const edge of edges) {
    const { source, target } = edge.data;
    (backlinks[target] ||= []).push(source);
  }
  return backlinks;
}

export function buildUndirectedEdges(edges) {
  const pairs = new Set();
  const undirected = [];

  for (const edge of edges) {
    const { source, target } = edge.data;
    const [left, right] = source.localeCompare(target) <= 0
      ? [source, target]
      : [target, source];
    const pair = `${left}\0${right}`;
    if (pairs.has(pair)) {
      continue;
    }
    pairs.add(pair);
    undirected.push({
      ...edge,
      data: {
        ...edge.data,
        id: `${left}__${right}`,
        source: left,
        target: right,
      },
    });
  }

  return undirected;
}

function extractLinkPaths(body) {
  return [...body.matchAll(LINK_RE)].map((match) => match[1]);
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return value ? [String(value)] : [];
}

function normalizeSources(value) {
  if (isMapping(value)) {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter(isMapping);
  }
  return [];
}

export function buildBundle(files, { name = "brain", now = new Date() } = {}) {
  const concepts = [];
  const errors = [];

  for (const [path, text] of Object.entries(files).sort(([left], [right]) => left.localeCompare(right))) {
    if (isReservedPath(path)) {
      continue;
    }
    try {
      const { frontmatter, body } = parseDocument(text);
      const id = conceptIdFromPath(path);
      const type = String(frontmatter.type || "Unknown");
      concepts.push({
        id,
        type,
        title: String(frontmatter.title || id),
        description: String(frontmatter.description || ""),
        resource: String(frontmatter.resource || ""),
        tags: normalizeTags(frontmatter.tags),
        body,
        status: String(frontmatter.status || "stable"),
        generated: isMapping(frontmatter.generated) ? frontmatter.generated : {},
        verified: normalizeVerified(frontmatter),
        staleAfter: String(frontmatter.stale_after || ""),
        sources: normalizeSources(frontmatter.sources),
        trustTier: trustTier(frontmatter),
        stale: isStale(frontmatter, now),
        linkPaths: extractLinkPaths(body),
      });
    } catch (error) {
      errors.push({ path: conceptIdFromPath(path), message: error.message });
    }
  }

  const ids = new Set(concepts.map((concept) => concept.id));
  const nodes = concepts.map((concept) => {
    const color = typeColor(concept.type);
    return {
      data: {
        id: concept.id,
        label: concept.title,
        type: concept.type,
        description: concept.description,
        resource: concept.resource,
        tags: concept.tags,
        status: concept.status,
        generated: concept.generated,
        verified: concept.verified,
        stale_after: concept.staleAfter,
        sources: concept.sources,
        trust_tier: concept.trustTier,
        stale: concept.stale,
        color,
        size: 30 + Math.min(60, Math.floor(concept.body.length / 200)),
      },
    };
  });

  const edges = [];
  const seenEdges = new Set();
  for (const concept of concepts) {
    for (const href of concept.linkPaths) {
      const target = resolveConceptLink(href, concept.id, ids);
      const key = `${concept.id}\0${target}`;
      if (!target || target === concept.id || seenEdges.has(key)) {
        continue;
      }
      seenEdges.add(key);
      edges.push({
        data: {
          id: `${concept.id}__${target}`,
          source: concept.id,
          target,
        },
      });
    }
  }

  const types = [...new Set(concepts.map((concept) => concept.type))].sort();
  return {
    name,
    nodes,
    edges,
    bodies: Object.fromEntries(concepts.map((concept) => [concept.id, concept.body])),
    types,
    palette: Object.fromEntries(types.map((type) => [type, typeColor(type)])),
    errors,
  };
}
