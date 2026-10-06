"use strict";

// Helpers to drive the QR code login in tests that care about where secrets end up.

const {createWorld} = require("./appsScriptWorld");

const PASSWORD = "test-password";
const EMAIL = "User+tag@Example.com";

// Public keys of the member key derived from PASSWORD and EMAIL in each environment
// (reference values generated with the code before the credentials storage change).
const MEMBER_PUBLIC_KEY_PEM = {
  production: "-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEkAlJWslSmXpCol+8/1TvorOfJjtb9KCO\nKlrO5aSOkb9+Vg6jqc/nunmfh+pdXLCzT9cSWFDD68eqoUXLaqkQUg==\n-----END PUBLIC KEY-----\n",
  sandbox: "-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAERvyfbSg+yik8FEWLze88n7Xh3J/X8BO8\n1QiVBJvkKAY6gtgQP3YJTXMt2Yxs2zR6u2sK/Oq8w/xWivg0IXwRyg==\n-----END PUBLIC KEY-----\n",
  development: "-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEhbYbaLztxxzLsUuaIGvdP7jzd3Ub8biI\nY2ZKMhVvIQ68vFP17BLq6YSU7jdjx6vnPYfHglKEjDYufrl7vdzOdA==\n-----END PUBLIC KEY-----\n",
};

function newLoginWorld(environment = "sandbox") {
  const world = createWorld({memberPublicKeyPem: MEMBER_PUBLIC_KEY_PEM[environment]});
  world.api.registerWorkspace("myworkspace", "5");
  world.environment = environment;
  return world;
}

// First step of the login: returns the QR code and leaves the handshake pending.
function startLogin(world, workspace = "  MyWorkspace ") {
  world.invoke("CredentialsHeader");
  return world.invoke("getUserInputCredential", EMAIL, workspace, PASSWORD, world.environment || "sandbox");
}

// Approves the latest challenge on the API side and runs the remaining steps of the form.
function approveAndFinishLogin(world) {
  const challengeId = Array.from(world.api.challenges.keys()).pop();
  world.api.setChallengeStatus(challengeId, "approved");
  world.invoke("getChallengeApprove");
  world.invoke("postSessionChallenge");
}

function login(world, workspace) {
  startLogin(world, workspace);
  approveAndFinishLogin(world);
}

// A line from the middle of a PEM: enough to find the key anywhere without printing all of it.
function pemFingerprint(pem) {
  return pem.split("\n")[1];
}

module.exports = {PASSWORD, EMAIL, MEMBER_PUBLIC_KEY_PEM, newLoginWorld, startLogin, approveAndFinishLogin, login, pemFingerprint};
