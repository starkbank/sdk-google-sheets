"use strict";

// Where the session secrets live. This suite pins the security contract: secrets must never be
// readable from the spreadsheet or from stores shared with other users.

const assert = require("node:assert/strict");
const {createWorld} = require("./support/appsScriptWorld");
const {createScenarioRunner} = require("./support/scenarios");
const {PASSWORD, EMAIL, MEMBER_PUBLIC_KEY_PEM, newLoginWorld, startLogin, approveAndFinishLogin, login, pemFingerprint} = require("./support/login");

const {scenario, run} = createScenarioRunner("Credentials storage");

const SESSION = {
  privateKey: "-----BEGIN EC PRIVATE KEY-----\nSECRET-SESSION-KEY\n-----END EC PRIVATE KEY-----\n",
  publicKey: "-----BEGIN PUBLIC KEY-----\nSESSION-PUBLIC-KEY\n-----END PUBLIC KEY-----\n",
  accessId: "session/abc-123",
};

const HANDSHAKE = {
  requestBody: '{"expiration":604800,"publicKey":"HANDSHAKE-REQUEST-BODY","platform":"spreadsheet"}',
  memberKeyPem: "-----BEGIN EC PRIVATE KEY-----\nSECRET-MEMBER-KEY\n-----END EC PRIVATE KEY-----\n",
  challengeId: "challenge-77",
  sessionPrivateKeyPem: "-----BEGIN EC PRIVATE KEY-----\nSECRET-PENDING-SESSION-KEY\n-----END EC PRIVATE KEY-----\n",
  sessionPublicKeyPem: "-----BEGIN PUBLIC KEY-----\nPENDING-SESSION-PUBLIC-KEY\n-----END PUBLIC KEY-----\n",
};

const EMPTY_SESSION = {privateKey: "", publicKey: "", accessId: ""};

function call(world, expression, value) {
  return world.evaluate(value === undefined ? expression : `${expression}(${JSON.stringify(value)})`);
}

function errorOf(world, expression, value) {
  try {
    call(world, expression, value);
  } catch (error) {
    return error.message;
  }
  throw new assert.AssertionError({message: `${expression} was expected to throw`});
}

// Every place of the simulated platform that holds the given text.
function placesHolding(world, text) {
  const places = [];
  for (const sheet of world.workbook.getSheets()) {
    if (sheet.allValues().some(value => value.includes(text))) places.push(`sheet ${sheet.getSheetName()}`);
  }
  for (const kind of ["user", "document", "script"]) {
    if (Array.from(world.properties[kind].store.values()).some(value => value.includes(text))) places.push(`${kind} properties`);
    if (world.caches[kind].liveValues().some(value => value.includes(text))) places.push(`${kind} cache`);
  }
  return places;
}

scenario("a saved session is read back in another execution", () => {
  const world = createWorld();

  call(world, "SessionStore.saveSession", SESSION);

  assert.deepEqual(call(world, "SessionStore.loadSession()"), SESSION);
});

scenario("without a session every field comes back empty", () => {
  const world = createWorld();

  assert.deepEqual(call(world, "SessionStore.loadSession()"), EMPTY_SESSION);
});

scenario("the session secrets are only kept in the user's properties", () => {
  const world = createWorld();

  call(world, "SessionStore.saveSession", SESSION);

  for (const secret of ["SECRET-SESSION-KEY", "SESSION-PUBLIC-KEY", "session/abc-123"]) {
    assert.deepEqual(placesHolding(world, secret), ["user properties"]);
  }
});

scenario("the session is still there days later, long after any cache would have expired", () => {
  const world = createWorld();
  call(world, "SessionStore.saveSession", SESSION);

  world.advanceTime(7 * 24 * 3600);

  assert.deepEqual(call(world, "SessionStore.loadSession()"), SESSION);
});

scenario("an incomplete session is rejected and nothing is stored", () => {
  const world = createWorld();

  for (const field of Object.keys(SESSION)) {
    const incomplete = {...SESSION, [field]: ""};
    assert.match(errorOf(world, "SessionStore.saveSession", incomplete), new RegExp(`Invalid session: missing ${field}`));
  }

  assert.deepEqual(call(world, "SessionStore.loadSession()"), EMPTY_SESSION);
  assert.equal(world.properties.user.store.size, 0);
});

scenario("a non string session field is rejected and nothing is stored", () => {
  const world = createWorld();

  assert.match(errorOf(world, "SessionStore.saveSession", {...SESSION, accessId: 123}), /Invalid session: missing accessId/);
  assert.match(errorOf(world, "SessionStore.saveSession()"), /Invalid session: missing privateKey/);

  assert.equal(world.properties.user.store.size, 0);
});

scenario("a session with a missing field (interrupted clearing) counts as no session at all", () => {
  const world = createWorld();
  call(world, "SessionStore.saveSession", SESSION);

  world.properties.user.dropOne();

  assert.deepEqual(call(world, "SessionStore.loadSession()"), EMPTY_SESSION);
});

scenario("saving and clearing the session leave unrelated user properties alone", () => {
  const world = createWorld();
  world.properties.user.setProperty("somethingElse", "keep me");

  call(world, "SessionStore.saveSession", SESSION);
  call(world, "SessionStore.clearSession()");

  assert.equal(world.properties.user.getProperty("somethingElse"), "keep me");
});

scenario("saving a session replaces the previous one", () => {
  const world = createWorld();
  call(world, "SessionStore.saveSession", SESSION);
  const newer = {privateKey: "NEW-PRIVATE", publicKey: "NEW-PUBLIC", accessId: "session/new"};

  call(world, "SessionStore.saveSession", newer);

  assert.deepEqual(call(world, "SessionStore.loadSession()"), newer);
  assert.deepEqual(placesHolding(world, "SECRET-SESSION-KEY"), []);
});

scenario("clearing the session removes every secret", () => {
  const world = createWorld();
  call(world, "SessionStore.saveSession", SESSION);

  call(world, "SessionStore.clearSession()");

  assert.deepEqual(call(world, "SessionStore.loadSession()"), EMPTY_SESSION);
  assert.equal(world.properties.user.store.size, 0);
});

scenario("the profile is read back in another execution, as text", () => {
  const world = createWorld();

  call(world, "SessionStore.saveProfile", {workspace: "ws", email: "a@b.com", environment: "sandbox", name: "Ana", workspaceId: 5});

  assert.deepEqual(call(world, "SessionStore.loadProfile()"), {workspace: "ws", email: "a@b.com", environment: "sandbox", name: "Ana", workspaceId: "5"});
});

scenario("without a profile every field comes back empty, and what is not given is stored empty", () => {
  const world = createWorld();
  const empty = {workspace: "", email: "", environment: "", name: "", workspaceId: ""};

  assert.deepEqual(call(world, "SessionStore.loadProfile()"), empty);
  call(world, "SessionStore.saveProfile", {workspace: "ws", name: null});
  assert.deepEqual(call(world, "SessionStore.loadProfile()"), {...empty, workspace: "ws"});
  call(world, "SessionStore.saveProfile()");
  assert.deepEqual(call(world, "SessionStore.loadProfile()"), empty);
});

scenario("the profile is only kept in the user's properties and replaced by the next one", () => {
  const world = createWorld();

  call(world, "SessionStore.saveProfile", {workspace: "first-workspace", email: "first@example.com", environment: "sandbox", name: "First", workspaceId: "1"});
  call(world, "SessionStore.saveProfile", {workspace: "second-workspace", email: "second@example.com", environment: "production", name: "Second", workspaceId: "2"});

  assert.deepEqual(placesHolding(world, "second-workspace"), ["user properties"]);
  assert.deepEqual(placesHolding(world, "first-workspace"), []);
});

scenario("clearing everything removes the profile too, and clearing the session keeps it", () => {
  const world = createWorld();
  call(world, "SessionStore.saveProfile", {workspace: "ws", email: "a@b.com", environment: "sandbox", name: "Ana", workspaceId: "5"});
  call(world, "SessionStore.saveSession", SESSION);

  call(world, "SessionStore.clearSession()");
  assert.equal(call(world, "SessionStore.loadProfile()").workspace, "ws");
  call(world, "SessionStore.clearAll()");

  assert.equal(call(world, "SessionStore.loadProfile()").workspace, "");
  assert.equal(world.properties.user.store.size, 0);
});

scenario("the login key is derived for the environment of the profile, whatever the cell says", () => {
  const world = newLoginWorld("sandbox");
  call(world, "SessionStore.saveProfile", {workspace: "ws", email: EMAIL, environment: "sandbox", name: "Ana", workspaceId: "5"});
  world.workbook.getSheetByName("Credentials").getRange("B3").setValue("production");

  const publicKey = world.evaluate(`KeyGen.generateKeyFromPassword(${JSON.stringify(PASSWORD)}, ${JSON.stringify(EMAIL)}).publicKey().toPem()`);

  assert.equal(publicKey, MEMBER_PUBLIC_KEY_PEM.sandbox);
});

scenario("the profile does not store empty values and reads them back as empty", () => {
  const world = createWorld();

  call(world, "SessionStore.saveProfile", {workspace: "ws", email: "", environment: "sandbox", name: null});

  assert.deepEqual(call(world, "SessionStore.loadProfile()"), {workspace: "ws", email: "", environment: "sandbox", name: "", workspaceId: ""});
  assert.deepEqual(Array.from(world.properties.user.store.keys()).sort().length, 2);
});

scenario("the handshake can be built in steps and is only kept in the user's cache", () => {
  const world = createWorld();
  const {challengeId, ...firstStep} = HANDSHAKE;

  call(world, "SessionStore.saveHandshake", firstStep);
  assert.equal(call(world, "SessionStore.loadHandshake()"), null);
  assert.deepEqual(call(world, 'SessionStore.loadHandshake("requestBody", "memberKeyPem")'), {
    requestBody: HANDSHAKE.requestBody,
    memberKeyPem: HANDSHAKE.memberKeyPem,
  });
  call(world, "SessionStore.saveHandshake", {challengeId});

  assert.deepEqual(call(world, "SessionStore.loadHandshake()"), HANDSHAKE);
  for (const secret of ["SECRET-MEMBER-KEY", "SECRET-PENDING-SESSION-KEY", "HANDSHAKE-REQUEST-BODY", "challenge-77"]) {
    assert.deepEqual(placesHolding(world, secret), ["user cache"]);
  }
});

scenario("the handshake expires after ten minutes and does not touch the session", () => {
  const world = createWorld();
  call(world, "SessionStore.saveSession", SESSION);
  call(world, "SessionStore.startHandshake", HANDSHAKE);

  world.advanceTime(599);
  assert.deepEqual(call(world, "SessionStore.loadHandshake()"), HANDSHAKE);
  world.advanceTime(2);

  assert.equal(call(world, "SessionStore.loadHandshake()"), null);
  assert.deepEqual(call(world, "SessionStore.loadSession()"), SESSION);
});

scenario("a handshake that lost a field (cache eviction) is reported as missing, never as partial", () => {
  const world = createWorld();
  call(world, "SessionStore.startHandshake", HANDSHAKE);

  world.caches.user.evictOne();

  assert.equal(call(world, "SessionStore.loadHandshake()"), null);
});

scenario("starting a handshake discards what a previous login left behind", () => {
  const world = createWorld();
  call(world, "SessionStore.startHandshake", HANDSHAKE);
  const {challengeId, memberKeyPem, ...nextLoginFirstStep} = HANDSHAKE;

  call(world, "SessionStore.startHandshake", {...nextLoginFirstStep, requestBody: "SECOND-LOGIN-BODY"});

  assert.equal(call(world, "SessionStore.loadHandshake()"), null);
  assert.deepEqual(placesHolding(world, "challenge-77"), []);
  assert.deepEqual(placesHolding(world, "SECRET-MEMBER-KEY"), []);
  assert.deepEqual(placesHolding(world, "SECOND-LOGIN-BODY"), ["user cache"]);
});

scenario("an unknown, empty or non string handshake field is rejected and nothing is stored", () => {
  const world = createWorld();

  assert.match(errorOf(world, "SessionStore.saveHandshake", {typo: "value"}), /Unknown handshake field: typo/);
  assert.match(errorOf(world, "SessionStore.saveHandshake", {memberKeyPem: "x", challengeId: ""}), /Invalid handshake: missing challengeId/);
  assert.match(errorOf(world, "SessionStore.saveHandshake", {challengeId: 42}), /Invalid handshake: missing challengeId/);
  assert.match(errorOf(world, "SessionStore.saveHandshake", {}), /nothing to store/);
  assert.match(errorOf(world, "SessionStore.saveHandshake()"), /nothing to store/);

  assert.equal(call(world, "SessionStore.loadHandshake()"), null);
  assert.deepEqual(world.caches.user.liveValues(), []);
});

scenario("clearing the handshake leaves the session alone, clearing everything removes both", () => {
  const world = createWorld();
  call(world, "SessionStore.saveSession", SESSION);
  call(world, "SessionStore.startHandshake", HANDSHAKE);

  call(world, "SessionStore.clearHandshake()");
  assert.equal(call(world, "SessionStore.loadHandshake()"), null);
  assert.deepEqual(call(world, "SessionStore.loadSession()"), SESSION);

  call(world, "SessionStore.startHandshake", HANDSHAKE);
  call(world, "SessionStore.clearAll()");

  assert.equal(call(world, "SessionStore.loadHandshake()"), null);
  assert.deepEqual(call(world, "SessionStore.loadSession()"), EMPTY_SESSION);
});

scenario("nothing is written to the spreadsheet", () => {
  const world = createWorld();

  call(world, "SessionStore.saveSession", SESSION);
  call(world, "SessionStore.startHandshake", HANDSHAKE);

  for (const sheet of world.workbook.getSheets()) {
    assert.deepEqual(sheet.allValues(), []);
  }
});

const NOT_LOGGED_IN_MESSAGE = "Erro de autenticação! Por favor, faça login novamente.";
const LOGIN_EXPIRED_MESSAGE = "O login expirou. Por favor, faça login novamente.";
const ACCESS_ID_TEXT = "session/session-";

function memberKeyPem(world) {
  return world.evaluate(`KeyGen.generateKeyFromPassword(${JSON.stringify(PASSWORD)}, ${JSON.stringify(EMAIL)}).toPem()`);
}

// The non secret data the login leaves on the Credentials sheet (column B).
function credentialsColumnB(world) {
  const sheet = world.workbook.getSheetByName("Credentials");
  return Array.from(sheet.cells.entries())
    .filter(([key]) => key.endsWith(",2"))
    .map(([key, value]) => [Number(key.split(",")[0]), String(value)])
    .sort((a, b) => a[0] - b[0]);
}

const NON_SECRET_CREDENTIALS = [[1, "myworkspace"], [2, EMAIL], [3, "sandbox"], [5, "myworkspace"], [6, "5"]];

function latestChallengeId(world) {
  return Array.from(world.api.challenges.keys()).pop();
}

function latestSessionId(world) {
  return Array.from(world.api.sessions.keys()).pop();
}

scenario("while the login is pending no secret reaches the spreadsheet or a shared store", () => {
  const world = newLoginWorld();

  const qrcode = startLogin(world);

  assert.equal(qrcode, "QRCODE-challenge-1");
  assert.deepEqual(placesHolding(world, PASSWORD), []);
  assert.deepEqual(placesHolding(world, pemFingerprint(memberKeyPem(world))), ["user cache"]);
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), ["user cache"]);
  assert.deepEqual(credentialsColumnB(world), NON_SECRET_CREDENTIALS);
});

scenario("after the login the session is only in the user's properties", () => {
  const world = newLoginWorld();

  login(world);

  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), ["user properties"]);
  assert.deepEqual(placesHolding(world, ACCESS_ID_TEXT), ["user properties"]);
  assert.deepEqual(placesHolding(world, pemFingerprint(memberKeyPem(world))), []);
  assert.deepEqual(placesHolding(world, PASSWORD), []);
  assert.deepEqual(placesHolding(world, "challenge-1"), []);
  assert.deepEqual(placesHolding(world, "spreadsheet"), []);
  assert.deepEqual(credentialsColumnB(world), NON_SECRET_CREDENTIALS);
});

scenario("the handshake is discarded as soon as the session exists", () => {
  const world = newLoginWorld();

  login(world);

  assert.equal(call(world, "SessionStore.loadHandshake()"), null);
});

scenario("the user object carries no password or token", () => {
  const world = newLoginWorld();
  login(world);

  const user = world.evaluate("new getDefaultUser()");

  assert.equal("accessToken" in user, false);
  assert.ok(!JSON.stringify(user).includes(PASSWORD));
});

scenario("an expired handshake asks for a new login in every step without calling the API", () => {
  const world = newLoginWorld();
  startLogin(world);
  const requestsBefore = world.api.requests.length;

  world.advanceTime(601);

  for (const step of ["getChallengeApprove", "postSessionChallenge"]) {
    assert.equal(JSON.parse(world.invokeExpectingError(step)).message, LOGIN_EXPIRED_MESSAGE);
  }
  assert.equal(world.api.requests.length, requestsBefore);
  assert.equal(world.api.sessions.size, 0);
});

scenario("a handshake that lost any field to cache eviction is treated as expired", () => {
  for (let evicted = 0; evicted < 5; evicted++) {
    const world = newLoginWorld();
    startLogin(world);
    const requestsBefore = world.api.requests.length;

    world.caches.user.evictOne(evicted);

    assert.equal(JSON.parse(world.invokeExpectingError("postSessionChallenge")).message, LOGIN_EXPIRED_MESSAGE);
    assert.equal(world.api.requests.length, requestsBefore);
    assert.equal(world.api.sessions.size, 0);
  }
});

scenario("without a login in progress the steps ask for a new login", () => {
  const world = newLoginWorld();

  for (const step of ["getChallengeApprove", "postSessionChallenge"]) {
    assert.equal(JSON.parse(world.invokeExpectingError(step)).message, LOGIN_EXPIRED_MESSAGE);
  }
  assert.equal(world.api.requests.length, 0);
});

scenario("a rejected challenge leaves no key behind and no session", () => {
  const world = newLoginWorld();
  world.api.rejectChallenge = true;
  world.invoke("CredentialsHeader");

  world.invokeExpectingError("getUserInputCredential", EMAIL, "myworkspace", PASSWORD, "sandbox");

  assert.deepEqual(placesHolding(world, pemFingerprint(memberKeyPem(world))), []);
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
  assert.equal(JSON.parse(world.invokeExpectingError("fetch", "/balance")).message, NOT_LOGGED_IN_MESSAGE);
});

scenario("an expired or denied challenge discards the keys of the pending login", () => {
  for (const status of ["expired", "denied"]) {
    const world = newLoginWorld();
    startLogin(world);
    world.api.setChallengeStatus(latestChallengeId(world), status);

    assert.equal(world.invoke("getChallengeApprove"), status);

    assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
    assert.equal(JSON.parse(world.invokeExpectingError("getChallengeApprove")).message, LOGIN_EXPIRED_MESSAGE);
  }
});

scenario("a failed session creation discards the keys of the pending login", () => {
  const world = newLoginWorld();
  startLogin(world);

  const message = world.invokeExpectingError("postSessionChallenge");

  assert.equal(JSON.parse(message).errors[0].code, "invalidChallenge");
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
  assert.equal(JSON.parse(world.invokeExpectingError("getChallengeApprove")).message, LOGIN_EXPIRED_MESSAGE);
});

scenario("polls still in flight after the login finished are harmless", () => {
  const world = newLoginWorld();
  login(world);
  const requestsBefore = world.api.requests.length;

  // The form polls every 500ms without waiting for the answers.
  assert.equal(world.invoke("getChallengeApprove"), "approved");
  world.invoke("postSessionChallenge");

  assert.equal(world.api.requests.length, requestsBefore);
  assert.equal(world.api.sessions.size, 1);
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), ["user properties"]);
  world.evaluate('fetch("/balance")');
  assert.equal(world.api.lastRequest("GET", "/balance").signatureValid, true);
});

scenario("starting a new login ends the previous session and never reuses its handshake", () => {
  const world = newLoginWorld();
  login(world);
  const firstChallenge = latestChallengeId(world);

  startLogin(world);

  assert.equal(JSON.parse(world.invokeExpectingError("fetch", "/balance")).message, NOT_LOGGED_IN_MESSAGE);
  approveAndFinishLogin(world);
  assert.notEqual(latestChallengeId(world), firstChallenge);
  assert.equal(world.api.lastRequest("POST", "/session").headers["Access-Challenge-Ids"], latestChallengeId(world));
  world.evaluate('fetch("/balance")');
  const request = world.api.lastRequest("GET", "/balance");
  assert.equal(request.signatureValid, true);
  assert.equal(request.accessId, `session/${latestSessionId(world)}`);
});

scenario("signing out removes the stored session", () => {
  const world = newLoginWorld();
  login(world);

  world.invoke("signOut", false);

  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
  assert.deepEqual(placesHolding(world, ACCESS_ID_TEXT), []);
  assert.equal(JSON.parse(world.invokeExpectingError("fetch", "/balance")).message, NOT_LOGGED_IN_MESSAGE);
});

scenario("signing out during a pending login removes the handshake too", () => {
  const world = newLoginWorld();
  startLogin(world);

  world.invoke("signOut", false);

  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
  assert.equal(JSON.parse(world.invokeExpectingError("getChallengeApprove")).message, LOGIN_EXPIRED_MESSAGE);
});

// What the previous version of the SDK left on the Credentials sheet.
function seedLegacyCredentials(world, {sessionId = "legacy-1", registerSession = true} = {}) {
  const [sessionPrivateKey, sessionPublicKey] = world.evaluate("easyMake()");
  const [memberPrivateKey] = world.evaluate("easyMake()");
  const [pendingPrivateKey, pendingPublicKey] = world.evaluate("easyMake()");
  if (registerSession) {
    world.api.sessions.set(sessionId, {id: sessionId, publicKeyPem: sessionPublicKey});
  }

  const sheet = world.workbook.getSheetByName("Credentials");
  const cells = {
    B1: "myworkspace", B2: EMAIL, B3: "sandbox", B4: PASSWORD, B5: "myworkspace", B6: "5",
    B7: sessionPrivateKey, B8: sessionPublicKey, B9: `session/${sessionId}`,
    B13: '{"expiration":604800,"publicKey":"LEGACY-BODY","platform":"spreadsheet"}',
    B14: memberPrivateKey, B15: "legacy-challenge", B16: pendingPrivateKey, B17: pendingPublicKey,
    A1: "Workspace", A4: "Access-Token", A7: "Private Key", A8: "Public Key", A9: "Access Id",
  };
  for (const [cell, value] of Object.entries(cells)) sheet.getRange(cell).setValue(value);
  sheet.setFrozenRows(10);
}

function assertNoLegacySecretsLeft(world) {
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
  assert.deepEqual(placesHolding(world, PASSWORD), []);
  assert.deepEqual(placesHolding(world, "LEGACY-BODY"), []);
  assert.deepEqual(placesHolding(world, "legacy-challenge"), []);
  assert.deepEqual(placesHolding(world, "session/legacy-1"), []);
}

function revocations(world) {
  return world.api.requests.filter(request => request.method === "DELETE");
}

scenario("secrets left in the sheet by the previous version are removed on first use", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world);

  world.evaluate("new getDefaultUser()");

  assertNoLegacySecretsLeft(world);
  assert.deepEqual(credentialsColumnB(world), NON_SECRET_CREDENTIALS);
  const sheet = world.workbook.getSheetByName("Credentials");
  assert.equal(sheet.getRange("A1").getValue(), "Workspace");
  for (const cell of ["A4", "A7", "A8", "A9"]) assert.equal(sheet.getRange(cell).getValue(), "");
});

scenario("the session of the previous version is revoked on the API", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world);

  world.evaluate("new getDefaultUser()");

  const [revocation, ...others] = revocations(world);
  assert.deepEqual(others, []);
  assert.equal(revocation.path, "/auth/session/legacy-1");
  assert.equal(revocation.accessId, "session/legacy-1");
  assert.equal(revocation.environment, "sandbox");
  assert.equal(revocation.signatureValid, true);
  assert.equal(world.api.sessions.has("legacy-1"), false);
});

scenario("the previous session is not reused: the user has to log in again", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world);

  assert.equal(JSON.parse(world.invokeExpectingError("fetch", "/balance")).message, NOT_LOGGED_IN_MESSAGE);

  assert.equal(revocations(world).length, 1);
  assertNoLegacySecretsLeft(world);
});

scenario("the cleaning happens once: later calls do no extra work", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world);
  world.evaluate("new getDefaultUser()");
  const requestsBefore = world.api.requests.length;

  world.evaluate("new getDefaultUser()");

  assert.equal(world.api.requests.length, requestsBefore);
});

scenario("logging in right after the upgrade still revokes the previous session", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world);

  world.invoke("getUserInputCredential", EMAIL, "myworkspace", PASSWORD, "sandbox");
  approveAndFinishLogin(world);

  assert.equal(world.api.sessions.has("legacy-1"), false);
  assert.equal(revocations(world).length, 1);
  assert.equal(revocations(world)[0].signatureValid, true);
  assert.deepEqual(placesHolding(world, "legacy-challenge"), []);
  assert.deepEqual(placesHolding(world, "LEGACY-BODY"), []);
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), ["user properties"]);
  world.evaluate('fetch("/balance")');
  const request = world.api.lastRequest("GET", "/balance");
  assert.equal(request.signatureValid, true);
  assert.equal(request.accessId, `session/${latestSessionId(world)}`);
});

scenario("the secrets are removed even when the API is unavailable", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world);
  world.api.unavailable = true;

  world.evaluate("new getDefaultUser()");

  assertNoLegacySecretsLeft(world);
  assert.deepEqual(credentialsColumnB(world), NON_SECRET_CREDENTIALS);
});

scenario("a previous session the API no longer knows does not get in the way", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world, {registerSession: false});

  world.evaluate("new getDefaultUser()");

  assertNoLegacySecretsLeft(world);
  assert.equal(revocations(world).length, 1);
});

scenario("a login that never finished on the previous version is cleaned without calling the API", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world, {sessionId: "null", registerSession: false});

  world.evaluate("new getDefaultUser()");

  assert.equal(world.api.requests.length, 0);
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
  assert.deepEqual(placesHolding(world, PASSWORD), []);
});

scenario("without edit access nothing breaks and the API is left alone", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world);
  world.workbook.getSheetByName("Credentials").readOnly = true;

  const user = world.evaluate("new getDefaultUser()");

  // Who the user is no longer comes from the cells: after the update there is no login until they log in again.
  assert.equal(user.privateKey, "");
  assert.equal(world.api.requests.length, 0);
  assert.ok(world.workbook.getSheetByName("Credentials").allValues().length > 0, "the legacy cells could not be removed");
});

scenario("a sheet without legacy secrets is left untouched and costs no API call", () => {
  const world = newLoginWorld();
  login(world);
  const requestsBefore = world.api.requests.length;

  world.evaluate("new getDefaultUser()");

  assert.equal(world.api.requests.length, requestsBefore);
  assert.deepEqual(credentialsColumnB(world), NON_SECRET_CREDENTIALS);
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), ["user properties"]);
});

scenario("the header no longer shows labels for fields that are not stored anymore", () => {
  const world = newLoginWorld();
  const sheet = world.workbook.getSheetByName("Credentials");
  for (const [cell, label] of [["A4", "Access-Token"], ["A7", "Private Key"], ["A8", "Public Key"], ["A9", "Access Id"]]) sheet.getRange(cell).setValue(label);

  world.invoke("CredentialsHeader");

  for (const cell of ["A4", "A7", "A8", "A9"]) assert.equal(sheet.getRange(cell).getValue(), "");
  assert.equal(sheet.getRange("A1").getValue(), "Workspace");
});

scenario("secrets that show up again in the same execution are cleaned again", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world);

  world.evaluate(`(function () {
    new getDefaultUser();
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Credentials").getRange("B4").setValue("pasted-back-password");
    new getDefaultUser();
  })()`);

  assert.deepEqual(placesHolding(world, "pasted-back-password"), []);
});

scenario("a session id that is not a plain session id is never turned into a request", () => {
  for (const badId of ["session/../../transfer?x=1", "session/a?b", "session/a/b", "session/a b", "session/", "12345", "workspace/5/email/x"]) {
    const world = newLoginWorld();
    seedLegacyCredentials(world);
    world.workbook.getSheetByName("Credentials").getRange("B9").setValue(badId);

    world.evaluate("new getDefaultUser()");

    assert.equal(world.api.requests.length, 0, `request sent for ${badId}`);
    assertNoLegacySecretsLeft(world);
    assert.deepEqual(credentialsColumnB(world), NON_SECRET_CREDENTIALS);
  }
});

scenario("partial leftovers are cleaned too, and without a usable session no request is made", () => {
  const onlyPassword = newLoginWorld();
  onlyPassword.workbook.getSheetByName("Credentials").getRange("B4").setValue(PASSWORD);
  const onlyKey = newLoginWorld();
  seedLegacyCredentials(onlyKey);
  onlyKey.workbook.getSheetByName("Credentials").getRange("B9").setValue("");

  for (const world of [onlyPassword, onlyKey]) {
    world.evaluate("new getDefaultUser()");

    assert.equal(world.api.requests.length, 0);
    assert.deepEqual(placesHolding(world, PASSWORD), []);
    assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
  }
});

scenario("passwords that Sheets stores as numbers or booleans are detected as well", () => {
  for (const password of ["0", "false", "000123"]) {
    const world = newLoginWorld();
    const sheet = world.workbook.getSheetByName("Credentials");
    sheet.getRange("B4").setValue(password);

    world.evaluate("new getDefaultUser()");

    assert.equal(sheet.getRange("B4").getValue(), "", `password ${password} was left in the sheet`);
  }
});

scenario("a protected cell does not stop the cleaning of the others nor the revocation", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world);
  world.workbook.getSheetByName("Credentials").protectedCells.add("9,2");

  world.evaluate("new getDefaultUser()");

  assert.equal(world.api.sessions.has("legacy-1"), false);
  const sheet = world.workbook.getSheetByName("Credentials");
  for (const cell of ["B4", "B7", "B8", "B13", "B14", "B15", "B16", "B17"]) assert.equal(sheet.getRange(cell).getValue(), "");
  assert.equal(sheet.getRange("B9").getValue(), "session/legacy-1");
  assert.ok(world.logs.some(line => line.includes("Could not remove the legacy session")));
});

scenario("errors while revoking are logged without any key material", () => {
  const world = newLoginWorld();
  seedLegacyCredentials(world);
  world.workbook.getSheetByName("Credentials").getRange("B7").setValue("-----BEGIN EC PRIVATE KEY-----\nSECRETJUNK\n-----END EC PRIVATE KEY-----\n");

  world.evaluate("new getDefaultUser()");

  assert.deepEqual(world.logs, ["Could not revoke the legacy session"]);
  assert.equal(world.api.requests.length, 0);
  assertNoLegacySecretsLeft(world);
});

scenario("an empty or unknown environment does not break the cleaning", () => {
  for (const environment of ["", "staging", 42]) {
    const world = newLoginWorld();
    seedLegacyCredentials(world);
    world.workbook.getSheetByName("Credentials").getRange("B3").setValue(environment);

    world.evaluate("new getDefaultUser()");

    assertNoLegacySecretsLeft(world);
  }
});

scenario("starting a new login revokes the previous session on the API too", () => {
  const world = newLoginWorld();
  login(world);
  const previousSessionId = latestSessionId(world);

  startLogin(world);

  const revocations = world.api.requests.filter(request => request.method === "DELETE");
  assert.equal(revocations.length, 1);
  assert.equal(revocations[0].path, `/auth/session/${previousSessionId}`);
  assert.equal(revocations[0].signatureValid, true);
  assert.equal(world.api.sessions.has(previousSessionId), false);
});

scenario("the first login has no previous session to revoke", () => {
  const world = newLoginWorld();

  startLogin(world);

  assert.equal(world.api.requests.filter(request => request.method === "DELETE").length, 0);
});

scenario("a revocation the API refuses does not stop the new login", () => {
  const world = newLoginWorld();
  login(world);
  world.api.failRevocation = true;

  const qrcode = startLogin(world);
  approveAndFinishLogin(world);

  assert.match(qrcode, /^QRCODE-/);
  assert.ok(world.logs.some(line => line.includes("not revoked on the API: status 500")));
  world.evaluate('fetch("/balance")');
  assert.equal(world.api.lastRequest("GET", "/balance").accessId, `session/${latestSessionId(world)}`);
});

scenario("a revocation that cannot be made does not stop the new login either", () => {
  const world = newLoginWorld();
  login(world);
  world.api.failRevocation = "unreachable";

  const qrcode = startLogin(world);
  approveAndFinishLogin(world);

  assert.match(qrcode, /^QRCODE-/);
  assert.ok(world.logs.includes("The session could not be revoked on the API"));
  world.evaluate('fetch("/balance")');
  assert.equal(world.api.lastRequest("GET", "/balance").accessId, `session/${latestSessionId(world)}`);
});

scenario("signing out revokes the current session on the API", () => {
  const world = newLoginWorld();
  login(world);
  const sessionId = latestSessionId(world);

  world.invoke("signOut", false);

  const deletions = world.api.requests.filter(request => request.method === "DELETE");
  assert.equal(deletions.length, 1);
  assert.equal(deletions[0].path, `/auth/session/${sessionId}`);
  assert.equal(deletions[0].accessId, `session/${sessionId}`);
  assert.equal(deletions[0].signatureValid, true);
  assert.equal(world.api.sessions.has(sessionId), false);
});

scenario("the password never travels in a request path, query or body", () => {
  const world = newLoginWorld();
  login(world);

  world.invoke("signOut", false);

  assert.ok(!JSON.stringify(world.api.requests).includes(PASSWORD));
  assert.ok(world.api.requests.every(request => !request.path.includes("access-token") && !request.path.includes("undefined")));
});

scenario("signing out revokes the latest session, not an earlier one", () => {
  const world = newLoginWorld();
  login(world);
  const firstSessionId = latestSessionId(world);
  login(world);
  const secondSessionId = latestSessionId(world);
  // The new login already ended the first session; what the sign out does is what is measured here.
  world.api.requests.length = 0;

  world.invoke("signOut", false);

  assert.equal(world.api.lastRequest("DELETE", `/auth/session/${secondSessionId}`).signatureValid, true);
  assert.equal(world.api.lastRequest("DELETE", `/auth/session/${firstSessionId}`), undefined);
});

scenario("signing out without a session, or during a pending login, makes no revocation request", () => {
  const withoutSession = newLoginWorld();
  withoutSession.invoke("signOut", false);
  assert.equal(withoutSession.api.requests.length, 0);

  const pendingLogin = newLoginWorld();
  startLogin(pendingLogin);
  pendingLogin.invoke("signOut", false);
  assert.equal(pendingLogin.api.requests.filter(request => request.method === "DELETE").length, 0);
});

scenario("signing out still cleans everything and warns when the API cannot be reached", () => {
  const world = newLoginWorld();
  login(world);
  world.api.unavailable = true;

  world.invoke("signOut");

  assert.deepEqual(world.browserMessages, [
    "Sessão encerrada neste dispositivo, mas não foi possível encerrá-la no servidor. Ela deixará de valer quando expirar.",
  ]);
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
  assert.deepEqual(world.logs, ["The session could not be revoked on the API"]);
});

scenario("the warning about an unreachable API is not shown when signing out silently", () => {
  const world = newLoginWorld();
  login(world);
  world.api.unavailable = true;

  world.invoke("signOut", false);

  assert.deepEqual(world.browserMessages, []);
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
});

scenario("signing out a session the API already forgot does not bother the user", () => {
  const world = newLoginWorld();
  login(world);
  world.api.sessions.clear();

  world.invoke("signOut");

  assert.deepEqual(world.browserMessages, ["Sessão encerrada com sucesso"]);
  assert.deepEqual(world.logs, ["The session was not revoked on the API: status 401"]);
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
});

scenario("signing out cleans everything even if the current user cannot be read", () => {
  const world = newLoginWorld();
  login(world);
  world.properties.user.getProperties = () => { throw new Error("Service invoked too many times"); };

  world.invoke("signOut");

  assert.deepEqual(world.browserMessages, [
    "Sessão encerrada neste dispositivo, mas não foi possível encerrá-la no servidor. Ela deixará de valer quando expirar.",
  ]);
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), []);
});

scenario("cancelling the sign out keeps the session alive on the API", () => {
  const world = newLoginWorld();
  login(world);
  world.alertAnswer = "NO";

  world.invoke("signOut");

  assert.equal(world.api.sessions.size, 1);
  assert.deepEqual(placesHolding(world, "PRIVATE KEY"), ["user properties"]);
});

run();
