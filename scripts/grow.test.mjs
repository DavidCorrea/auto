import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseEdit,
  applyEdit,
  chooseVisibleFiles,
  describeFile,
  renderPrompt,
  RejectedEdit,
  MAX_FILE_CHARS,
} from "./grow.mjs";

const site = new Map([
  ["index.html", "<h1>Hello.</h1>\n<p>Hi</p>\n"],
  ["about.html", "<p>About</p>\n"],
  ["style.css", "body { color: black; }\n"],
]);
const visible = ["index.html", "style.css"];

const reply = (file, find, replace) =>
  `FILE: ${file}\nSUMMARY: change it\n<<<<<<< FIND\n${find}\n=======\n${replace}\n>>>>>>> REPLACE`;

describe("reading the model's reply", () => {
  test("extracts the edit even when wrapped in a code fence", () => {
    const edit = parseEdit("```\n" + reply("index.html", "<p>Hi</p>", "<p>Hey</p>") + "\n```");
    assert.deepEqual(edit, { filePath: "index.html", summary: "change it", find: "<p>Hi</p>", replace: "<p>Hey</p>" });
  });

  test("accepts an empty FIND for a new file", () => {
    const edit = parseEdit("FILE: a.css\nSUMMARY: s\n<<<<<<< FIND\n=======\nbody{}\n>>>>>>> REPLACE");
    assert.equal(edit.find, "");
    assert.equal(edit.replace, "body{}");
  });

  test("rejects free-form prose", () => {
    assert.throws(() => parseEdit("I changed the heading!"), RejectedEdit);
  });
});

describe("choosing what the model sees", () => {
  test("always shows index.html plus one other file", () => {
    assert.deepEqual(chooseVisibleFiles(site, () => 0), ["index.html", "about.html"]);
    assert.deepEqual(chooseVisibleFiles(site, () => 1), ["index.html", "style.css"]);
  });

  test("shows only index.html when it is the whole site", () => {
    assert.deepEqual(chooseVisibleFiles(new Map([["index.html", "x"]])), ["index.html"]);
  });

  test("maps HTML files with their title and description", () => {
    const html = `<title>The  Garden</title><meta name="description" content="Plants that appeared.">`;
    assert.equal(describeFile("garden.html", html), `garden.html  (${html.length} chars)  "The Garden"  — Plants that appeared.`);
  });

  test("maps other files by size only", () => {
    assert.equal(describeFile("style.css", "<title>no</title>"), "style.css  (17 chars)");
  });

  test("lists every file in the map but only visible files in full", () => {
    const prompt = renderPrompt(site, visible);
    assert.match(prompt, /about\.html {2}\(13 chars\)/);
    assert.doesNotMatch(prompt, /===== about\.html/);
    assert.match(prompt, /===== style\.css =====\nbody/);
  });
});

describe("applying an edit", () => {
  test("replaces the unique match", () => {
    const result = applyEdit(parseEdit(reply("index.html", "<p>Hi</p>", "<p>$& Hey</p>")), site, visible);
    assert.equal(result.content, "<h1>Hello.</h1>\n<p>$& Hey</p>\n");
  });

  test("creates a new file", () => {
    const result = applyEdit({ filePath: "garden/index.html", find: "", replace: "<p>Garden</p>" }, site, visible);
    assert.deepEqual(result, { filePath: "garden/index.html", content: "<p>Garden</p>" });
  });

  test("rejects editing a file that wasn't shown in full", () => {
    assert.throws(
      () => applyEdit({ filePath: "about.html", find: "<p>About</p>", replace: "<p>Us</p>" }, site, visible),
      /isn't shown in full/,
    );
  });

  test("rejects text that isn't in the file", () => {
    assert.throws(() => applyEdit({ filePath: "index.html", find: "<p>Nope</p>", replace: "x" }, site, visible), /0 times/);
  });

  test("rejects paths outside the site", () => {
    const outside = (filePath) => () => applyEdit({ filePath, find: "", replace: "x" }, site, visible);
    assert.throws(outside("../.github/workflows/grow.yml"), RejectedEdit);
    assert.throws(outside("/etc/passwd.txt"), RejectedEdit);
  });

  test("rejects non-web file types", () => {
    assert.throws(() => applyEdit({ filePath: "run.sh", find: "", replace: "x" }, site, visible), /must end in/);
  });

  test("rejects edits that aren't small", () => {
    assert.throws(() => applyEdit({ filePath: "big.html", find: "", replace: "x".repeat(5000) }, site, visible), /under/);
  });

  test("rejects overwriting an existing file via empty FIND", () => {
    assert.throws(() => applyEdit({ filePath: "index.html", find: "", replace: "x" }, site, visible), /already exists/);
  });

  describe("when a file is full", () => {
    const nearlyFull = "a".repeat(MAX_FILE_CHARS - 10) + "<p>end</p>";
    const fullSite = new Map([["index.html", nearlyFull]]);

    test("rejects growing it past the limit", () => {
      const edit = { filePath: "index.html", find: "<p>end</p>", replace: "<p>end</p><p>more</p>" };
      assert.throws(() => applyEdit(edit, fullSite, ["index.html"]), /new file/);
    });

    test("still allows shrinking a file that is already over the limit", () => {
      const overSite = new Map([["index.html", "a".repeat(MAX_FILE_CHARS + 50) + "<p>end</p>"]]);
      const result = applyEdit({ filePath: "index.html", find: "<p>end</p>", replace: "" }, overSite, ["index.html"]);
      assert.equal(result.content.length, MAX_FILE_CHARS + 50);
    });
  });
});
