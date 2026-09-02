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

import { readSandpackBrain } from "./sandpack-files.js";

function browserFS(files) {
  const directories = new Set(["/", "/brain"]);
  for (const path of Object.keys(files)) {
    const parts = path.split("/").slice(1, -1);
    let directory = "";
    for (const part of parts) {
      directory += `/${part}`;
      directories.add(directory);
    }
  }

  return {
    BFSRequire(name) {
      expect(name).toBe("fs");
      return {
        readdirSync(directory) {
          const prefix = `${directory}/`;
          return [...new Set(
            [...directories, ...Object.keys(files)]
              .filter((path) => path.startsWith(prefix))
              .map((path) => path.slice(prefix.length).split("/")[0])
              .filter(Boolean),
          )];
        },
        statSync(path) {
          return { isDirectory: () => directories.has(path) };
        },
        readFileSync(path, encoding) {
          expect(encoding).toBe("utf8");
          return files[path];
        },
      };
    },
  };
}

describe("Sandpack brain files", () => {
  it("reads Markdown files recursively from the mounted project", () => {
    const files = readSandpackBrain(browserFS({
      "/brain/index.md": "# Brain",
      "/brain/projects/example.md": "# Example",
      "/brain/projects/data.json": "{}",
    }));

    expect(files).toEqual({
      "/brain/index.md": "# Brain",
      "/brain/projects/example.md": "# Example",
    });
  });

  it("fails clearly outside Sandpack", () => {
    expect(() => readSandpackBrain(undefined)).toThrow("Sandpack BrowserFS is unavailable");
  });
});
