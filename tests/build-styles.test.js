import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { stripComments, tidy, STYLE_SOURCES } = require("../scripts/build-styles.js");

// app.css is a concatenation of src/styles/*.css with the comments taken out.
// The comments are half the file, and they are the whole reason this step
// exists — but a stripper that misreads one character corrupts a stylesheet
// silently, and the only gate downstream is a browser. So the parsing rules
// are pinned here.
describe("stripComments", () => {
  it("takes a comment out and leaves the rule", () => {
    expect(stripComments("a { /* why */ color: red; }")).toBe("a {  color: red; }");
  });

  it("takes a comment spanning lines out", () => {
    expect(stripComments("/* one\n   two */\na { color: red; }")).toBe("\na { color: red; }");
  });

  it("keeps a bang-comment, which is how the banner survives its own pass", () => {
    expect(stripComments("/*! keep */\n/* drop */\na{}")).toBe("/*! keep */\n\na{}");
  });

  // The case a regex gets wrong: an opener inside a string is not an opener,
  // and a naive replace eats from there to the next terminator anywhere in
  // the file — silently deleting whole stylesheets downstream.
  it("does not treat an opener inside a string as a comment", () => {
    const css = `a::before { content: "/*"; color: red; }`;
    expect(stripComments(css)).toBe(css);
  });

  it("does not treat a terminator inside a string as a terminator", () => {
    const css = `a::before { content: "*/"; }\n/* gone */\nb{}`;
    expect(stripComments(css)).toBe(`a::before { content: "*/"; }\n\nb{}`);
  });

  it("handles both quote styles and an escaped quote", () => {
    const css = `a::before { content: '\\'/*'; }`;
    expect(stripComments(css)).toBe(css);
  });

  // CSS ends an unterminated string at the newline. Without that rule a stray
  // quote would put the tokenizer in "inside a string" for the rest of the
  // file and no comment after it would ever be stripped.
  it("ends an unterminated string at the newline", () => {
    expect(stripComments(`a { content: "oops;\n}\n/* gone */`)).toBe(`a { content: "oops;\n}\n`);
  });

  it("runs an unterminated comment to the end rather than throwing", () => {
    expect(stripComments("a{}\n/* never closed")).toBe("a{}\n");
  });

  it("leaves a url containing slashes alone", () => {
    const css = `a { background: url(https://x/y.png); }`;
    expect(stripComments(css)).toBe(css);
  });
});

describe("tidy", () => {
  it("collapses the blank runs a stripped comment leaves behind", () => {
    expect(tidy("a{}\n\n\n\n\nb{}")).toBe("a{}\n\nb{}");
  });

  it("drops the indentation that led into a comment", () => {
    expect(tidy("a{}\n   \nb{}")).toBe("a{}\n\nb{}");
  });

  it("does not open the file with the gap a leading comment left", () => {
    expect(tidy("\n\n\na{}")).toBe("a{}");
  });

  it("leaves a single blank line between rules alone", () => {
    expect(tidy("a{}\n\nb{}")).toBe("a{}\n\nb{}");
  });
});

// The failure this catches: add a file to src/styles/ and forget to register
// it. Nothing breaks loudly — the rules simply never reach the browser, and the
// page is subtly wrong in a way no other check sees.
describe("STYLE_SOURCES", () => {
  it("lists every stylesheet in src/styles, and nothing that is gone", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(import.meta.dirname, "..", "src", "styles");
    const onDisk = fs.readdirSync(dir).filter(name => name.endsWith(".css")).sort();
    const registered = STYLE_SOURCES.map(rel => path.basename(rel)).sort();
    expect(registered).toEqual(onDisk);
  });

  it("is in the order the numeric prefixes imply, because order is the cascade", () => {
    const names = STYLE_SOURCES.map(rel => rel.split("/").pop());
    expect(names).toEqual([...names].sort());
  });
});
