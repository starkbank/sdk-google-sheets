"use strict";

// Every flow leaves exactly what golden.json says: cells, requests, messages and files. golden.json
// was recorded on master before the performance work; a change of behavior on purpose records it
// again (RECORD_GOLDEN=1 node test/golden.test.js) and the diff of golden.json shows what changed.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {flows, recordFlow} = require("./support/goldenFlows");
const {createScenarioRunner} = require("./support/scenarios");

const {scenario, run} = createScenarioRunner("Golden");

const goldenFile = path.join(__dirname, "support", "golden.json");

if (process.env.RECORD_GOLDEN) {
  const golden = Object.fromEntries(Object.entries(flows).map(([name, flow]) => [name, recordFlow(flow())]));
  fs.writeFileSync(goldenFile, JSON.stringify(golden, null, 1) + "\n");
  console.log(`Recorded ${Object.keys(golden).length} flows in ${goldenFile}`);
  process.exit(0);
}

const golden = JSON.parse(fs.readFileSync(goldenFile, "utf8"));

scenario("every flow has a recording and every recording a flow", () => {
  assert.deepEqual(Object.keys(flows).sort(), Object.keys(golden).sort());
});

for (const [name, flow] of Object.entries(flows)) {
  scenario(`${name} leaves what it always left`, () => {
    assert.deepEqual(recordFlow(flow()), golden[name]);
  });
}

run();
