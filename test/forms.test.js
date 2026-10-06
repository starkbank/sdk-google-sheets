"use strict";

// The dialogs show messages that carry data from the API and from the spreadsheet. They must be
// shown as text, never interpreted as HTML.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {formFiles, readForm, resolvedForm, loadForm} = require("./support/formHarness");
const {newLoginWorld} = require("./support/login");
const {createScenarioRunner} = require("./support/scenarios");

const {scenario, run} = createScenarioRunner("Forms");

const MALICIOUS = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
const files = formFiles();
const srcDir = process.env.SDK_SRC_DIR || path.join(__dirname, "..", "src");
const allPages = fs.readdirSync(srcDir).filter(file => file.endsWith(".html")).sort();
const HTML_SINKS = /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write\(|\beval\(|\.html\(|\.append\(|\.prepend\(|\.after\(|\.before\(|\.replaceWith\(|srcdoc/;

scenario("there are forms to check", () => {
  assert.ok(files.length >= 16);
});

scenario("no page writes HTML", () => {
  assert.ok(allPages.length >= 17);
  for (const file of allPages) {
    assert.doesNotMatch(fs.readFileSync(path.join(srcDir, file), "utf8"), HTML_SINKS, `${file} writes HTML`);
  }
});

const INCLUDE = "<?!= includeHtml_('alertMessage') ?>";
// Nothing in this repository opens FormBoletoPaymentRequest: if the spreadsheet template opens it with
// createHtmlOutputFromFile, an include would be shown as text, so it keeps its own copy of the helper.
const KEEPS_ITS_OWN_COPY = ["FormBoletoPaymentRequest.html"];

function helperOf(html) {
  const start = html.indexOf("function setAlertMessage");
  return start === -1 ? null : html.slice(start, html.indexOf("\n  }\n", start)).trim();
}

scenario("the helper that shows messages as text is written once and shared", () => {
  const shared = helperOf(readForm("alertMessage.html"));
  assert.ok(shared);
  for (const file of files) {
    const html = readForm(file);
    if (KEEPS_ITS_OWN_COPY.includes(file)) {
      assert.equal(helperOf(html), shared, `${file} has a different copy of the helper`);
    } else if (html.includes("setAlertMessage(")) {
      assert.ok(html.includes(INCLUDE), `${file} uses the helper without including it`);
      assert.equal(helperOf(html), null, `${file} has its own copy of the helper`);
    }
  }
});

scenario("the pages that include the helper are opened as templates, and only those", () => {
  const code = fs.readdirSync(srcDir).filter(file => file.endsWith(".js")).map(file => fs.readFileSync(path.join(srcDir, file), "utf8")).join("\n");
  for (const file of files) {
    const name = file.replace(".html", "");
    const asTemplate = code.includes(`createTemplateFromFile('${name}')`);
    const asFile = code.includes(`createHtmlOutputFromFile('${name}')`);
    const includes = readForm(file).includes("<?");
    assert.ok(!(asTemplate && asFile), `${name} is opened both ways`);
    if (includes) assert.ok(!asFile, `${name} has a template tag but is opened as a plain file`);
    if (asTemplate) assert.ok(includes, `${name} is opened as a template but has no template tag`);
  }
});

scenario("the only template tags in the pages are the include of the shared helper", () => {
  for (const file of files) {
    const html = readForm(file);
    const tags = html.match(/<\?[^>]*\?>/g) || [];
    assert.ok(tags.every(tag => tag === INCLUDE), `${file}: ${tags}`);
    // Every "<?" opens the include: a scriptlet with a ">" inside or one that is never closed is not missed.
    assert.equal((html.match(/<\?/g) || []).length, tags.length, `${file} has a template tag that is not the include`);
  }
});

scenario("opening a dialog gives the page with the helper in place and nothing left to evaluate", () => {
  const world = newLoginWorld("sandbox");

  world.invoke("signInDialog");

  const [dialog] = world.dialogs;
  assert.equal(dialog.content, resolvedForm("FormCredentials.html"));
  assert.ok(dialog.content.includes("function setAlertMessage"));
  assert.ok(!dialog.content.includes("<?"));
});

scenario("every page that includes the helper gets it through the code of the project", () => {
  const world = newLoginWorld("sandbox");
  const names = files.filter(file => readForm(file).includes(INCLUDE)).map(file => file.replace(".html", ""));

  assert.ok(names.length >= 14);
  for (const name of names) {
    const content = world.evaluate(`HtmlService.createTemplateFromFile(${JSON.stringify(name)}).evaluate().getContent()`);
    assert.equal(content, resolvedForm(`${name}.html`), name);
    assert.equal((content.match(/function setAlertMessage/g) || []).length, 1, name);
  }
});

for (const file of files) {
  scenario(`${file}: script load works and messages are shown as text`, () => {
    const page = loadForm(file);
    if (!page.has("setAlertMessage")) {
      return;
    }
    const target = page.element("alert-message");

    page.call("setAlertMessage", target, `first ${MALICIOUS}<br>second`);

    assert.deepEqual(target.describe(), [`text:first ${MALICIOUS}`, "br", "text:second"]);
    assert.deepEqual(page.createdTags, ["br"]);
    assert.deepEqual(page.htmlWrites, []);

    // Like innerHTML: the previous message is replaced, null is empty, every <br> spelling breaks the line.
    page.call("setAlertMessage", target, "only this");
    assert.deepEqual(target.describe(), ["text:only this"]);
    page.call("setAlertMessage", target, null);
    assert.deepEqual(target.describe(), ["text:"]);
    page.call("setAlertMessage", target, undefined);
    assert.deepEqual(target.describe(), ["text:undefined"]);
    page.call("setAlertMessage", target, "a<BR>b<br/>c<br />d");
    assert.deepEqual(target.describe(), ["text:a", "br", "text:b", "br", "text:c", "br", "text:d"]);
  });

  scenario(`${file}: an API error with HTML is shown as text, one line per sub error`, () => {
    const page = loadForm(file);
    if (!page.has("onFailure")) {
      return;
    }
    const error = {message: JSON.stringify({
      message: `Erro ${MALICIOUS}`,
      errors: [{message: `Element 3: falha ${MALICIOUS}`}, {message: "Element 4: outra"}],
    })};

    try {
      page.call("onFailure", error);
    } catch (thrown) {
      // FormRedirect and FormPayBoleto never showed errors (alertMessage is not defined there), as before.
      assert.ok(thrown instanceof Error || thrown.name === "ReferenceError", String(thrown));
      assert.deepEqual(page.htmlWrites, [], `${file} wrote HTML`);
      return;
    }

    assert.deepEqual(page.htmlWrites, [], `${file} wrote HTML`);
    const shown = page.element("alert-message").describe();
    assert.ok(shown.every(piece => piece.startsWith("text:") || piece === "br"));
    assert.ok(page.createdTags.every(tag => tag === "br"), `${file} created ${page.createdTags}`);
    // Forms that show the API error show it as text, line by line; the others show their own text.
    if (shown[0] === `text:Erro ${MALICIOUS}` && shown.length > 1) {
      assert.deepEqual(shown.slice(1), ["br", `text:Linha 14: falha ${MALICIOUS}`, "br", "text:Linha 15: outra"]);
    }
  });
}

scenario("the file name picked in the upload forms is shown as text", () => {
  for (const file of ["FormSendTransfer.html", "FormSendTransaction.html"]) {
    const page = loadForm(file);
    // The forms show only the last part of the path, so the name itself must not contain a slash.
    const name = '<img src=x onerror="alert(1)">';
    page.element("file-input").value = `C:\\fakepath\\${name}.pem`;

    page.call("loadPrivateKey", {target: {files: [{}]}});

    assert.deepEqual(page.element("file-input-label").describe(), [`text:${name}.pem`], file);
    assert.deepEqual(page.htmlWrites, [], file);
  }
});

run();
