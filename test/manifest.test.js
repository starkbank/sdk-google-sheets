"use strict";

// The script declares the permissions it asks for. They must be exactly what the services it uses
// need: nothing missing (the script would fail at run time) and nothing extra (the script would ask
// the user for more than it uses). A new service makes this test fail on purpose, to review the scopes.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {blankComments} = require("./support/setValueAudit");
const {createScenarioRunner} = require("./support/scenarios");

const {scenario, run} = createScenarioRunner("Manifest");

const srcDir = process.env.SDK_SRC_DIR || path.join(__dirname, "..", "src");
const SCOPES = {
  sheet: "https://www.googleapis.com/auth/spreadsheets.currentonly",
  ui: "https://www.googleapis.com/auth/script.container.ui",
  externalRequest: "https://www.googleapis.com/auth/script.external_request",
  drive: "https://www.googleapis.com/auth/drive",
};
// Apps Script services the SDK may use and the scopes each one needs (none for the ones that need no permission).
const SERVICES = {
  SpreadsheetApp: [SCOPES.sheet, SCOPES.ui],
  Browser: [SCOPES.ui],
  HtmlService: [],
  UrlFetchApp: [SCOPES.externalRequest],
  DriveApp: [SCOPES.drive],
  PropertiesService: [],
  CacheService: [],
  Utilities: [],
  Logger: [],
};
// Services that would need permissions the SDK does not have: using one has to be a decision.
const NOT_USED = ["GmailApp", "MailApp", "CalendarApp", "DocumentApp", "SlidesApp", "FormApp", "ContactsApp", "ScriptApp", "Session", "LockService", "CardService", "GroupsApp", "UserSymbolTable"];

function code() {
  return fs.readdirSync(srcDir).filter(file => file.endsWith(".js") && !file.startsWith("ecdsa"))
    .map(file => ({file, text: blankComments(fs.readFileSync(path.join(srcDir, file), "utf8")).replace(/(["'`])(?:\\.|(?!\1).)*\1/g, match => `${match[0]}${" ".repeat(match.length - 2)}${match[0]}`)}));
}

function usedServices() {
  const used = new Set();
  for (const {text} of code()) {
    for (const name of [...Object.keys(SERVICES), ...NOT_USED]) {
      if (new RegExp(`\\b${name}\\.`).test(text)) used.add(name);
    }
  }
  return used;
}

const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, "appsscript.json"), "utf8"));

scenario("the SDK only uses services whose permissions are declared and reviewed", () => {
  const used = usedServices();

  assert.deepEqual(Array.from(used).filter(name => NOT_USED.includes(name)), []);
  for (const name of ["SpreadsheetApp", "Browser", "HtmlService", "UrlFetchApp", "DriveApp", "PropertiesService", "CacheService"]) {
    assert.ok(used.has(name), `${name} is expected to be used`);
  }
});

scenario("the manifest declares exactly the scopes the services in use need", () => {
  const needed = new Set();
  for (const name of usedServices()) for (const scope of SERVICES[name] || []) needed.add(scope);

  assert.ok(Array.isArray(manifest.oauthScopes), "the scopes are not declared, so Apps Script infers them");
  assert.deepEqual(Array.from(new Set(manifest.oauthScopes)).sort(), Array.from(needed).sort());
  assert.equal(manifest.oauthScopes.length, new Set(manifest.oauthScopes).size);
});

scenario("the manifest keeps what it already declared", () => {
  assert.equal(manifest.runtimeVersion, "V8");
  assert.equal(manifest.timeZone, "America/Argentina/Buenos_Aires");
  assert.equal(manifest.exceptionLogging, "STACKDRIVER");
});

scenario("the broad spreadsheet permission is not used", () => {
  // An exact match on the list of scopes (a Set), not a search for text inside a URL.
  assert.ok(!new Set(manifest.oauthScopes || []).has("https://www.googleapis.com/auth/spreadsheets"));
});

scenario("the helpers of the login that handle keys and sessions cannot be called from a dialog", () => {
  // Apps Script lets a dialog call any top-level function whose name does not end with "_".
  const code = fs.readFileSync(path.join(srcDir, "apiAuth.js"), "utf8");
  for (const name of ["requireHandshake", "isLoginCompleted", "purgeLegacyCredentials", "revokeLegacySession", "revokeCurrentSession"]) {
    assert.match(code, new RegExp(`function ${name}_\\(`), `${name}_ should exist`);
    assert.doesNotMatch(code, new RegExp(`function ${name}\\(`), `${name} is callable from a dialog`);
  }
});

scenario("the manifest check notices a service that needs another permission", () => {
  assert.ok(NOT_USED.includes("MailApp") && !SERVICES.MailApp);
  const text = blankComments('MailApp.sendEmail("a@b.com", "x", "y"); // GmailApp.send()');
  assert.ok(/\bMailApp\./.test(text) && !/\bGmailApp\./.test(text));
});

run();
