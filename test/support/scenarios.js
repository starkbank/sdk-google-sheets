"use strict";

// Tiny scenario runner shared by the test files.
// Usage: node test/<file>.test.js ["part of a scenario name"]

function createScenarioRunner(suiteName) {
  const scenarios = [];

  function scenario(name, body) {
    scenarios.push({name, body});
  }

  function run() {
    const nameFilter = process.argv[2];
    const selected = scenarios.filter(({name}) => !nameFilter || name.includes(nameFilter));
    let failures = 0;
    for (const {name, body} of selected) {
      try {
        body();
        console.log(`  ok   ${name}`);
      } catch (error) {
        failures += 1;
        console.log(`  FAIL ${name}`);
        console.log(String(error && error.stack || error).split("\n").map(line => `       ${line}`).join("\n"));
      }
    }

    if (failures > 0) {
      console.log(`\n${failures} of ${selected.length} ${suiteName} scenarios failed`);
      process.exit(1);
    }
    console.log(`\n${suiteName} tests passed (${selected.length} scenarios)`);
  }

  return {scenario, run};
}

module.exports = {createScenarioRunner};
