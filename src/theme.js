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

export const THEME_STORAGE_KEY = "okf-viewer-theme";

export function readStoredTheme(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    const stored = target?.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

export function preferredTheme(media) {
  try {
    const target = media === undefined
      ? globalThis.matchMedia?.("(prefers-color-scheme: dark)")
      : media;
    return target?.matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveTheme(theme, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The current choice still applies when storage is unavailable.
  }
}
