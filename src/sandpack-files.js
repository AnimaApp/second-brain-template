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

export function readSandpackBrain(browserFS = globalThis.BrowserFS) {
  const fileSystem = browserFS?.BFSRequire?.("fs");
  if (!fileSystem) {
    throw new Error("Sandpack BrowserFS is unavailable");
  }

  const files = {};
  const visit = (directory) => {
    for (const name of fileSystem.readdirSync(directory).sort()) {
      const path = `${directory}/${name}`;
      if (fileSystem.statSync(path).isDirectory()) {
        visit(path);
      } else if (path.endsWith(".md")) {
        files[path] = fileSystem.readFileSync(path, "utf8");
      }
    }
  };

  visit("/brain");
  return files;
}
