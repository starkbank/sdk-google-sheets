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

const transferRow = index => [`Pessoa ${index}`, "'012.345.678-90", 10 + index, "'341", "'0001", `'${index}`, "", "", "", "Pagamento", ""];
const boletoRow = index => [`'3419109008612077278087144464000859199${String(index).padStart(10, "0")}`, "'012.345.678-90", "", "Conta", ""];

const requestFlows = {
  transfers: {name: "managePaymentRequestTransfer", sheet: "Transferência com Aprovação", rowOf: transferRow, status: 12, notSent: "Não enviado", history: "transfer"},
  boletos: {name: "executeBoletoPayment", sheet: "Pagamento de Boletos", rowOf: boletoRow, status: 6, notSent: "Não enviado.", history: "boleto"},
};

function requestWorld(flow, rowCount, answerOf) {
  const world = newWorld();
  fill(world, flow.sheet, rows(rowCount, flow.rowOf));
  let batch = 0;
  world.api.stub("POST", /^\/payment-request$/, () => answerOf(batch++));
  run(world, flow.name, "center-1");
  return world;
}

function statusOf(world, flow, line) {
  const sheet = world.workbook.getSheetByName(flow.sheet);
  return [sheet.cells.get(`${line},${flow.status}`), sheet.cells.get(`${line},${flow.status + 1}`)];
}

function history(world, flow) {
  return JSON.parse(world.workbook.getSheetByName("paymentRequestExternal").cells.get("1,3"))[flow.history];
}

const rejections = {
  400: {status: 400, body: {errors: [{code: "invalidPayment", message: "Element 1: conta inválida"}]}},
  401: {status: 401, body: {errors: [{code: "unauthorized", message: "Acesso negado"}]}},
  429: {status: 429, body: {errors: [{code: "tooManyRequests", message: "Muitas requisições"}]}},
};

const unknowns = {
  500: {status: 500, body: {errors: [{code: "internalServerError", message: "Erro interno"}]}},
  "503 with an HTML page": {status: 503, raw: "<html><body>Service Unavailable</body></html>"},
  "no answer": {throws: "Address unavailable: https://sandbox.api.starkbank.com/v2/payment-request"},
};

for (const [flowName, flow] of Object.entries(requestFlows)) {
  for (const [status, answer] of Object.entries(rejections)) {
    scenario(`${flowName}: a batch the API rejects with ${status} is reported as failed`, () => {
      const world = requestWorld(flow, 3, () => answer);

      assert.equal(world.alerts.length, 1);
      assert.match(world.alerts[0], /^Falha no envio, verifique a situação de suas solicitações\./);
      assert.ok(world.alerts[0].includes(answer.body.errors[0].message.replace(/^Element \d+:/, "")), world.alerts[0]);
      assert.deepEqual(history(world, flow), []);
      assert.equal(statusOf(world, flow, 11)[0], flow.notSent);
      if (status === "400") assert.deepEqual(statusOf(world, flow, 12), ["Falha", " conta inválida"]);
    });
  }

  for (const [kind, answer] of Object.entries(unknowns)) {
    scenario(`${flowName}: a batch with an unknown outcome (${kind}) asks to check before sending again`, () => {
      const world = requestWorld(flow, 3, () => answer);

      assert.equal(world.alerts.length, 1);
      assert.match(world.alerts[0], /Consulta de Aprovações/);
      assert.doesNotMatch(world.alerts[0], /Todos os itens foram enviados/);
      assert.deepEqual(history(world, flow), []);
      for (const line of [11, 12, 13]) assert.equal(statusOf(world, flow, line)[0], "Verificar", `row ${line}`);
    });
  }

  scenario(`${flowName}: 150 rows with every batch rejected show the all-failed message`, () => {
    const world = requestWorld(flow, 150, () => rejections[400]);

    assert.equal(world.alerts.length, 1);
    assert.match(world.alerts[0], /^Falha no envio, verifique a situação de suas solicitações\.\n\nErro - Linha 12: conta inválida\nErro - Linha 112: conta inválida\n$/);
  });

  scenario(`${flowName}: an error on element 0 of batch 2 lands on row 111`, () => {
    const world = requestWorld(flow, 150, batch => batch === 0 ? {body: {requests: []}}
      : {status: 400, body: {errors: [{code: "invalidPayment", message: "Element 0: conta inválida"}]}});

    assert.deepEqual(statusOf(world, flow, 110), ["Enviado", undefined]);
    assert.deepEqual(statusOf(world, flow, 111), ["Falha", " conta inválida"]);
    assert.equal(statusOf(world, flow, 112)[0], flow.notSent);
    assert.equal(history(world, flow).length, 100);
    assert.match(world.alerts[0], /^Falha no envio de alguns itens, verifique a situação de suas solicitações\.\n\nErro - Linha 111: conta inválida\n$/);
  });
}

runScenarios();
