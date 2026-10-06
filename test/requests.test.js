"use strict";

// Values that come from cells, from the API or from the user and end up in a request path or query
// string must not be able to change the route or to add parameters; legitimate values must produce
// exactly the request the SDK always made (that part is pinned by listings.test.js).

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {loggedInWorld, downloadFlow, dictKeys} = require("./support/listingFlows");
const {newLoginWorld, EMAIL, PASSWORD} = require("./support/login");
const {createScenarioRunner} = require("./support/scenarios");
const {unprotectedUrlBuilders} = require("./support/setValueAudit");

const {scenario, run} = createScenarioRunner("Requests");

const srcDir = process.env.SDK_SRC_DIR || path.join(__dirname, "..", "src");
const world = newLoginWorld();

const HOSTILE = [
  "../transfer/5001", "a/b", "a?x=1&y=2", "a#fragment", "%2e%2e/x", "..", ".", "a b", "a\tb\nc", "a\\b", "áé ü", "😀 emoji", "a%b", "a&b=c",
  "100%", "x;y", "<script>", '"quoted"', "a+b", "a=b",
];

function pathPart(value) {
  return world.evaluate(`pathSegment(${JSON.stringify(value)})`);
}

function queryPart(value) {
  return world.evaluate(`queryValue(${JSON.stringify(value)})`);
}

scenario("ids, e-mails, phone numbers, dates and lists keep their exact form in a path", () => {
  for (const value of ["6001", "a@b.com", "+5511999999999", "123e4567-e89b-12d3-a456-426614174000", "01234567890", "a.b_c-d", "abc:def", "2024-03-01"]) {
    assert.equal(pathPart(value), value);
  }
  assert.equal(pathPart(5511999999999), "5511999999999");
});

scenario("ids, dates, cursors and lists keep their exact form in a query string", () => {
  for (const value of ["2024-03-01", "success", "abc123", "a.b_c-d~e", "2024-03-01T10:00:00", "a,b,c", "a@b.com", "path/like", "it's", "f(x)*!"]) {
    assert.equal(queryPart(value), value);
  }
  assert.equal(queryPart(["id1", "id2"]), "id1,id2");
  assert.equal(queryPart(5), "5");
});

scenario("a path value can not leave its segment or change the route", () => {
  for (const value of HOSTILE) {
    const encoded = pathPart(value);
    assert.match(encoded, /^[A-Za-z0-9@+._:%-]*$/, `unsafe characters left in ${JSON.stringify(value)} -> ${encoded}`);
    assert.doesNotMatch(encoded, /^(\.|%2e){1,2}$/i);
    if (!/^\.{1,2}$/.test(value)) assert.equal(decodeURIComponent(encoded), value);
  }
  // A URL is resolved with "." and ".." (also percent-encoded) as folder references.
  assert.equal(pathPart(".."), "%2E%2E%2E");
  assert.equal(pathPart("."), "%2E%2E%2E");
  assert.equal(new URL(`https://api.example/v2/dict-key/${pathPart("..")}`).pathname, "/v2/dict-key/%2E%2E%2E");
  assert.equal(pathPart("..."), "...");
});

scenario("a query value can not end its parameter or start another one", () => {
  for (const value of HOSTILE) {
    const parsed = new URLSearchParams(`a=${queryPart(value)}&b=2`);
    assert.deepEqual(Array.from(parsed.keys()), ["a", "b"], `parameters changed by ${JSON.stringify(value)}`);
    assert.equal(parsed.get("a"), value);
  }
  assert.equal(queryPart("a+b"), "a%2Bb");
});

scenario("characters that cannot be encoded do not make the request fail", () => {
  assert.equal(pathPart("a\uD800b"), "a%EF%BF%BDb");
  assert.equal(queryPart("a\uD800b"), "a%EF%BF%BDb");
});

scenario("pix keys that could change the route are sent as one path segment", () => {
  const session = loggedInWorld();
  session.api.stub("GET", /^\/dict-key\/.+$/, () => ({status: 400, body: {errors: [{code: "invalidPixKey", message: "chave inválida"}]}}));
  const sheet = session.workbook.getSheetByName("Consulta de Chave PIX");
  session.alertAnswer = "OK";

  for (const key of HOSTILE) {
    session.api.requests.length = 0;
    sheet.getRange("A11").setValue(`'${key}`);
    sheet.getRange("B11").setValue(1);

    try {
      session.invoke("getDictKey");
    } catch (error) {
      // The request is what matters here.
    }

    const requests = session.api.requests.filter(request => request.path.startsWith("/dict-key"));
    assert.equal(requests.length, 1, key);
    assert.match(requests[0].path, /^\/dict-key\/[^/]+$/, key);
    assert.deepEqual(requests[0].query, {}, key);
    assert.ok(!requests[0].url.includes("?"), key);
  }
});

scenario("document ids that could change the route are sent as one path segment", () => {
  const session = downloadFlow({charge: "../transfer/5001", transfer: "a?x=1#b", chargePayment: "a b/../c"});

  const requests = session.api.requests;
  assert.equal(requests.length, 3);
  for (const [request, prefix] of [[requests[0], "boleto"], [requests[1], "transfer"], [requests[2], "boleto-payment"]]) {
    assert.match(request.path, new RegExp(`^/${prefix}/[^/]+/pdf$`), request.path);
    assert.deepEqual(request.query, {});
  }
});

scenario("a filter value can not add parameters to a listing request", () => {
  const session = loggedInWorld();
  const hostileStatus = "success&limit=1&cursor=zzz #x";
  session.api.stub("GET", /^\/transfer$/, () => ({body: {transfers: [], cursor: null}}));

  session.invoke("ViewTransfer", "2024-03-01", "2024-03-31", hostileStatus);

  const [request] = session.api.requests.filter(item => item.path === "/transfer");
  assert.deepEqual(request.query, {after: "2024-03-01", before: "2024-03-31", status: hostileStatus});
});

scenario("a cursor with + and = reaches the API exactly as it was given", () => {
  const session = loggedInWorld();
  const cursor = "a+b==/c";
  let pages = 0;
  // A cursor the API does not recognize would make the listing ask again forever: stop after a few pages.
  session.api.stub("GET", /^\/transfer$/, request => request.query.cursor === cursor || ++pages > 3
    ? {body: {transfers: [], cursor: null}}
    : {body: {transfers: [{created: "2024-03-05T14:30:00+00:00", id: "1", amount: 1, status: "success", name: "x", taxId: "1", bankCode: "1", branchCode: "1", accountNumber: "1", transactionIds: []}], cursor}});

  session.invoke("ViewTransfer", "2024-03-01", "2024-03-31", "success");

  const requests = session.api.requests.filter(item => item.path === "/transfer");
  assert.equal(requests.length, 2, "the listing kept asking for pages");
  assert.equal(requests[1].query.cursor, cursor);
});

scenario("a + in a query value is sent as %2B, which the server reads as +", () => {
  // The original sent "+" as it was, and servers read that as a space: a cursor or a tag with "+" was
  // silently changed. This is the one legitimate value whose URL differs from the original.
  const session = loggedInWorld();
  const cursor = "a+b==/c";
  let pages = 0;
  session.api.stub("GET", /^\/transfer$/, request => request.query.cursor === cursor || ++pages > 3
    ? {body: {transfers: [], cursor: null}}
    : {body: {transfers: [{created: "2024-03-05T14:30:00+00:00", id: "1", amount: 1, status: "success", name: "x", taxId: "1", bankCode: "1", branchCode: "1", accountNumber: "1", transactionIds: []}], cursor}});

  session.invoke("ViewTransfer", "2024-03-01", "2024-03-31", "success");

  const requests = session.api.requests.filter(item => item.path === "/transfer");
  assert.ok(requests[1].url.endsWith("&cursor=a%2Bb%3D%3D/c"), requests[1].url);
});

scenario("a workspace name typed in the login can not add parameters to the lookup", () => {
  const session = newLoginWorld();
  session.invoke("CredentialsHeader");

  try {
    session.invoke("getUserInputCredential", EMAIL, "  Evil&x=1#Y  ", PASSWORD, "sandbox");
  } catch (error) {
    // The workspace does not exist: only the lookup request matters.
  }

  const lookups = session.api.requests.filter(request => request.path === "/workspace");
  assert.equal(lookups.length, 1);
  assert.deepEqual(lookups[0].query, {username: "evil&x=1#y"});
});

function sourceFiles() {
  return fs.readdirSync(srcDir).filter(file => file.endsWith(".js") && !file.startsWith("ecdsa"))
    .map(file => ({file, lines: fs.readFileSync(path.join(srcDir, file), "utf8").split("\n")}));
}

scenario("every request URL built from a variable goes through pathSegment or queryValue", () => {
  const missing = [];
  // utilsRest.js is a copy of an older SDK that is not used here (it depends on an `api` object that does not exist).
  for (const {file, lines} of sourceFiles().filter(({file}) => file !== "utilsRest.js" && file !== "keyGen.js")) {
    for (const statement of unprotectedUrlBuilders(lines.join("\n"))) missing.push(`${file}: ${statement}`);
  }
  assert.deepEqual(missing, []);
});

scenario("the URL check catches the ways a value could reach a request unprotected", () => {
  const slips = [
    'fetch("/dict-key/" + keyId)',
    'fetch(`/boleto/${id}/pdf`)',
    'let path = "/boleto/" +\n  id + "/pdf"; fetchBuffer(path)',
    'let url = "/dict-key"+ key; fetch(url)',
    'fetch("/dict-key/".concat(key))',
    'const endpoint = `/${name}/${id}`',
  ];
  for (const code of slips) assert.equal(unprotectedUrlBuilders(code).length, 1, `not caught: ${code}`);
  const fine = [
    'fetch("/dict-key/" + pathSegment(keyId))',
    'fetch("/workspace?username=" + queryValue(name))',
    'fetch("/balance")',
    'sendMessage("Falha" + "/n/n" + returnMessage)',
    '// fetch("/dict-key/" + keyId)',
  ];
  for (const code of fine) assert.equal(unprotectedUrlBuilders(code).length, 0, `flagged: ${code}`);
});

scenario("every query string value goes through queryValue", () => {
  const code = Object.fromEntries(sourceFiles().map(({file, lines}) => [file, lines.join("\n")]));
  assert.equal((code["utilsRequest.js"].match(/'=' \+ queryValue\(query\[key\]\)/g) || []).length, 2);
  assert.doesNotMatch(code["utilsRequest.js"], /'=' \+ query\[key\]/);
  assert.match(code["apiAuth.js"], /\?username=" \+ queryValue\(workspace\)/);
});

run();
