"use strict";

// Loads the inline script of a Form*.html file in a vm with a small fake browser (DOM, jQuery and
// google.script.run), so tests can drive the real handlers of the dialogs.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const srcDir = process.env.SDK_SRC_DIR || path.join(__dirname, "..", "..", "src");

class FakeNode {
  // Every string written as HTML, so tests can tell whether a page ever interprets data as markup.
  static htmlWrites = [];

  constructor(tag, text = "") {
    this.tag = tag;
    this.text = text;
    this.children = [];
  }

  set textContent(value) {
    this.children = [];
    this.text = String(value);
  }

  // Only what the original forms needed: plain text with "<br>" line breaks. Any other markup is
  // kept as text here, so tests with markup must not be run against the original forms.
  set innerHTML(value) {
    FakeNode.htmlWrites.push(String(value));
    this.text = "";
    this.children = [];
    String(value === null ? "" : value).split(/<br\s*\/?>/i).forEach((line, index) => {
      if (index > 0) this.children.push(new FakeNode("br"));
      this.children.push(new FakeNode("#text", line));
    });
  }

  get textContent() {
    return this.text + this.children.map(child => child.tag === "#text" ? child.text : "").join("");
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  // What the user would see: text pieces and line breaks, in order.
  describe() {
    if (this.children.length === 0) return this.text ? [`text:${this.text}`] : [];
    return this.children.map(child => child.tag === "#text" ? `text:${child.text}` : child.tag);
  }
}

function formFiles() {
  return fs.readdirSync(srcDir).filter(file => /^Form.*\.html$/.test(file)).sort();
}

function readForm(file) {
  return fs.readFileSync(path.join(srcDir, file), "utf8");
}

// The page as the browser gets it: the <?!= includeHtml_('name') ?> of the dialogs that share a piece
// of page are replaced by the content of that file, as includeHtml_() does in the project.
function resolvedForm(file) {
  return readForm(file).replace(/<\?!=\s*includeHtml_\('(\w+)'\)\s*\?>/g, (match, name) => readForm(`${name}.html`));
}

// The inline scripts of the page (the ones with no attributes), in order.
function pageScript(file) {
  return Array.from(resolvedForm(file).matchAll(/<script>([\s\S]*?)<\/script\s*>/gi), match => match[1]).join("\n");
}

function loadForm(file) {
  const script = pageScript(file);
  FakeNode.htmlWrites = [];
  const page = {htmlWrites: FakeNode.htmlWrites, elements: new Map(), createdTags: [], serverCalls: [], closed: 0, intervals: [], clearedIntervals: 0};

  const runner = (handlers = {}) => new Proxy({}, {
    get(target, property) {
      if (property === "withSuccessHandler") return success => runner({...handlers, success});
      if (property === "withFailureHandler") return failure => runner({...handlers, failure});
      return (...args) => { page.serverCalls.push({name: property, args, ...handlers}); };
    },
  });

  const chainable = new Proxy(function () {}, {get: () => chainable, apply: () => chainable});
  const context = vm.createContext({
    $: () => chainable,
    JSON,
    window: {scrollTo() {}},
    document: {
      getElementById(id) {
        if (!page.elements.has(id)) page.elements.set(id, new FakeNode("div"));
        return page.elements.get(id);
      },
      createElement(tag) { page.createdTags.push(tag); return new FakeNode(tag); },
      createTextNode(text) { return new FakeNode("#text", text); },
      querySelector: () => new FakeNode("div"),
    },
    google: {script: {run: runner(), host: {close() { page.closed += 1; }, setHeight() {}, setWidth() {}}}},
    setInterval(fn) { page.intervals.push(fn); return page.intervals.length; },
    clearInterval() { page.clearedIntervals += 1; },
    setTimeout: () => 1,
    clearTimeout() {},
    console: {log() {}},
    // Enough for the upload forms: reading the file does nothing here.
    FileReader: class { readAsText() {} },
  });
  vm.runInContext(script, context);
  // A browser runs the page's onload handler once the script is loaded.
  if (typeof context.window.onload === "function") {
    context.window.onload();
  }

  page.context = context;
  page.element = id => context.document.getElementById(id);
  page.call = (name, ...args) => { context.__args = args; return vm.runInContext(`${name}(...__args)`, context); };
  page.has = name => vm.runInContext(`typeof ${name} === "function"`, context);
  return page;
}

module.exports = {formFiles, readForm, resolvedForm, loadForm};
