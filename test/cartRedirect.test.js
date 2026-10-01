"use strict";

// The link to the cart is opened in the browser by the dialog. Its host comes from the workspace
// and its path from the cart id, which is kept in a cell that anyone who edits the sheet can change.

const assert = require("node:assert/strict");
const {newLoginWorld, login} = require("./support/login");
const {createScenarioRunner} = require("./support/scenarios");

const {scenario, run} = createScenarioRunner("Cart redirect");

const HOSTS = {
  production: "myworkspace.starkbank.com",
  sandbox: "myworkspace.sandbox.starkbank.com",
  development: "myworkspace.development.starkbank.com",
};

function loggedIn(environment, cartId) {
  const world = newLoginWorld(environment);
  login(world);
  world.workbook.getSheetByName("Credentials").getRange("C6").setValue(`'${cartId}`);
  return world;
}

function redirect(world) {
  try {
    return {link: world.invoke("redirect")};
  } catch (error) {
    return {error: error && error.message !== undefined ? error.message : String(error)};
  }
}

for (const environment of Object.keys(HOSTS)) {
  scenario(`${environment}: the link of a cart is the same as it always was`, () => {
    const world = loggedIn(environment, "AbC-123_x");

    assert.deepEqual(redirect(world), {link: `https://${HOSTS[environment]}/cart/abc-123_x`});
  });
}

scenario("a cart id typed with capital letters is lowercased in the link", () => {
  assert.deepEqual(redirect(loggedIn("sandbox", "ABCDEF0123")), {link: "https://myworkspace.sandbox.starkbank.com/cart/abcdef0123"});
});

scenario("a cart id that can change the host or the path never produces a link", () => {
  for (const cartId of ["../../x", "a/b", "a?b=c", "a#b", "a b", "evil.com", "%2e%2e", "a\\b", "😀", "a@evil.com", "a:80"]) {
    const result = redirect(loggedIn("sandbox", cartId));

    assert.equal(result.link, undefined, `a link was produced for ${JSON.stringify(cartId)}: ${result.link}`);
    assert.match(result.error, /carrinho/);
  }
});

scenario("whatever the sheet cells say, a link always points to the workspace host or is refused", () => {
  const world = loggedIn("sandbox", "abc123");
  const sheet = world.workbook.getSheetByName("Credentials");
  // One cell at a time: a bad environment would hide what a bad workspace does, and the other way around.
  for (const cell of ["B1", "B3"]) {
    for (const hostile of ["evil.com/#", "evil.com", "a.b", "x/y", "a@b", "a b", "a:80", "..", ""]) {
      sheet.getRange(cell).setValue(`'${hostile}`);

      const result = redirect(world);

      if (result.link) assert.equal(new URL(result.link).hostname, HOSTS.sandbox, `${cell}=${hostile} -> ${result.link}`);
    }
    // Put the cell back as the login left it.
    sheet.getRange(cell).setValue(cell === "B1" ? "myworkspace" : "sandbox");
  }
});

scenario("the environment is read in any letter case, as the original did", () => {
  const world = loggedIn("sandbox", "abc123");
  world.workbook.getSheetByName("Credentials").getRange("B3").setValue("Sandbox");

  const result = redirect(world);

  assert.ok(result.link === undefined || result.link === "https://myworkspace.sandbox.starkbank.com/cart/abc123", String(result.link));
});

scenario("an empty cart id gives the link of the cart page, as the original did", () => {
  assert.deepEqual(redirect(loggedIn("sandbox", "")), {link: "https://myworkspace.sandbox.starkbank.com/cart/"});
  assert.deepEqual(redirect(loggedIn("sandbox", "-")), {link: "https://myworkspace.sandbox.starkbank.com/cart/-"});
});

scenario("a numeric cart id (Sheets turns it into a number) gives its link instead of an error", () => {
  // The original failed here: the cell holds a number and a number has no toLowerCase().
  const world = newLoginWorld("sandbox");
  login(world);
  world.workbook.getSheetByName("Credentials").getRange("C6").setValue("12345");

  assert.deepEqual(redirect(world), {link: "https://myworkspace.sandbox.starkbank.com/cart/12345"});
});

scenario("without a login there is no link to open", () => {
  const world = newLoginWorld("sandbox");

  const result = redirect(world);

  assert.equal(result.link, undefined);
  assert.match(result.error, /carrinho/);
});

run();
