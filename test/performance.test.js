"use strict";

// Every call to a spreadsheet, sheet or range is a round trip in Apps Script, and a flow has 6 minutes.
// The flows must cost a number of calls that grows with the pages (100 items each) or batches, never
// with the rows or the columns. PERF_REPORT=1 prints the counts.

const assert = require("node:assert/strict");
const {legitimate, dictKeys, paged} = require("./support/listingFlows");
const {fill, newWorld, run, date} = require("./support/goldenFlows");
const {createScenarioRunner} = require("./support/scenarios");

const {scenario, run: runScenarios} = createScenarioRunner("Performance");

const ITEMS = 250;
const SHEET_CALL_BUDGET = 60;

function many(base, count = ITEMS, idOf = index => String(100000 + index)) {
  return Array.from({length: count}, (_, index) => ({...base, id: idOf(index)}));
}

function rows(count, rowOf) {
  return Array.from({length: count}, (_, index) => rowOf(index));
}

function measure(world, name, ...args) {
  world.resetServiceCalls();
  run(world, name, ...args);
  const outcome = world.outcomes[world.outcomes.length - 1];
  assert.ok(!outcome.error, `${name} failed: ${outcome.error}`);
  if (process.env.PERF_REPORT) {
    console.log(`       ${name}: ${world.sheetCalls()} sheet calls, ${JSON.stringify(world.serviceCalls)}`);
  }
  return world.sheetCalls();
}

function assertWithinBudget(calls, budget = SHEET_CALL_BUDGET) {
  assert.ok(calls <= budget, `${calls} sheet calls (budget ${budget})`);
}

const listings = [
  ["ViewStatement", ["2024-03-01", "2024-03-31"], /^\/transaction$/, "transactions", legitimate.transactions[0]],
  ["ViewTransfer", ["2024-03-01", "2024-03-31", "success"], /^\/transfer$/, "transfers", legitimate.transfers[0]],
  ["ViewCharge", ["2024-03-01", "2024-03-31", "registered"], /^\/boleto$/, "boletos", legitimate.boletos[0]],
  ["ViewChargePayment", ["2024-03-01", "2024-03-31", "success"], /^\/boleto-payment$/, "payments", legitimate.chargePayments[0]],
  ["ViewInvoice", ["2024-03-01", "2024-03-31", "paid"], /^\/invoice$/, "invoices", legitimate.invoices[0]],
  ["ViewPaymentRequest", ["2024-03-01", "2024-03-31", "pending", "center-1", "transfer"], /^\/payment-request$/, "requests", legitimate.paymentRequests[0]],
  ["fetchCustomers", [], /^\/boleto\/customer$/, "customers", legitimate.customers[0]],
];

for (const [name, args, route, listKey, base] of listings) {
  scenario(`listing: ${name} with ${ITEMS} items stays within the sheet call budget`, () => {
    const world = newWorld();
    world.api.stub("GET", route, paged(listKey, many(base), 100));
    assertWithinBudget(measure(world, name, ...args));
  });
}

scenario(`listing: boleto events with ${ITEMS} items stay within the sheet call budget`, () => {
  const world = newWorld();
  const logs = many({}).map(({id}) => ({created: "2024-03-05T14:30:00.000000+00:00",
    boleto: {...legitimate.boletos[0], id, status: "paid", amount: 15500, fine: 2, barCode: "0", streetLine1: "", streetLine2: "", district: "", city: "", stateCode: "", zipCode: ""}}));
  world.api.stub("GET", /^\/boleto\/log$/, request => request.query.types === "registered"
    ? {body: {logs: request.query.boletoIds.split(",").map(id => ({boleto: {id, amount: 15000, fine: 2}})), cursor: null}}
    : paged("logs", logs, 100)(request));
  assertWithinBudget(measure(world, "viewChargeEvents", "2024-03-01", "2024-03-31", "paid"));
});

scenario(`listing: splits with ${ITEMS} items stay within the sheet call budget`, () => {
  const world = newWorld();
  const splits = many({}).map(({id}) => ({created: "2024-03-05", source: `invoice/${id}`, receiverId: "r1", amount: 1, status: "success"}));
  world.api.stub("GET", /^\/split$/, paged("splits", splits, 100));
  world.api.stub("GET", /^\/split-receiver$/, () => ({body: {receivers: [{id: "r1", taxId: "012.345.678-90"}]}}));
  assertWithinBudget(measure(world, "viewSplits", "2024-03-01", "2024-03-31", "success"));
});

scenario("greetings cost a few calls per sheet", () => {
  const world = newWorld();
  world.api.stub("GET", /^\/balance$/, () => ({body: {balances: [{amount: 1}]}}));
  const sheetCount = world.workbook.getSheets().length;
  assertWithinBudget(measure(world, "SetAllGreetings"), 6 * sheetCount);
});

scenario(`input: ${ITEMS} transfers for approval stay within the sheet call budget`, () => {
  const world = newWorld();
  fill(world, "Transferência com Aprovação", rows(ITEMS, index => [`Pessoa ${index}`, "'012.345.678-90", 10 + index, "'341", "'0001", `'${index}`, date(2024, 4, 10), "", "a,b", "Pagamento", ""]));
  world.api.stub("POST", /^\/payment-request$/, () => ({body: {requests: []}}));
  assertWithinBudget(measure(world, "managePaymentRequestTransfer", "center-1"));
});

scenario(`input: ${ITEMS} boleto payments for approval stay within the sheet call budget`, () => {
  const world = newWorld();
  fill(world, "Pagamento de Boletos", rows(ITEMS, index => [`'3419109008612077278087144464000859199${String(index).padStart(10, "0")}`, "'012.345.678-90", "", "Conta", ""]));
  world.api.stub("POST", /^\/payment-request$/, () => ({body: {requests: []}}));
  assertWithinBudget(measure(world, "executeBoletoPayment", "center-1"));
});

scenario(`input: ${ITEMS} invoices stay within the sheet call budget`, () => {
  const world = newWorld();
  fill(world, "Emissão de Invoice Pix", rows(ITEMS, index => [`Cliente ${index}`, "'012.345.678-90", 10, "", "", "", "", "Pedido", `'${index}`, "", "", "", ""]));
  world.api.stub("POST", /^\/invoice$/, () => ({body: {invoices: []}}));
  assertWithinBudget(measure(world, "sendInvoices"));
});

scenario(`input: ${ITEMS} split receivers stay within the sheet call budget`, () => {
  const world = newWorld();
  fill(world, "Split Receivers", rows(ITEMS, index => [`Recebedor ${index}`, "'012.345.678-90", "'341", "'0001", `'${index}`, "checking", "a"]));
  world.api.stub("POST", /^\/split-receiver$/, () => ({body: {receivers: []}}));
  assertWithinBudget(measure(world, "SplitReceivers"));
});

scenario(`input: ${ITEMS} cards stay within the sheet call budget`, () => {
  const world = newWorld();
  fill(world, "Solicitação de Cartões", rows(ITEMS, index => ["Kit Básico", "Loja", `Pessoa ${index}`, "PESSOA", "'11999999999", "rua a", "", "Centro", "Rio", "RJ", "'20000-000"]));
  world.api.stub("POST", /^\/corporate-shop-cart$/, () => ({body: {cart: {id: "cart-1"}}}));
  world.api.stub("GET", /^\/corporate-shop-kit$/, () => ({body: {kits: [{id: "kit-1", name: "Kit Básico"}]}}));
  world.api.stub("POST", /^\/corporate-shop-item$/, () => ({body: {items: []}}));
  assertWithinBudget(measure(world, "cartShop"));
});

scenario(`input: ${ITEMS} boletos stay within the sheet call budget`, () => {
  const world = newWorld();
  fill(world, "Emissão de Boletos", rows(ITEMS, index => [`Cliente ${index}`, "'012.345.678-90", "Rua", "", "Centro", "Rio", "RJ", "'20000-000", 10, "", "", "", "", "", "",
    "Serviço", 10, "", "", "", "", "a"]));
  world.api.stub("POST", /^\/boleto$/, () => ({body: {boletos: []}}));
  assertWithinBudget(measure(world, "createBoleto"));
});

scenario(`input: ${ITEMS} customers stay within the sheet call budget`, () => {
  const world = newWorld();
  fill(world, "Cadastro de Clientes", rows(ITEMS, index => [`Cliente ${index}`, "'012.345.678-90", "a@b.com", "'+5511999999999", "Rua", "", "Centro", "Rio", "RJ", "'20000-000", "a"]));
  assertWithinBudget(measure(world, "createCustomers"));
});

scenario("pix keys are looked up in parallel and written in one call per chunk", () => {
  const world = newWorld();
  const keyCount = 25;
  world.api.stub("GET", /^\/dict-key\/.+$/, () => ({body: dictKeys["a@b.com"]}));
  fill(world, "Consulta de Chave PIX", rows(keyCount, index => [`pessoa${index}@b.com`, 10, "", "Pagamento", ""]));
  world.alertAnswer = "CANCEL";

  assertWithinBudget(measure(world, "getDictKey"));

  assert.equal(world.serviceCalls["UrlFetchApp.fetchAll"], 3);
  assert.equal(world.serviceCalls["UrlFetchApp.fetch"] || 0, 0);
  assert.equal(world.api.requests.filter(request => request.path.startsWith("/dict-key/")).length, keyCount);
});

scenario("drive downloads run in parallel", () => {
  const world = newWorld();
  const transferCount = 25;
  world.api.stub("GET", /^\/transfer$/, paged("transfers", many(legitimate.transfers[0], transferCount), 100));
  world.api.stub("GET", /^\/transfer\/[^/]+\/pdf$/, () => ({body: {}}));
  run(world, "ViewTransfer", "2024-03-01", "2024-03-31", "success");

  assertWithinBudget(measure(world, "TransferDownloadAllDrive"));

  assert.equal(world.serviceCalls["UrlFetchApp.fetchAll"], 3);
  assert.equal(world.serviceCalls["UrlFetchApp.fetch"] || 0, 0);
  assert.equal(world.driveFiles.length, transferCount);
});

scenario(`download lists read ${ITEMS} listed rows in one call`, () => {
  const world = newWorld();
  world.api.stub("GET", /^\/transfer$/, paged("transfers", many(legitimate.transfers[0]), 100));
  run(world, "ViewTransfer", "2024-03-01", "2024-03-31", "success");

  assertWithinBudget(measure(world, "getTransferDownloadList"), 5);
});

scenario("a request reads no cell it does not need", () => {
  const world = newWorld();
  world.resetServiceCalls();

  world.evaluate('fetch("/balance")');

  // The legacy credentials check reads its range once; nothing else is read.
  assert.equal(world.serviceCalls["range.getValues"], 1);
  assert.equal(world.serviceCalls["range.getValue"] || 0, 0);
});

runScenarios();
