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

function sentRequests(world) {
  return posted(world, "/payment-request").flatMap(payload => payload.requests);
}

function sendRows(flow, rowsToSend) {
  const world = newWorld();
  fill(world, flow.sheet, rowsToSend);
  world.api.stub("POST", /^\/payment-request$/, () => ({body: {requests: []}}));
  world.api.stub("POST", /^\/invoice$/, () => ({body: {invoices: []}}));
  run(world, flow.name, "center-1");
  return world;
}

const line = "'34191.09008 61207.727808 71444.640008 5 91990000015000";

scenario("boleto payments: tags are sent as a list", () => {
  const world = sendRows(requestFlows.boletos, [[line, "'012.345.678-90", "", "Conta", "açaí, b"]]);

  assert.deepEqual(world.outcomes.map(outcome => outcome.error), [undefined]);
  assert.deepEqual(sentRequests(world).map(request => request.payment.tags), [["acai", " b"]]);
});

scenario("boleto payments: a date cell is sent as its day", () => {
  const world = sendRows(requestFlows.boletos, [[line, "'012.345.678-90", date(2024, 4, 11), "Conta", ""]]);

  assert.deepEqual(sentRequests(world).map(request => request.due), ["2024-04-11"]);
});

scenario("a date typed as text keeps its day", () => {
  const boletos = sendRows(requestFlows.boletos, [[line, "'012.345.678-90", "2024-04-10", "Conta", ""]]);
  const transfers = sendRows(requestFlows.transfers, [["Ana", "'012.345.678-90", 10, "'341", "'0001", "'1", "2024-04-10", "", "", "", ""]]);

  assert.deepEqual(sentRequests(boletos).map(request => request.due), ["2024-04-10"]);
  assert.deepEqual(sentRequests(transfers).map(request => request.due), ["2024-04-10"]);
});

scenario("numbers in text columns are sent as text", () => {
  const transfers = sendRows(requestFlows.transfers, [["Ana", 1234567890, 10, 341, 1234, 98765, "", "", "", 2024, ""]]);
  const boletos = sendRows(requestFlows.boletos, [[line, "'012.345.678-90", "", 2024, ""]]);
  const invoices = sendRows({name: "sendInvoices", sheet: "Emissão de Invoice Pix"}, [[123, 12345678909, 10, "", "", "", "", "Pedido", 55, "", "", "", ""]]);

  assert.deepEqual(transfers.outcomes.map(outcome => outcome.error), [undefined]);
  assert.deepEqual(sentRequests(transfers).map(request => request.payment), [
    {name: "Ana", taxId: "1234567890", amount: 1000, bankCode: "341", branchCode: "1234", accountNumber: "98765", description: "2024"},
  ]);
  assert.deepEqual(sentRequests(boletos).map(request => request.payment.description), ["2024"]);
  assert.deepEqual(invoices.outcomes.map(outcome => outcome.error), [undefined]);
  assert.deepEqual(posted(invoices, "/invoice").flatMap(payload => payload.invoices).map(invoice => [invoice.name, invoice.taxId, invoice.descriptions]),
    [["123", "12345678909", [{key: "Pedido", value: "55"}]]]);
});

const pixKeyAnswers = {
  "a@b.com": {key: {name: "Fulano", taxId: "012.345.678-90", ispb: "00000000", branchCode: "0001", accountNumber: "0012", type: "email", accountType: "checking"}},
  "+5511999999999": {key: {name: "Empresa", taxId: "12.345.678/0001-90", ispb: "18236120", branchCode: "1234", accountNumber: "777", type: "phone", accountType: "payment"}},
  "maria@uol.com": {key: {name: "Maria", taxId: "98765432100", ispb: "60701190", branchCode: "4321", accountNumber: "1", type: "email", accountType: "savings"}},
};

function pixKeysWorld(keyRows, answer = "OK") {
  const world = newWorld();
  world.api.stub("GET", /^\/dict-key\/.+$/, request => {
    const key = decodeURIComponent(request.path.replace("/dict-key/", ""));
    return pixKeyAnswers[key] ? {body: pixKeyAnswers[key]} : {status: 400, body: {errors: [{code: "invalidPixKey", message: "chave inválida"}]}};
  });
  fill(world, "Transferência com Aprovação", rows(5, index => [`Antigo ${index}`, "'012", 1, "'341", "'0001", "'1", date(2024, 5, 1), "", "a", "b", "c", "Enviado", "motivo"]));
  fill(world, "Consulta de Chave PIX", keyRows);
  world.alertAnswer = answer;
  run(world, "getDictKey");
  return world;
}

function transferCells(world) {
  return world.workbook.getSheetByName("Transferência com Aprovação").cells;
}

scenario("moving keys erases the older transfer rows and their statuses", () => {
  const world = pixKeysWorld([["a@b.com", 10, "t", "Pagamento A", "Fatura A"], ["maria@uol.com", 20, "", "Pagamento M", ""]]);
  const cells = transferCells(world);

  assert.equal(cells.get("11,1"), "Fulano");
  assert.equal(cells.get("12,1"), "Maria");
  for (const column of [7, 12, 13]) {
    assert.equal(cells.has(`11,${column}`), false, `column ${column}`);
    assert.equal(cells.has(`12,${column}`), false, `column ${column}`);
  }
  for (const line of [13, 14, 15]) {
    for (let column = 1; column <= 13; column++) assert.equal(cells.has(`${line},${column}`), false, `${line},${column}`);
  }
});

scenario("cancelling the move erases nothing", () => {
  const world = pixKeysWorld([["a@b.com", 10, "t", "Pagamento A", "Fatura A"]], "CANCEL");
  const cells = transferCells(world);

  for (let line = 11; line <= 15; line++) {
    assert.equal(cells.get(`${line},1`), `Antigo ${line - 11}`);
    assert.equal(cells.get(`${line},12`), "Enviado");
  }
});

scenario("one invalid key is reported", () => {
  const world = pixKeysWorld([["a@b.com", 10, "", "Pagamento A", ""], ["nao-existe@b.com", 5, "", "Pagamento X", ""]]);

  assert.deepEqual(world.alerts, ["Algumas chaves estão incorretas, verifique as informações e tente novamente."]);
  assert.equal(transferCells(world).get("11,1"), "Antigo 0");
});

scenario("only a 13-digit key gets a +", () => {
  const world = pixKeysWorld([["maria@uol.com", 1, "", "Pagamento", ""], [5511999999999, 1, "", "Pagamento", ""], ["'5511999999999", 1, "", "Pagamento", ""]], "CANCEL");

  const paths = world.api.requests.filter(request => request.path.startsWith("/dict-key/")).map(request => decodeURIComponent(request.path));
  assert.deepEqual(paths, ["/dict-key/maria@uol.com", "/dict-key/+5511999999999", "/dict-key/+5511999999999"]);
});

scenario("bank code, branch and account keep their leading zeros", () => {
  const world = pixKeysWorld([["a@b.com", 10, "", "Pagamento A", ""]]);
  const cells = transferCells(world);

  assert.deepEqual([cells.get("11,4"), cells.get("11,5"), cells.get("11,6")], ["00000000", "0001", "0012"]);
  assert.equal(cells.get("11,3"), 10);
});

runScenarios();
