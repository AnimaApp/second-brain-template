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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { buildBacklinks, resolveConceptLink } from "./brain.js";

function formatActorEvent(event) {
  if (!event?.by) {
    return "—";
  }
  return event.at ? `${event.by} · ${event.at}` : String(event.by);
}

function Badge({ className, children }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function Detail({ bundle, selectedId, onSelect }) {
  const nodeIndex = useMemo(
    () => Object.fromEntries(bundle.nodes.map((node) => [node.data.id, node.data])),
    [bundle.nodes],
  );
  const conceptIds = useMemo(() => new Set(Object.keys(nodeIndex)), [nodeIndex]);
  const backlinks = useMemo(() => buildBacklinks(bundle.edges), [bundle.edges]);
  const data = selectedId ? nodeIndex[selectedId] : null;

  if (!data) {
    return (
      <section className="detail">
        <div className="detail-empty muted">Click a node to see its details.</div>
      </section>
    );
  }

  const status = data.status || "stable";
  const tier = data.trust_tier || "unverified";
  const citedBy = backlinks[selectedId] || [];

  const MarkdownLink = ({ href = "", children }) => {
    const target = resolveConceptLink(href, selectedId, conceptIds);
    if (target) {
      return (
        <a
          className="internal"
          href={href}
          onClick={(event) => {
            event.preventDefault();
            onSelect(target);
          }}
        >
          {children}
        </a>
      );
    }
    return (
      <a className="external" href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  };

  return (
    <section className="detail">
      <article>
        <header className="detail-header">
          <span className="type-chip" style={{ background: data.color }}>
            {data.type}
          </span>
          <h1>{data.label}</h1>
          <div className="muted">{selectedId}</div>
        </header>

        <div className="badges">
          <Badge className={`status-${status}`}>{status}</Badge>
          <Badge className={`trust-${tier}`}>{tier.replaceAll("-", " ")}</Badge>
          {data.stale ? (
            <Badge className="stale">
              {data.stale_after ? `stale (since ${data.stale_after})` : "stale"}
            </Badge>
          ) : data.stale_after ? (
            <Badge className="fresh">stale after {data.stale_after}</Badge>
          ) : null}
        </div>

        <dl className="frontmatter">
          <dt>Description</dt>
          <dd>{data.description || "—"}</dd>
          <dt>Resource</dt>
          <dd>
            {data.resource ? (
              <a className="external" href={data.resource} target="_blank" rel="noopener noreferrer">
                {data.resource}
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dt>Tags</dt>
          <dd>
            {data.tags?.length
              ? data.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))
              : "—"}
          </dd>
          <dt>Generated</dt>
          <dd>{formatActorEvent(data.generated)}</dd>
          <dt>Verified</dt>
          <dd>
            {data.verified?.length ? data.verified.map(formatActorEvent).join("; ") : "—"}
          </dd>
          <dt>Sources</dt>
          <dd>
            {data.sources?.length ? (
              <ul className="sources-list">
                {data.sources.map((source, index) => {
                  const label = source.title || source.resource || source.id || "source";
                  return (
                    <li key={`${source.id || source.resource || label}-${index}`}>
                      {source.resource && /^https?:\/\//.test(source.resource) ? (
                        <a
                          className="external"
                          href={source.resource}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {label}
                        </a>
                      ) : source.resource ? (
                        `${label} (${source.resource})`
                      ) : (
                        label
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              "—"
            )}
          </dd>
        </dl>

        <hr />
        <div className="detail-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>
            {bundle.bodies[selectedId] || ""}
          </ReactMarkdown>
        </div>

        {citedBy.length ? (
          <section className="detail-backlinks">
            <h2>Cited by</h2>
            <ul>
              {citedBy.map((source) => (
                <li key={source}>
                  <button className="link-button" type="button" onClick={() => onSelect(source)}>
                    {nodeIndex[source]?.label || source}
                  </button>
                  <span className="muted"> ({source})</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </section>
  );
}
