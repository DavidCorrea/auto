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
  HANDOFF_FILE,
  DIRECTORY_FILE,
  findLinks,
  countInboundLinks,
  renderDirectory,
} from "./grow.mjs";

const site = new Map([
  ["index.html", "<h1>Hello.</h1>\n<p>Hi</p>\n"],
  ["about.html", "<p>About</p>\n"],
  ["style.css", "body { color: black; }\n"],
  ["next.txt", "Try a dark theme.\n"],
]);
const visible = ["index.html", "style.css"];

const reply = (file, find, replace) =>
  `FILE: ${file}\nSUMMARY: change it\nNEXT: make a new page\n<<<<<<< FIND\n${find}\n=======\n${replace}\n>>>>>>> REPLACE`;

describe("reading the model's reply", () => {
  test("extracts the edit even when wrapped in a code fence", () => {
    const edit = parseEdit("```\n" + reply("index.html", "<p>Hi</p>", "<p>Hey</p>") + "\n```");
    assert.deepEqual(edit, {
      filePath: "index.html",
      summary: "change it",
      next: "make a new page",
      find: "<p>Hi</p>",
      replace: "<p>Hey</p>",
      isDeletion: false,
    });
  });

  test("accepts an empty FIND for a new file", () => {
    const edit = parseEdit("FILE: a.css\nSUMMARY: s\nNEXT: n\n<<<<<<< FIND\n=======\nbody{}\n>>>>>>> REPLACE");
    assert.equal(edit.find, "");
    assert.equal(edit.replace, "body{}");
  });

  test("rejects free-form prose", () => {
    assert.throws(() => parseEdit("I changed the heading!"), RejectedEdit);
  });

  test("reads a deletion", () => {
    const edit = parseEdit("FILE: old.html\nSUMMARY: s\nNEXT: n\nDELETE FILE");
    assert.deepEqual(edit, { filePath: "old.html", summary: "s", next: "n", isDeletion: true });
  });

  test("rejects a reply that leaves no note for the next change", () => {
    const withoutNext = "FILE: a.css\nSUMMARY: s\n<<<<<<< FIND\n=======\nbody{}\n>>>>>>> REPLACE";
    assert.throws(() => parseEdit(withoutNext), /NEXT/);
  });
});

describe("choosing what the model sees", () => {
  test("always shows index.html plus one other file", () => {
    assert.deepEqual(chooseVisibleFiles(site, () => 0), ["index.html", "about.html"]);
    assert.deepEqual(chooseVisibleFiles(site, () => 1), ["index.html", "style.css"]);
  });

  test("never picks the handoff note as the random file", () => {
    for (let index = 0; index < 3; index++) {
      assert.notEqual(chooseVisibleFiles(site, () => index)[1], HANDOFF_FILE);
    }
  });

  test("opens with the previous note", () => {
    assert.match(renderPrompt(site, visible), /^## Note from the previous change\nTry a dark theme\.\n/);
  });

  test("says when there is no note yet", () => {
    assert.match(renderPrompt(new Map([["index.html", "x"]]), ["index.html"]), /none yet/);
  });

  test("shows only index.html when it is the whole site", () => {
    assert.deepEqual(chooseVisibleFiles(new Map([["index.html", "x"]])), ["index.html"]);
  });

  test("maps HTML files with their title and description", () => {
    const html = `<title>The  Garden</title><meta name="description" content="Plants that appeared.">`;
    assert.equal(
      describeFile("garden.html", html, 2),
      `garden.html  (${html.length} chars, linked from 2 files)  "The Garden"  — Plants that appeared.`,
    );
  });

  test("maps other files by size only", () => {
    assert.equal(describeFile("style.css", "<title>no</title>", 1), "style.css  (17 chars, linked from 1 file)");
  });

  test("marks files that are nearly full", () => {
    const line = describeFile("index.html", "x".repeat(MAX_FILE_CHARS - 10), 0);
    assert.match(line, new RegExp(`\\(${MAX_FILE_CHARS - 10} chars of ${MAX_FILE_CHARS} — full, linked from 0 files\\)`));
  });

  test("lists every file in the map but only visible files in full", () => {
    const prompt = renderPrompt(site, visible);
    assert.match(prompt, /about\.html {2}\(13 chars, linked from 0 files\)/);
    assert.doesNotMatch(prompt, /===== about\.html/);
    assert.match(prompt, /===== style\.css =====\nbody/);
  });
});

describe("following links between files", () => {
  const linked = new Map([
    ["index.html", `<a href="about.html">a</a> <a href="/blog/">b</a> <link href="css/site.css"> <a href="https://x.com/y.html">x</a>`],
    ["about.html", `<a href="./index.html#top">home</a> <img src="missing.png">`],
    ["blog/index.html", `<a href="../about.html?ref=blog">about</a>`],
    ["css/site.css", "body{}"],
    ["orphan.html", "<p>alone</p>"],
    [DIRECTORY_FILE, `<a href="orphan.html">o</a>`],
  ]);

  test("resolves relative, root-relative and folder links, ignoring external and missing targets", () => {
    assert.deepEqual([...findLinks("index.html", linked.get("index.html"), linked)].sort(), [
      "about.html",
      "blog/index.html",
      "css/site.css",
    ]);
    assert.deepEqual([...findLinks("blog/index.html", linked.get("blog/index.html"), linked)], ["about.html"]);
  });

  test("counts inbound links without crediting the generated directory", () => {
    const counts = countInboundLinks(linked);
    assert.equal(counts.get("about.html"), 2);
    assert.equal(counts.get("index.html"), 1);
    assert.equal(counts.get("orphan.html"), 0);
  });
});

describe("the generated directory", () => {
  const pages = new Map([
    ["index.html", "<title>Home</title>"],
    ["odd.html", `<title>A <b>bold</b> & "odd" room</title><meta name="description" content="Strange.">`],
    ["style.css", "body{}"],
    [DIRECTORY_FILE, "old"],
  ]);
  const directory = renderDirectory(pages);

  test("lists every HTML page except itself", () => {
    assert.match(directory, /<a href="index\.html">Home<\/a>/);
    assert.match(directory, /2 pages\./);
    assert.doesNotMatch(directory, /style\.css">|rooms\.html">/);
  });

  test("escapes titles and descriptions written by agents", () => {
    assert.match(directory, /A &#60;b&#62;bold&#60;\/b&#62; &#38; &#34;odd&#34; room<\/a> — Strange\./);
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

  test("rejects editing the handoff note directly", () => {
    assert.throws(
      () => applyEdit({ filePath: "next.txt", find: "Try a dark theme.", replace: "x" }, site, [...visible, "next.txt"]),
      /NEXT line/,
    );
  });

  test("rejects editing the generated directory", () => {
    const withDirectory = new Map([...site, [DIRECTORY_FILE, "<ul></ul>"]]);
    assert.throws(
      () => applyEdit({ filePath: DIRECTORY_FILE, find: "<ul>", replace: "<ol>" }, withDirectory, [DIRECTORY_FILE]),
      /generated automatically/,
    );
  });

  test("deletes any existing file, even one not shown in full", () => {
    assert.deepEqual(applyEdit({ filePath: "about.html", isDeletion: true }, site, visible), {
      filePath: "about.html",
      content: null,
    });
  });

  test("refuses to delete the entrance or a file that doesn't exist", () => {
    assert.throws(() => applyEdit({ filePath: "index.html", isDeletion: true }, site, visible), /entrance/);
    assert.throws(() => applyEdit({ filePath: "gone.html", isDeletion: true }, site, visible), /does not exist/);
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
