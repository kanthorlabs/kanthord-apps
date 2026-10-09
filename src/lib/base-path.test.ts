import { afterEach, describe, expect, it } from "vitest";

import { basePath } from "./base-path";

function injectBase(href: string): void {
  const element = document.createElement("base");
  element.setAttribute("href", href);
  document.head.prepend(element);
}

afterEach(() => {
  document.querySelector("base")?.remove();
});

describe("basePath", () => {
  it("returns the root when the page has no base element", () => {
    expect(basePath()).toBe("/");
  });

  it("returns the root for a base element at the root", () => {
    injectBase("/");
    expect(basePath()).toBe("/");
  });

  it("returns the prefix without the trailing slash", () => {
    injectBase("/s/kanthord/");
    expect(basePath()).toBe("/s/kanthord");
  });

  it("returns the prefix of a base element without the trailing slash", () => {
    injectBase("/s/kanthord");
    expect(basePath()).toBe("/s/kanthord");
  });

  it("reads the path of an absolute base URL", () => {
    injectBase("https://homelab.kanthorlabs.com/s/kanthord/");
    expect(basePath()).toBe("/s/kanthord");
  });
});
