"use strict";

// People who share a spreadsheet share its cells, but each one has their own session. Who they are
// (workspace, e-mail, environment, name, workspace id) must come with the session, not from the cells.

const assert = require("node:assert/strict");
const {newLoginWorld, login, EMAIL, PASSWORD} = require("./support/login");
const {createScenarioRunner} = require("./support/scenarios");

const {scenario, run} = createScenarioRunner("Shared sheet");

function twoPeople() {
  const world = newLoginWorld("sandbox");
  world.api.registerWorkspace("otherworkspace", "9");
  world.switchUser("ana");
  login(world);
  world.switchUser("bruno");
  login(world, "otherworkspace");
  world.switchUser("ana");
  return world;
}

function identity(world) {
  const user = world.evaluate("new getDefaultUser()");
  return {workspace: user.workspace, email: user.email, environment: user.environment, name: user.name, workspaceId: String(user.workspaceId)};
}

const ANA = {workspace: "myworkspace", email: EMAIL, environment: "sandbox", name: "myworkspace", workspaceId: "5"};
const BRUNO = {workspace: "otherworkspace", email: EMAIL, environment: "sandbox", name: "otherworkspace", workspaceId: "9"};

scenario("each person keeps their own identity when someone else logs in on the same spreadsheet", () => {
  const world = twoPeople();

  assert.deepEqual(identity(world), ANA);
  world.switchUser("bruno");
  assert.deepEqual(identity(world), BRUNO);
});

scenario("the requests of each person are signed with their own session and workspace", () => {
  const world = twoPeople();
  world.api.requests.length = 0;

  world.evaluate('fetch("/balance")');
  world.switchUser("bruno");
  world.evaluate('fetch("/balance")');

  const [anaRequest, brunoRequest] = world.api.requests;
  assert.equal(anaRequest.signatureValid, true);
  assert.equal(brunoRequest.signatureValid, true);
  assert.notEqual(anaRequest.accessId, brunoRequest.accessId);
});

scenario("editing the identity cells does not change who the user is", () => {
  const world = twoPeople();
  const sheet = world.workbook.getSheetByName("Credentials");

  for (const cell of ["B1", "B2", "B3", "B5", "B6"]) sheet.getRange(cell).setValue("'evil.example/#");

  assert.deepEqual(identity(world), ANA);
});

scenario("clearing the identity cells does not log anyone out", () => {
  const world = twoPeople();
  const sheet = world.workbook.getSheetByName("Credentials");

  sheet.getRange(1, 2, 9, 1).clearContent();

  assert.deepEqual(identity(world), ANA);
  world.api.requests.length = 0;
  world.evaluate('fetch("/balance")');
  assert.equal(world.api.requests[0].signatureValid, true);
});

scenario("the link of the cart uses the identity of the person, whatever the cells say", () => {
  const world = twoPeople();
  const sheet = world.workbook.getSheetByName("Credentials");
  sheet.getRange("C6").setValue("'cart-1");
  sheet.getRange("B1").setValue("'evil.example/#");

  assert.equal(world.invoke("redirect"), "https://myworkspace.sandbox.starkbank.com/cart/cart-1");
});

scenario("signing out only ends the session and the identity of the person who did it", () => {
  const world = twoPeople();

  world.invoke("signOut", false);

  assert.equal(world.evaluate("new getDefaultUser()").workspace, "");
  world.switchUser("bruno");
  assert.deepEqual(identity(world), BRUNO);
  world.api.requests.length = 0;
  world.evaluate('fetch("/balance")');
  assert.equal(world.api.requests[0].signatureValid, true);
});

scenario("the identity is kept in the user's properties, not in a store shared with others", () => {
  const world = twoPeople();

  for (const kind of ["document", "script"]) {
    assert.deepEqual(Array.from(world.properties[kind].store.values()), [], `${kind} properties`);
    assert.deepEqual(world.caches[kind].liveValues(), [], `${kind} cache`);
  }
  assert.ok(Array.from(world.properties.user.store.values()).includes("myworkspace"));
});

scenario("a collaborator changing the environment cell in the middle of a login does not redirect it", () => {
  const world = newLoginWorld("sandbox");
  world.invoke("CredentialsHeader");
  world.invoke("getUserInputCredential", EMAIL, "myworkspace", "test-password", "sandbox");

  world.workbook.getSheetByName("Credentials").getRange("B3").setValue("production");
  const challengeId = Array.from(world.api.challenges.keys()).pop();
  world.api.setChallengeStatus(challengeId, "approved");
  world.invoke("getChallengeApprove");
  world.invoke("postSessionChallenge");

  assert.ok(world.api.requests.every(request => request.environment === "sandbox"), world.api.requests.map(request => request.environment).join());
  assert.equal(world.evaluate("new getDefaultUser()").environment, "sandbox");
});

const NOT_LOGGED_IN_MESSAGE = "Erro de autenticação! Por favor, faça login novamente.";

scenario("a session made by a version that kept the profile in the cells asks for a new login", () => {
  const world = newLoginWorld("sandbox");
  login(world);
  world.invoke("SessionStore.clearProfile");

  const user = world.evaluate("new getDefaultUser()");

  assert.equal(user.privateKey, "");
  assert.equal(JSON.parse(world.invokeExpectingError("fetch", "/balance")).message, NOT_LOGGED_IN_MESSAGE);
  assert.equal(world.api.requests.filter(request => request.path === "/balance").length, 0);
  login(world);
  world.api.requests.length = 0;
  world.evaluate('fetch("/balance")');
  assert.equal(world.api.requests[0].signatureValid, true);
});

scenario("a login that failed halfway leaves who tried to log in, but no session", () => {
  const world = newLoginWorld("sandbox");
  world.api.rejectChallenge = true;
  world.invoke("CredentialsHeader");

  world.invokeExpectingError("getUserInputCredential", EMAIL, "myworkspace", PASSWORD, "sandbox");

  const user = world.evaluate("new getDefaultUser()");
  assert.equal(user.workspace, "myworkspace");
  assert.equal(user.privateKey, "");
  assert.equal(JSON.parse(world.invokeExpectingError("fetch", "/balance")).message, NOT_LOGGED_IN_MESSAGE);
});

scenario("signing out cleans the shared sheet for everyone but keeps the other person logged in", () => {
  const world = twoPeople();
  world.workbook.getSheetByName("Transferências").getRange("A11").setValue("a payment");

  world.switchUser("bruno");
  world.invoke("signOut", false);

  assert.deepEqual(world.workbook.getSheetByName("Transferências").allValues(), []);
  assert.equal(world.evaluate("new getDefaultUser()").workspace, "");
  world.switchUser("ana");
  assert.deepEqual(identity(world), ANA);
  world.api.requests.length = 0;
  world.evaluate('fetch("/balance")');
  assert.equal(world.api.requests[0].signatureValid, true);
});

scenario("the greeting of each sheet shows the identity of the person, not the last login in the cells", () => {
  const world = twoPeople();

  world.invoke("SetAllGreetings");

  const greeting = world.workbook.getSheetByName("Transferências");
  assert.equal(greeting.getRange("A3").getValue(), "Workspace: myworkspace");
  assert.equal(greeting.getRange("A5").getValue(), `E-mail: ${EMAIL}`);
  assert.equal(greeting.getRange("A6").getValue(), "Ambiente: sandbox");
});

scenario("a workspace id beyond what a number can hold is kept exactly", () => {
  // The original kept it in a cell, where Sheets turns it into a number and rounds it.
  const world = newLoginWorld("sandbox");
  world.api.registerWorkspace("bigworkspace", "9007199254740993");

  login(world, "bigworkspace");

  assert.equal(String(world.evaluate("new getDefaultUser()").workspaceId), "9007199254740993");
  world.api.requests.length = 0;
  world.invoke("getUserInputCredential", EMAIL, "bigworkspace", PASSWORD, "sandbox");
  assert.equal(world.api.lastRequest("POST", "/challenge").accessId, `workspace/9007199254740993/email/${EMAIL}`);
});

scenario("the cells keep showing the identity of the last login", () => {
  const world = twoPeople();
  const sheet = world.workbook.getSheetByName("Credentials");

  assert.equal(sheet.getRange("B1").getValue(), "otherworkspace");
  assert.equal(String(sheet.getRange("B6").getValue()), "9");
});

scenario("a workspace without an environment or a name has no link to open", () => {
  const world = newLoginWorld("sandbox");
  world.invoke("SessionStore.saveProfile", {workspace: "", email: EMAIL, environment: "sandbox", name: "x", workspaceId: "1"});

  assert.throws(() => world.invoke("redirect"), /carrinho/);
});

run();
