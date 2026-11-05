"use strict";

// What the flows that send rows of a sheet to the API send, and what they tell the person.

const assert = require("node:assert/strict");
const {fill, newWorld, run, date} = require("./support/goldenFlows");
const {createScenarioRunner} = require("./support/scenarios");

const {scenario, run: runScenarios} = createScenarioRunner("Flows");

function rows(count, rowOf) {
  return Array.from({length: count}, (_, index) => rowOf(index));
}

function posted(world, path) {
  return world.api.requests.filter(request => request.method === "POST" && request.path === path).map(request => JSON.parse(request.payload));
}

scenario("150 invoices go out as 100 and 50, each row once", () => {
  const world = newWorld();
  fill(world, "Emissão de Invoice Pix", rows(150, index => [`Cliente ${index}`, "'012.345.678-90", 10, "", "", "", "", "", "", "", "", "", ""]));
  world.api.stub("POST", /^\/invoice$/, request => JSON.parse(request.payload).invoices.length > 100
    ? {status: 400, body: {errors: [{code: "invalidJson", message: "Too many invoices"}]}}
    : {body: {invoices: []}});

  run(world, "sendInvoices");

  const batches = posted(world, "/invoice").map(payload => payload.invoices.map(invoice => invoice.name));
  assert.deepEqual(batches.map(batch => batch.length), [100, 50]);
  assert.deepEqual(batches.flat(), rows(150, index => `Cliente ${index}`));
  assert.deepEqual(world.alerts, ["Sucesso! \nTodas as Invoices foram criadas !"]);
});

scenario("150 split receivers go out as 100 and 50, each row once", () => {
  const world = newWorld();
  fill(world, "Split Receivers", rows(150, index => [`Recebedor ${index}`, "'012.345.678-90", "'341", "'0001", `'${index}`, "checking", ""]));
  world.api.stub("POST", /^\/split-receiver$/, request => JSON.parse(request.payload).receivers.length > 100
    ? {status: 400, body: {errors: [{code: "invalidJson", message: "Too many receivers"}]}}
    : {body: {receivers: []}});

  run(world, "SplitReceivers");

  const batches = posted(world, "/split-receiver").map(payload => payload.receivers.map(receiver => receiver.name));
  assert.deepEqual(batches.map(batch => batch.length), [100, 50]);
  assert.deepEqual(batches.flat(), rows(150, index => `Recebedor ${index}`));
});

runScenarios();
