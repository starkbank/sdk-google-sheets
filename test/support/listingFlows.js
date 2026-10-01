"use strict";

// End to end flows that copy data from the API (or from other cells) into the sheets. They are
// run with legitimate data to record what ends up in the cells, and with hostile data to check
// that nothing is read as a formula.

const {newLoginWorld, login} = require("./login");

const CREATED = "2024-03-05T14:30:00.000000+00:00";
const CREATED_LATE = "2024-03-05T01:30:00.000000+00:00";

// A flow may fail (API error, missing field): the tests look at what was written before it did.
function invokeRecording(world, name, ...args) {
  try {
    world.invoke(name, ...args);
  } catch (error) {
    // Not a test failure: the cells and the requests are what is checked.
  }
}

function loggedInWorld() {
  const world = newLoginWorld();
  login(world);
  world.api.requests.length = 0;
  return world;
}

// Serves pages of the given items: the cursor of a page is the index of the next one.
function paged(listKey, items, pageSize = 2) {
  return request => {
    const start = Number(request.query.cursor || 0);
    const next = start + pageSize;
    return {body: {[listKey]: items.slice(start, next), cursor: next < items.length ? String(next) : null}};
  };
}

const legitimate = {
  transfers: [
    {created: CREATED, id: "5001", amount: 123456, status: "success", name: "José da Silva & Filhos Ltda", taxId: "012.345.678-90",
      bankCode: "341", branchCode: "1234", accountNumber: "12345-6", transactionIds: ["t1", "t2"]},
    {created: CREATED_LATE, id: "5002", amount: 50, status: "processing", name: "Loja do Zé (matriz)", taxId: "12.345.678/0001-90",
      bankCode: "20018183", branchCode: "0001", accountNumber: "9-9", transactionIds: []},
    {created: CREATED, id: "5003", amount: 1000000, status: "failed", name: "+55 (11) 99999-9999", taxId: "98765432100",
      bankCode: "001", branchCode: "4321", accountNumber: "1", transactionIds: ["t9"]},
  ],
  boletos: [
    {created: CREATED, name: "Maria O'Brien", taxId: "012.345.678-90", status: "registered", amount: 15000, due: "2024-04-10",
      line: "34191.09008 61207.727808 71444.640008 5 91990000015000", id: "6001", fee: 200, tags: ["loja", "sp"]},
    {created: CREATED_LATE, name: "Empresa 100% Brasil", taxId: "12.345.678/0001-90", status: "paid", amount: 99, due: "2024-04-11",
      line: "", id: "6002", fee: 0, tags: []},
    {created: CREATED, name: "@handle e 'aspas' \"duplas\"", taxId: "98765432100", status: "overdue", amount: 2500, due: "2024-01-01",
      line: "0000", id: "6003", fee: 1, tags: ["a,b", "c"]},
  ],
  transactions: [
    {created: CREATED, amount: 10000, balance: 250000, description: "Transferência para José & Cia", flow: "out", id: "9001", fee: 100,
      source: "transfer/5001", tags: ["a", "b"]},
    {created: CREATED_LATE, amount: 55, balance: 249945, description: "Boleto 100% pago (ref. 12)", flow: "in", id: "9002", fee: 0,
      source: "boleto/6002", tags: []},
    {created: CREATED, amount: 1, balance: 249946, description: "-", flow: "in", id: "9003", fee: 0, source: "invoice/7001", tags: ["x,y"]},
  ],
  chargePayments: [
    {created: CREATED, amount: 15000, description: "Pagamento de boleto A", id: "4001", line: "34191.09008 61207.727808", scheduled: "2024-04-10",
      status: "success", tags: ["loja"]},
    {created: CREATED_LATE, amount: 99, description: "O'Brien & Filhos", id: "4002", line: "00190.00009", scheduled: "2024-04-11",
      status: "processing", tags: []},
  ],
  customers: [
    {id: "3001", name: "Maria da Silva", taxId: "012.345.678-90", email: "maria@example.com", phone: "+5511999999999",
      address: {streetLine1: "Rua das Flores, 10", streetLine2: "Apto 2", district: "Centro", city: "São Paulo", stateCode: "SP", zipCode: "01000-000"},
      tags: ["vip", "sp"]},
    {id: "3002", name: "Empresa & Cia", taxId: "12.345.678/0001-90", email: "contato@empresa.example", phone: "(11) 3333-4444",
      address: {streetLine1: "Av. Paulista, 1000", streetLine2: "", district: "Bela Vista", city: "São Paulo", stateCode: "SP", zipCode: "01310-100"},
      tags: []},
  ],
  paymentRequests: [
    {created: CREATED, type: "transfer", description: "Fornecedor A", amount: 123400, status: "pending", id: "2001", tags: ["x"],
      actions: [{name: "Criador"}, {name: "Maria Aprovadora"}], payment: {name: "José & Cia", taxId: "012.345.678-90", bankCode: "341", branchCode: "1234", accountNumber: "1-9"}},
    {created: CREATED_LATE, type: "boleto-payment", description: "Boleto luz", amount: 5000, status: "approved", id: "2002", tags: [],
      actions: [{name: "Criador"}, {name: "João"}], payment: {taxId: "12.345.678/0001-90", line: "34191.09008 61207.727808", barCode: null}},
    {created: CREATED, type: "boleto-payment", description: "Boleto água", amount: 7000, status: "approved", id: "2003", tags: ["a", "b"],
      actions: [{name: "Criador"}, {name: "Ana"}], payment: {taxId: "98765432100", line: null, barCode: "34191090086120772780871444640008591990000015000"}},
    {created: CREATED, type: "darf-payment", description: "Imposto", amount: 9000, status: "pending", id: "2004", tags: [],
      actions: [{name: "Criador"}, {name: "Pedro"}], payment: {taxId: "12.345.678/0001-90", line: null, barCode: "85800000000"}},
    {created: CREATED_LATE, type: "utility-payment", description: "Conta de gás", amount: 100, status: "denied", id: "2005", tags: ["z"],
      actions: [{name: "Criador"}, {name: "Lia"}], payment: {taxId: "12.345.678/0001-90", line: "83660000001", barCode: null}},
    {created: CREATED, type: "brcode-payment", description: "Pix copia e cola", amount: 250, status: "pending", id: "2006", tags: [],
      actions: [{name: "Criador"}, {name: "Rui"}], payment: {name: "Loja", taxId: "98765432100"}},
  ],
  invoices: [
    {created: CREATED, name: "Ana Souza", taxId: "012.345.678-90", status: "paid", amount: 1000, nominalAmount: 1000, discountAmount: 100,
      fineAmount: 0, interestAmount: 0, due: "2024-04-10", expiration: 3600, brcode: "00020126580014br.gov.bcb.pix", id: "7001", fee: 5,
      tags: ["x"], pdf: "https://example.com/invoice/7001.pdf", splits: [{amount: 300}, {amount: 200}]},
    {created: CREATED_LATE, name: "Carlos", taxId: "98765432100", status: "created", amount: 500, nominalAmount: 500, discountAmount: 0,
      fineAmount: 10, interestAmount: 5, due: "2024-05-01", expiration: 86400, brcode: "", id: "7002", fee: 0,
      tags: [], pdf: "https://example.com/invoice/7002.pdf", splits: []},
  ],
};

function transferFlow(data = legitimate.transfers) {
  const world = loggedInWorld();
  world.api.stub("GET", /^\/transfer$/, paged("transfers", data));
  invokeRecording(world, "ViewTransfer", "2024-03-01", "2024-03-31", "success");
  return world;
}

function chargeFlow(data = legitimate.boletos) {
  const world = loggedInWorld();
  world.api.stub("GET", /^\/boleto$/, paged("boletos", data));
  invokeRecording(world, "ViewCharge", "2024-03-01", "2024-03-31", "registered");
  return world;
}

function invoiceFlow(data = legitimate.invoices) {
  const world = loggedInWorld();
  world.api.stub("GET", /^\/invoice$/, paged("invoices", data));
  invokeRecording(world, "ViewInvoice", "2024-03-01", "2024-03-31", "paid");
  return world;
}

function paymentRequestFlow(data = legitimate.paymentRequests) {
  const world = loggedInWorld();
  world.api.stub("GET", /^\/payment-request$/, paged("requests", data));
  invokeRecording(world, "ViewPaymentRequest", "2024-03-01", "2024-03-31", "pending", "center-1", "transfer");
  return world;
}

function statementFlow(data = legitimate.transactions) {
  const world = loggedInWorld();
  world.api.stub("GET", /^\/transaction$/, paged("transactions", data));
  invokeRecording(world, "ViewStatement", "2024-03-01", "2024-03-31");
  return world;
}

function chargePaymentFlow(data = legitimate.chargePayments) {
  const world = loggedInWorld();
  world.api.stub("GET", /^\/boleto-payment$/, paged("payments", data));
  invokeRecording(world, "ViewChargePayment", "2024-03-01", "2024-03-31", "success");
  return world;
}

function customersFlow(data = legitimate.customers) {
  const world = loggedInWorld();
  world.api.stub("GET", /^\/boleto\/customer$/, paged("customers", data));
  invokeRecording(world, "fetchCustomers");
  return world;
}

const dictKeys = {
  "a@b.com": {key: {name: "Fulano de Tal", taxId: "012.345.678-90", ispb: "18236120", branchCode: "0001", accountNumber: "12345", type: "email", accountType: "checking"}},
  "+5511999999999": {key: {name: "Empresa & Cia", taxId: "12.345.678/0001-90", ispb: "00000000", branchCode: "1234", accountNumber: "777", type: "phone", accountType: "payment"}},
  "123e4567-e89b-12d3-a456-426614174000": {key: {name: "Beltrano - filial", taxId: "98765432100", ispb: "60701190", branchCode: "4321", accountNumber: "1", type: "evp", accountType: "savings"}},
};

function dictKeyFlow(keyNames = dictKeys, notes = {}) {
  const world = loggedInWorld();
  world.api.stub("GET", /^\/dict-key\/.+$/, request => {
    const key = decodeURIComponent(request.path.replace("/dict-key/", ""));
    return keyNames[key] ? {body: keyNames[key]} : {status: 400, body: {errors: [{code: "invalidPixKey", message: "chave inválida"}]}};
  });
  const sheet = world.workbook.getSheetByName("Consulta de Chave PIX");
  const rows = [
    ["a@b.com", 1000, "tag1", "Pagamento A", "Fatura A"],
    ["'5511999999999", 2550, "tag2,tag3", "Pagamento B", "Fatura B"],
    ["123e4567-e89b-12d3-a456-426614174000", 1, "", notes.description || "Pagamento C", notes.display || ""],
  ];
  rows.forEach((row, index) => {
    sheet.getRange(`A${11 + index}`).setValue(row[0]);
    sheet.getRange(`B${11 + index}`).setValue(row[1]);
    sheet.getRange(`C${11 + index}`).setValue(row[2]);
    sheet.getRange(`D${11 + index}`).setValue(row[3]);
    sheet.getRange(`E${11 + index}`).setValue(row[4]);
  });
  world.alertAnswer = "OK";
  invokeRecording(world, "getDictKey");
  return world;
}

function downloadFlow(ids = {charge: "6001", transfer: "5001", chargePayment: "4001"}) {
  const world = loggedInWorld();
  world.api.stub("GET", /^\/(boleto|transfer|boleto-payment)\/.+\/pdf$/, () => ({body: {}}));
  invokeRecording(world, "ChargeDownload", ids.charge);
  invokeRecording(world, "TransferDownload", ids.transfer);
  invokeRecording(world, "ChargePaymentDownload", ids.chargePayment);
  return world;
}

module.exports = {
  legitimate, dictKeys, transferFlow, chargeFlow, invoiceFlow, dictKeyFlow, statementFlow, chargePaymentFlow, customersFlow, paymentRequestFlow,
  downloadFlow, loggedInWorld,
};
