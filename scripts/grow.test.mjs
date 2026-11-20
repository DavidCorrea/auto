import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseEdit, applyEdit, RejectedEdit } from "./grow.mjs";

const site = new Map([["index.html", "<h1>Hello.</h1>\n<p>Hi</p>\n"]]);

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

describe("applying an edit", () => {
  test("replaces the unique match", () => {
    const result = applyEdit(parseEdit(reply("index.html", "<p>Hi</p>", "<p>$& Hey</p>")), site);
    assert.equal(result.content, "<h1>Hello.</h1>\n<p>$& Hey</p>\n");
  });

  test("creates a new file", () => {
    const result = applyEdit({ filePath: "about/index.html", find: "", replace: "<p>About</p>" }, site);
    assert.deepEqual(result, { filePath: "about/index.html", content: "<p>About</p>" });
  });

  test("rejects text that isn't in the file", () => {
    assert.throws(() => applyEdit({ filePath: "index.html", find: "<p>Nope</p>", replace: "x" }, site), /0 times/);
  });

  test("rejects paths outside the site", () => {
    assert.throws(() => applyEdit({ filePath: "../.github/workflows/grow.yml", find: "", replace: "x" }, site), RejectedEdit);
    assert.throws(() => applyEdit({ filePath: "/etc/passwd.txt", find: "", replace: "x" }, site), RejectedEdit);
  });

  test("rejects non-web file types", () => {
    assert.throws(() => applyEdit({ filePath: "run.sh", find: "", replace: "x" }, site), /must end in/);
  });

  test("rejects edits that aren't small", () => {
    assert.throws(() => applyEdit({ filePath: "big.html", find: "", replace: "x".repeat(5000) }, site), /under/);
  });

  test("rejects overwriting an existing file via empty FIND", () => {
    assert.throws(() => applyEdit({ filePath: "index.html", find: "", replace: "x" }, site), /already exists/);
  });
});
