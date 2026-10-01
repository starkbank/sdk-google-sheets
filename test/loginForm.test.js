"use strict";

// Runs the real script of src/FormCredentials.html with the browser and google.script.run
// replaced by stubs, to check how the QR code polling reacts to the answers of the server.

const assert = require("node:assert/strict");
const {loadForm} = require("./support/formHarness");
const {createScenarioRunner} = require("./support/scenarios");

const {scenario, run} = createScenarioRunner("Login form");

function loadLoginForm() {
  const page = loadForm("FormCredentials.html");
  page.alertText = () => page.element("alert-message").textContent;
  page.callsTo = name => page.serverCalls.filter(call => call.name === name);
  page.startPolling = () => page.call("getQrcode", "data:image/png;base64,AAAA");
  page.poll = () => page.call("pollingFunc");
  page.latestPoll = () => page.callsTo("getChallengeApprove").pop();
  return page;
}

function failure(message) {
  return {message: JSON.stringify({message})};
}

scenario("approval creates the session once, even if more polls were already in flight", () => {
  const page = loadLoginForm();
  page.startPolling();
  page.poll();
  page.poll();
  const [first, second] = page.callsTo("getChallengeApprove");

  first.success("approved");
  second.success("approved");

  assert.equal(page.callsTo("postSessionChallenge").length, 1);
  assert.equal(page.clearedIntervals >= 1, true);
});

scenario("the session creation answer is handled as before", () => {
  const page = loadLoginForm();
  page.startPolling();
  page.poll();
  page.latestPoll().success("approved");

  page.callsTo("postSessionChallenge")[0].success();
  page.callsTo("SetAllGreetings")[0].success();

  assert.equal(page.callsTo("SetAllGreetings").length, 1);
  assert.equal(page.closed, 1);
});

scenario("a failed session creation is shown to the user", () => {
  const page = loadLoginForm();
  page.startPolling();
  page.poll();
  page.latestPoll().success("approved");

  page.callsTo("postSessionChallenge")[0].failure(failure("O login expirou. Por favor, faça login novamente."));

  assert.equal(page.alertText(), "O login expirou. Por favor, faça login novamente.");
});

scenario("a poll still in flight does not overwrite the denied message with an error", () => {
  const page = loadLoginForm();
  page.startPolling();
  page.poll();
  page.poll();
  const [first, second] = page.callsTo("getChallengeApprove");

  first.success("denied");
  second.failure(failure("O login expirou. Por favor, faça login novamente."));

  assert.equal(page.alertText(), "Autorização Negada");
});

scenario("a poll still in flight does not overwrite the expired QR code message either", () => {
  const page = loadLoginForm();
  page.startPolling();
  page.poll();
  page.poll();
  const [first, second] = page.callsTo("getChallengeApprove");

  first.success("expired");
  second.failure(failure("O login expirou. Por favor, faça login novamente."));

  assert.match(page.alertText(), /QR Code expirou/);
});

scenario("an error while polling is shown once and stops the polling", () => {
  const page = loadLoginForm();
  page.startPolling();
  page.poll();
  page.poll();
  const [first, second] = page.callsTo("getChallengeApprove");

  first.failure(failure("O login expirou. Por favor, faça login novamente."));
  second.failure(failure("another error"));

  assert.equal(page.alertText(), "O login expirou. Por favor, faça login novamente.");
  assert.equal(page.clearedIntervals >= 1, true);
});

scenario("a pending answer keeps the polling going", () => {
  const page = loadLoginForm();
  page.startPolling();
  page.poll();

  page.latestPoll().success("pending");
  page.poll();

  assert.equal(page.callsTo("getChallengeApprove").length, 2);
  assert.equal(page.callsTo("postSessionChallenge").length, 0);
});

scenario("a new login after a finished one polls again", () => {
  const page = loadLoginForm();
  page.startPolling();
  page.poll();
  page.latestPoll().success("denied");

  page.startPolling();
  page.poll();
  page.latestPoll().success("approved");

  assert.equal(page.callsTo("postSessionChallenge").length, 1);
});

run();
