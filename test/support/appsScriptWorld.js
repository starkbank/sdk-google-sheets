"use strict";

// Simulated Google Apps Script environment used to exercise the SDK in node.
//
// Only the edges of the platform are simulated (SpreadsheetApp, PropertiesService,
// CacheService, UrlFetchApp, Utilities, Browser, HtmlService). Project code under src/
// always runs as is.
//
// Every SDK call runs in a brand new vm context, like independent Apps Script executions:
// global variables do not survive between calls, only the state kept by the simulated
// services (sheets, properties, cache) does.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// SDK_SRC_DIR lets the suite run against a copy of src/ (used to check that it catches regressions).
const srcDir = process.env.SDK_SRC_DIR || path.resolve(__dirname, "..", "..", "src");

// The Apps Script project loads every file of src/ into one global scope, so the simulation does too
// (this way accidental global name collisions between files show up in the tests).
// The ecdsa files depend on each other at load time, so they keep an explicit order; the rest is alphabetical.
const ecdsaFiles = [
  "ecdsaPoint.js",
  "ecdsaUtilsInteger.js",
  "ecdsaCurve.js",
  "ecdsaMath.js",
  "ecdsaUtilsBinary.js",
  "ecdsaUtilsBase.js",
  "ecdsaUtilsDer.js",
  "ecdsaPublicKey.js",
  "ecdsaPrivateKey.js",
  "ecdsaSignature.js",
  "ecdsa.js",
  "ecdsaEasy.js",
];
const sourceFiles = ecdsaFiles.concat(
  fs.readdirSync(srcDir)
    .filter(file => file.endsWith(".js") && !ecdsaFiles.includes(file) && file !== "ecdsaTest.js")
    .sort()
);

const sources = sourceFiles.map(file => ({
  file: path.join(srcDir, file),
  code: fs.readFileSync(path.join(srcDir, file), "utf8"),
}));

function signedBytes(buffer) {
  return Array.from(buffer, byte => byte > 127 ? byte - 256 : byte);
}

function columnNumber(letters) {
  return letters.split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

function createUtilities() {
  return {
    Charset: {UTF_8: "UTF_8"},
    DigestAlgorithm: {SHA_256: "SHA_256"},
    MacAlgorithm: {HMAC_SHA_256: "HMAC_SHA_256"},
    getUuid: crypto.randomUUID,
    computeDigest(algorithm, value, charset) {
      assert.equal(algorithm, "SHA_256");
      return signedBytes(crypto.createHash("sha256").update(value).digest());
    },
    computeHmacSignature(algorithm, value, key) {
      assert.equal(algorithm, "HMAC_SHA_256");
      return signedBytes(
        crypto.createHmac("sha256", Buffer.from(key)).update(Buffer.from(value)).digest()
      );
    },
    base64Encode(value) {
      const bytes = typeof value === "string" ? Buffer.from(value, "binary") : Buffer.from(value);
      return bytes.toString("base64");
    },
    base64Decode(value) {
      return signedBytes(Buffer.from(value, "base64"));
    },
    newBlob(input) {
      return {getBytes: () => signedBytes(Buffer.from(input, "utf8"))};
    },
    // Fixed "GMT-3" style offsets and the yyyy MM dd HH mm ss tokens, which is all the SDK uses.
    formatDate(date, timeZone, pattern) {
      const [, sign, hours] = timeZone.match(/^GMT([+-])(\d+)$/);
      const shifted = new Date(date.getTime() + (sign === "-" ? -1 : 1) * Number(hours) * 3600 * 1000);
      const pad = (value, size = 2) => String(value).padStart(size, "0");
      const tokens = {
        yyyy: pad(shifted.getUTCFullYear(), 4), MM: pad(shifted.getUTCMonth() + 1), dd: pad(shifted.getUTCDate()),
        HH: pad(shifted.getUTCHours()), mm: pad(shifted.getUTCMinutes()), ss: pad(shifted.getUTCSeconds()),
      };
      return pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, token => tokens[token]);
    },
  };
}

// Counts the calls the SDK makes to the Apps Script services: each one is a round trip in the real
// platform, so the count (not node time) is what the performance tests budget.
function countCall(calls, name) {
  calls[name] = (calls[name] || 0) + 1;
}

class FakeRange {
  constructor(sheet, row, column, rows = 1, columns = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rows = rows;
    this.columns = columns;
    // Like Apps Script, a range with no rows or columns cannot be built.
    if (rows < 1 || columns < 1) {
      throw new Error("The number of rows and columns in the range must be at least 1");
    }
  }

  count(name) {
    countCall(this.sheet.calls, `range.${name}`);
  }

  cellKeys() {
    if (this.rows < 1 || this.columns < 1) {
      throw new Error("The number of rows and columns must be at least 1");
    }
    const keys = [];
    for (let r = this.row; r < this.row + this.rows; r++) {
      for (let c = this.column; c < this.column + this.columns; c++) {
        keys.push(`${r},${c}`);
      }
    }
    return keys;
  }

  getValue() {
    this.count("getValue");
    const value = this.sheet.cells.get(`${this.row},${this.column}`);
    return value === undefined ? "" : value;
  }

  getValues() {
    this.count("getValues");
    const grid = [];
    for (let r = this.row; r < this.row + this.rows; r++) {
      const line = [];
      for (let c = this.column; c < this.column + this.columns; c++) {
        const value = this.sheet.cells.get(`${r},${c}`);
        line.push(value === undefined ? "" : value);
      }
      grid.push(line);
    }
    return grid;
  }

  assertEditable() {
    if (this.sheet.readOnly) {
      throw new Error("You do not have permission to edit this sheet");
    }
    if (this.cellKeys().some(key => this.sheet.protectedCells.has(key))) {
      throw new Error("You are trying to edit a protected cell or object");
    }
  }

  // Like Sheets, typed values come back: "123" is a number, "true"/"false" are booleans.
  static parse(value) {
    if (typeof value !== "string") return value;
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
    return value;
  }

  // Conservative model: text that starts with "=", "+" or "-" may be read as a formula (except plain
  // numbers and phones), unless it starts with an apostrophe, which forces text and is not stored.
  static looksLikeFormula(value) {
    return typeof value === "string" && (value.startsWith("=") || (/^[+-]/.test(value) && !/^[+-][\d\s().,%$+-]*$/.test(value)));
  }

  // One cell, the way Sheets reads a value that is set (setValue and setValues read values alike). A cell
  // formatted as plain text ("@") keeps text as it is: "0001" stays "0001".
  writeCell(key, value) {
    this.sheet.formulaCells.delete(key);
    if (value === null || value === undefined || value === "") {
      this.sheet.cells.delete(key);
    } else if (typeof value === "string" && this.sheet.textCells.has(key)) {
      this.sheet.cells.set(key, value.startsWith("'") ? value.slice(1) : value);
    } else if (typeof value === "string" && value.startsWith("'")) {
      this.sheet.cells.set(key, value.slice(1));
    } else {
      this.sheet.cells.set(key, FakeRange.parse(value));
      if (FakeRange.looksLikeFormula(value)) this.sheet.formulaCells.add(key);
    }
  }

  setValue(value) {
    this.count("setValue");
    this.assertEditable();
    for (const key of this.cellKeys()) {
      this.writeCell(key, value);
    }
    return this;
  }

  // Like Apps Script, the grid must have exactly the rows and columns of the range.
  setValues(grid) {
    this.count("setValues");
    if (!Array.isArray(grid) || grid.length !== this.rows) {
      throw new Error(`The number of rows in the data does not match the number of rows in the range. The data has ${grid && grid.length} but the range has ${this.rows}.`);
    }
    for (const line of grid) {
      if (!Array.isArray(line) || line.length !== this.columns) {
        throw new Error(`The number of columns in the data does not match the number of columns in the range. The data has ${line && line.length} but the range has ${this.columns}.`);
      }
    }
    this.assertEditable();
    grid.forEach((line, r) => line.forEach((value, c) => this.writeCell(`${this.row + r},${this.column + c}`, value)));
    return this;
  }

  clearContent() {
    this.count("clearContent");
    this.assertEditable();
    for (const key of this.cellKeys()) {
      this.sheet.cells.delete(key);
      this.sheet.formulaCells.delete(key);
    }
    return this;
  }

  setFontColor(color) {
    this.count("setFontColor");
    for (const key of this.cellKeys()) {
      this.sheet.fontColors.set(key, color);
    }
    return this;
  }

  setBackground() {
    this.count("setBackground");
    return this;
  }

  setNumberFormat(format) {
    this.count("setNumberFormat");
    for (const key of this.cellKeys()) {
      if (format === "@") this.sheet.textCells.add(key);
      if (format !== "@") this.sheet.textCells.delete(key);
    }
    return this;
  }

  clear() {
    this.count("clear");
    for (const key of this.cellKeys()) {
      this.sheet.cells.delete(key);
      this.sheet.formulaCells.delete(key);
      this.sheet.fontColors.delete(key);
    }
    return this;
  }
}

class FakeSheet {
  constructor(name, calls) {
    this.name = name;
    this.calls = calls;
    this.cells = new Map();
    this.fontColors = new Map();
    this.frozenRows = 0;
    this.readOnly = false;
    this.protectedCells = new Set();
    this.formulaCells = new Set();
    this.textCells = new Set();
  }

  // Every cell as "row,column|kind|value" (kind: f = formula, t = text, n = number, b = boolean),
  // in reading order, for comparing what a flow wrote into the sheet.
  snapshot() {
    return Array.from(this.cells.entries())
      .map(([key, value]) => ({key, value, kind: this.formulaCells.has(key) ? "f" : typeof value === "number" ? "n" : typeof value === "boolean" ? "b" : "t"}))
      .sort((a, b) => {
        const [ar, ac] = a.key.split(",").map(Number);
        const [br, bc] = b.key.split(",").map(Number);
        return ar - br || ac - bc;
      })
      .map(({key, value, kind}) => `${key}|${kind}|${value}`);
  }

  getRangeList(a1Notations) {
    const ranges = a1Notations.map(notation => this.getRange(notation));
    return {
      clearContent() {
        // Like Sheets, nothing is cleared if any range cannot be edited.
        ranges.forEach(range => range.assertEditable());
        ranges.forEach(range => range.clearContent());
      },
    };
  }

  getSheetName() {
    return this.name;
  }

  getName() {
    return this.name;
  }

  activate() {}

  getRange(...args) {
    countCall(this.calls, "sheet.getRange");
    if (typeof args[0] === "string") {
      const [, letters, digits, endLetters, endDigits] = args[0].match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
      const row = Number(digits);
      const column = columnNumber(letters);
      if (!endLetters) return new FakeRange(this, row, column);
      return new FakeRange(this, row, column, Number(endDigits) - row + 1, columnNumber(endLetters) - column + 1);
    }
    const [row, column, rows = 1, columns = 1] = args;
    return new FakeRange(this, row, column, rows, columns);
  }

  getMaxRows() {
    countCall(this.calls, "sheet.getMaxRows");
    return Math.max(1000, this.getLastRowUncounted());
  }

  getLastRow() {
    countCall(this.calls, "sheet.getLastRow");
    return this.getLastRowUncounted();
  }

  getLastRowUncounted() {
    let last = 0;
    for (const key of this.cells.keys()) {
      last = Math.max(last, Number(key.split(",")[0]));
    }
    return last;
  }

  setFrozenRows(rows) {
    countCall(this.calls, "sheet.setFrozenRows");
    this.frozenRows = rows;
  }

  // Every non-empty cell value as text, for "no secret leaked here" style checks.
  allValues() {
    return Array.from(this.cells.values(), value => String(value));
  }
}

class FakeWorkbook {
  constructor(sheetNames, calls) {
    this.calls = calls;
    this.sheets = new Map(sheetNames.map(name => [name, new FakeSheet(name, calls)]));
  }

  getSheets() {
    countCall(this.calls, "spreadsheet.getSheets");
    return Array.from(this.sheets.values());
  }

  getSheetByName(name) {
    countCall(this.calls, "spreadsheet.getSheetByName");
    return this.sheets.get(name) || null;
  }

  getActiveSheet() {
    countCall(this.calls, "spreadsheet.getActiveSheet");
    return this.activeSheet || this.getSheets()[0];
  }

  setActiveSheet(sheet) {
    countCall(this.calls, "spreadsheet.setActiveSheet");
    this.activeSheet = sheet;
    return sheet;
  }
}

// Platform limits of the Apps Script services (values in characters).
const LIMITS = {
  propertyKey: 50,
  propertyValue: 9 * 1024,
  propertiesTotal: 500 * 1024,
  cacheKey: 250,
  cacheValue: 100 * 1024,
  cacheDefaultTtl: 600,
  cacheMaxTtl: 21600,
};

function assertNotNull(...values) {
  if (values.some(value => value === null || value === undefined)) {
    throw new Error("Argument cannot be null");
  }
}

// The services take text: anything else is a mistake of the caller that real code would also make.
function assertText(...values) {
  if (values.some(value => typeof value !== "string")) {
    throw new Error("Argument must be a string");
  }
}

function createKeyValueStore() {
  const store = new Map();

  function set(key, value) {
    assertNotNull(key, value);
    assertText(key, value);
    // Not documented for the real service, so the code must not depend on it: it never writes empty values.
    if (value === "") throw new Error("Property values must not be empty");
    if (String(key).length > LIMITS.propertyKey) throw new Error("Argument too large: key");
    if (String(value).length > LIMITS.propertyValue) throw new Error("Argument too large: value");
    store.set(String(key), String(value));
    const total = Array.from(store).reduce((sum, [k, v]) => sum + k.length + v.length, 0);
    if (total > LIMITS.propertiesTotal) throw new Error("Properties quota exceeded");
  }

  return {
    store,
    getProperty: key => store.has(key) ? store.get(key) : null,
    setProperty(key, value) { set(key, value); return this; },
    deleteProperty(key) { store.delete(key); return this; },
    getKeys: () => Array.from(store.keys()),
    getProperties: () => Object.fromEntries(store),
    setProperties(properties, deleteAllOthers = false) {
      if (deleteAllOthers) store.clear();
      for (const [key, value] of Object.entries(properties)) set(key, value);
      return this;
    },
    deleteAllProperties() { store.clear(); return this; },
    // Test helper: loses one property (for instance an interrupted clearing).
    dropOne() { store.delete(store.keys().next().value); },
  };
}

// Cache with expiry driven by the simulated clock (seconds), like CacheService.
function createCache(clock) {
  const store = new Map();

  function live(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= clock.now) {
      store.delete(key);
      return null;
    }
    return entry.value;
  }

  function put(key, value, ttl = LIMITS.cacheDefaultTtl) {
    assertNotNull(key, value);
    assertText(key, value);
    if (String(key).length > LIMITS.cacheKey) throw new Error("Argument too large: key");
    if (String(value).length > LIMITS.cacheValue) throw new Error("Argument too large: value");
    store.set(String(key), {value: String(value), expiresAt: clock.now + Math.min(ttl, LIMITS.cacheMaxTtl)});
  }

  return {
    get: key => live(key),
    getAll: keys => Object.fromEntries(keys.filter(key => live(key) !== null).map(key => [key, live(key)])),
    put,
    putAll(values, ttl) { for (const [key, value] of Object.entries(values)) put(key, value, ttl); },
    remove(key) { store.delete(key); },
    removeAll(keys) { for (const key of keys) store.delete(key); },
    // Test helper: the cache may drop entries before their TTL; drops the nth oldest one.
    evictOne(index = 0) { store.delete(Array.from(store.keys())[index]); },
    // Test helper: every value still alive.
    liveValues: () => Array.from(store.keys(), live).filter(value => value !== null),
  };
}

// Minimal Stark Bank API double. It verifies every request signature with node:crypto,
// independently of the SDK implementation.
class StarkApi {
  constructor({memberPublicKeyPem}) {
    this.memberPublicKeyPem = memberPublicKeyPem;
    this.requests = [];
    this.workspaces = new Map();
    this.challenges = new Map();
    this.sessions = new Map();
    this.rejectChallenge = false;
    this.unavailable = false;
    this.failRevocation = false;
    this.stubs = [];
    this.sequence = 0;
  }

  registerWorkspace(username, id) {
    this.workspaces.set(username, [{id, username}]);
  }

  // Adds an endpoint that answers {status, body} (body is turned into JSON) for signed requests; {status, raw}
  // answers raw text (a gateway's HTML page) and {throws} makes the request itself fail (no answer).
  stub(method, pathPattern, handler) {
    this.stubs.push({method, pathPattern, handler});
  }

  setChallengeStatus(challengeId, status) {
    this.challenges.get(challengeId).status = status;
  }

  lastRequest(method, pathName) {
    return this.requests.filter(request => request.method === method && request.path === pathName).pop();
  }

  publicKeyFor(accessId) {
    if (accessId.startsWith("workspace/")) return this.memberPublicKeyPem;
    if (accessId.startsWith("session/")) {
      const session = this.sessions.get(accessId.split("/")[1]);
      return session && session.publicKeyPem;
    }
    return undefined;
  }

  signatureIsValid(headers, payload) {
    const accessId = headers["Access-Id"];
    const publicKeyPem = this.publicKeyFor(accessId || "");
    if (!publicKeyPem || !headers["Access-Signature"]) return false;
    let message = `${accessId}:${headers["Access-Time"]}:${payload}`;
    if (headers["Access-Challenge-Ids"]) message += `:${headers["Access-Challenge-Ids"]}`;
    return crypto.verify(
      "sha256",
      Buffer.from(message),
      publicKeyPem,
      Buffer.from(headers["Access-Signature"], "base64")
    );
  }

  handle(url, options) {
    if (this.unavailable) {
      throw new Error("Service unavailable");
    }
    const parsed = new URL(url);
    const method = (options && options.method) || "GET";
    const headers = (options && options.headers) || {};
    const payload = (options && options.payload) || "";
    const pathName = parsed.pathname.replace(/^\/v2/, "");
    const environment = parsed.hostname.startsWith("sandbox.") ? "sandbox"
      : parsed.hostname.startsWith("development.") ? "development"
      : "production";

    const request = {
      method,
      url,
      path: pathName,
      query: Object.fromEntries(parsed.searchParams),
      host: parsed.hostname,
      environment,
      headers,
      payload,
      accessId: headers["Access-Id"],
      signed: Boolean(headers["Access-Signature"]),
      signatureValid: null,
    };
    this.requests.push(request);

    if (pathName === "/workspace") {
      return this.ok({workspaces: this.workspaces.get(parsed.searchParams.get("username")) || []});
    }

    request.signatureValid = this.signatureIsValid(headers, payload);
    if (!request.signatureValid) {
      return this.fail(401, "invalidSignature", "Invalid signature");
    }

    if (method === "POST" && pathName === "/challenge") {
      if (this.rejectChallenge) return this.fail(400, "invalidCredentials", "Credenciais inválidas");
      const challengeRequest = JSON.parse(payload).challenges[0];
      const id = `challenge-${++this.sequence}`;
      this.challenges.set(id, {id, status: "pending", requestBody: challengeRequest.requestBody});
      return this.ok({challenges: [{id, qrcode: `QRCODE-${id}`}]});
    }

    const challengeMatch = pathName.match(/^\/challenge\/(.+)$/);
    if (method === "GET" && challengeMatch) {
      const challenge = this.challenges.get(challengeMatch[1]);
      return challenge ? this.ok({challenge: {id: challenge.id, status: challenge.status}})
        : this.fail(404, "invalidChallenge", "Challenge not found");
    }

    if (method === "POST" && pathName === "/session") {
      const challenge = this.challenges.get(headers["Access-Challenge-Ids"]);
      if (!challenge || challenge.status !== "approved" || challenge.requestBody !== payload) {
        return this.fail(400, "invalidChallenge", "Challenge not approved");
      }
      const id = `session-${++this.sequence}`;
      this.sessions.set(id, {id, publicKeyPem: JSON.parse(payload).publicKey});
      return this.ok({session: {id}});
    }

    const revocation = pathName.match(/^\/auth\/session\/(.+)$/);
    // failRevocation: true answers an error, "unreachable" makes the request itself fail.
    if (method === "DELETE" && revocation && this.failRevocation === "unreachable") {
      throw new Error("Service unavailable");
    }
    if (method === "DELETE" && revocation && this.failRevocation) {
      return this.fail(500, "internalServerError", "Could not revoke");
    }
    if (method === "DELETE" && revocation) {
      return this.sessions.delete(revocation[1]) ? this.ok({}) : this.fail(404, "invalidSession", "Session not found");
    }

    for (const {method: stubMethod, pathPattern, handler} of this.stubs) {
      if (stubMethod === method && pathPattern.test(pathName)) {
        const {status = 200, body, raw, throws} = handler(request);
        if (throws) throw new Error(throws);
        return {status, body: raw !== undefined ? raw : JSON.stringify(body)};
      }
    }

    if (pathName.includes("/missing")) return this.fail(404, "invalidId", "Not found");

    if (pathName === "/balance") return this.ok({balance: {amount: 1000}});

    if (/^\/(transfer|auth)(\/|$)/.test(pathName)) return this.ok({});

    return this.fail(404, "routeNotFound", `Unknown route ${method} ${pathName}`);
  }

  ok(body) {
    return {status: 200, body: JSON.stringify(body)};
  }

  fail(status, code, message) {
    return {status, body: JSON.stringify({errors: [{code, message}]})};
  }
}

function createWorld({memberPublicKeyPem = null} = {}) {
  const serviceCalls = {};
  const workbook = new FakeWorkbook([
    "Credentials",
    "paymentRequestExternal",
    "Solicitação de Cartões",
    "Transferências",
    "Consulta de Transferência",
    "Consulta de Boleto",
    "Consulta de Invoices Emitidas",
    "Consulta de Chave PIX",
    "Transferência com Aprovação",
    "Extrato",
    "Consulta de Pagamento Boleto",
    "Consulta de Clientes",
    "Consulta de Aprovações",
    "Histórico de Boletos Emitidos",
    "Split Consultas",
    "Emissão de Boletos",
    "Cadastro de Clientes",
    "Pagamento de Boletos",
    "Emissão de Invoice Pix",
    "Split Receivers",
    "corporateShopKits",
  ], serviceCalls);
  const api = new StarkApi({memberPublicKeyPem});
  const browserMessages = [];
  const logs = [];
  const alerts = [];
  const clock = {now: 0};
  const world = {
    workbook,
    serviceCalls,
    // Forgets the calls made so far (for instance while preparing the sheets of a test).
    resetServiceCalls() { for (const name of Object.keys(serviceCalls)) delete serviceCalls[name]; },
    // Calls to the spreadsheet, its sheets and ranges.
    sheetCalls() {
      return Object.entries(serviceCalls)
        .filter(([name]) => /^(spreadsheet|sheet|range)\./.test(name))
        .reduce((total, [, count]) => total + count, 0);
    },
    driveFiles: [],
    api,
    browserMessages,
    logs,
    alerts,
    alertAnswer: "YES",
    properties: {user: createKeyValueStore(), document: createKeyValueStore(), script: createKeyValueStore()},
    clock,
    caches: {user: createCache(clock), document: createCache(clock), script: createCache(clock)},
    currentUser: "default",
    dialogs: [],
    currentContext: null,
    // Moves the simulated time forward (affects cache expiry only, not the SDK's Date).
    advanceTime(seconds) { clock.now += seconds; },
  };

  const ui = {
    ButtonSet: {YES_NO: "YES_NO", OK_CANCEL: "OK_CANCEL"},
    Button: {YES: "YES", NO: "NO", OK: "OK", CANCEL: "CANCEL"},
    alert(message) { alerts.push(message); return world.alertAnswer; },
    showModalDialog(output, title) { world.dialogs.push({title, content: output.getContent()}); },
  };

  // An html file of the project as an HtmlOutput. The file may not exist (some dialogs of the original
  // project refer to files that are not in the repository): its content is empty then.
  const htmlFile = (name, evaluate = null) => {
    const file = path.join(srcDir, `${name}.html`);
    let content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (evaluate) content = content.replace(/<\?!=\s*(.+?)\s*\?>/g, (match, expression) => evaluate(expression));
    const output = {getContent: () => content, setHeight() { return output; }, setWidth() { return output; }};
    return output;
  };

  // People who share the spreadsheet (and the container-bound script) have their own user properties
  // and user cache. world.properties.user / world.caches.user always point to the current person's.
  const people = {default: {properties: world.properties.user, cache: world.caches.user}};
  world.switchUser = id => {
    people[id] = people[id] || {properties: createKeyValueStore(), cache: createCache(clock)};
    world.currentUser = id;
    world.properties.user = people[id].properties;
    world.caches.user = people[id].cache;
  };

  world.services = {
    console,
    Utilities: createUtilities(),
    Logger: {log(message) { logs.push(String(message)); }},
    Browser: {msgBox(message) { browserMessages.push(message); }},
    HtmlService: {
      createHtmlOutputFromFile: name => htmlFile(name),
      // Like Apps Script: the <?!= expression ?> scriptlets are evaluated by the project's own code.
      createTemplateFromFile: name => ({
        evaluate: () => htmlFile(name, expression => vm.runInContext(expression, world.currentContext)),
      }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => { countCall(serviceCalls, "SpreadsheetApp.getActiveSpreadsheet"); return workbook; },
      getActiveSheet: () => workbook.getActiveSheet(),
      getUi: () => ui,
    },
    PropertiesService: {
      getUserProperties: () => { countCall(serviceCalls, "PropertiesService.getUserProperties"); return world.properties.user; },
      getDocumentProperties: () => world.properties.document,
      getScriptProperties: () => world.properties.script,
    },
    CacheService: {
      getUserCache: () => { countCall(serviceCalls, "CacheService.getUserCache"); return world.caches.user; },
      getDocumentCache: () => world.caches.document,
      getScriptCache: () => world.caches.script,
    },
    UrlFetchApp: {
      fetch(url, options) {
        countCall(serviceCalls, "UrlFetchApp.fetch");
        return answer(api.handle(url, options), options);
      },
      // Like Apps Script: every request is {url, ...options}, the answers keep the order of the requests,
      // and an error answer without muteHttpExceptions makes the whole call throw.
      fetchAll(requests) {
        countCall(serviceCalls, "UrlFetchApp.fetchAll");
        const answers = requests.map(({url, ...options}) => api.handle(url, options));
        return answers.map((answered, index) => answer(answered, requests[index]));
      },
    },
    DriveApp: {
      getRootFolder: () => driveFolder("root"),
    },
  };

  // Without muteHttpExceptions, Apps Script throws on an error answer instead of returning it.
  function answer(answered, options) {
    if (answered.status >= 400 && !(options && options.muteHttpExceptions)) {
      throw new Error(`Request failed returned code ${answered.status}. Truncated server response: ${answered.body}`);
    }
    return response(answered);
  }

  function response({status, body}) {
    return {
      getResponseCode: () => status,
      getContentText: () => body,
      getAs: contentType => ({contentType, content: body}),
    };
  }

  // Folders are found by name (or created); files remember their folder and the name they get.
  function driveFolder(name) {
    return {
      name,
      getFoldersByName(child) {
        countCall(serviceCalls, "DriveApp.getFoldersByName");
        const path = `${name}/${child}`;
        let found = world.driveFolders.has(path);
        return {next() { if (!found) throw new Error("Cannot retrieve the next object: iterator has reached the end."); found = false; return driveFolder(path); }};
      },
      createFolder(child) {
        countCall(serviceCalls, "DriveApp.createFolder");
        world.driveFolders.add(`${name}/${child}`);
        return driveFolder(`${name}/${child}`);
      },
      createFile(blob) {
        countCall(serviceCalls, "DriveApp.createFile");
        const file = {folder: name, content: blob && blob.content, name: null};
        world.driveFiles.push(file);
        return {setName(fileName) { file.name = fileName; return this; }};
      },
    };
  }
  world.driveFolders = new Set();

  // Runs one SDK function in a fresh context (an independent Apps Script execution).
  // Results are returned as plain JSON data so they compare cleanly across vm realms.
  function freshContext() {
    const context = vm.createContext({...world.services});
    for (const {file, code} of sources) {
      vm.runInContext(code, context, {filename: file});
    }
    world.currentContext = context;
    return context;
  }

  world.invoke = (functionName, ...args) => {
    const context = freshContext();
    context.__args = args;
    const result = vm.runInContext(`${functionName}(...__args)`, context);
    return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
  };

  // Same as invoke, but for code that is expected to throw: returns the error message.
  world.invokeExpectingError = (functionName, ...args) => {
    try {
      world.invoke(functionName, ...args);
    } catch (error) {
      // The SDK sometimes throws plain strings (JSON) instead of Error objects.
      return error && error.message !== undefined ? error.message : String(error);
    }
    throw new assert.AssertionError({message: `${functionName} was expected to throw`});
  };

  // Runs an arbitrary expression in a fresh context.
  world.evaluate = expression => {
    const context = freshContext();
    const result = vm.runInContext(expression, context);
    return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
  };

  return world;
}

module.exports = {createWorld};
