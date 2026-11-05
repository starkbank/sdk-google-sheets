function removeDiacritics(inputString) {
  if (inputString != null) {
    var diacriticsMap = {
      'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
      'ã': 'a', 'õ': 'o', 'ç': 'c', 'ñ': 'n',
      'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
      'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
      'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ü': 'u',
      'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
      'Ã': 'A', 'Õ': 'O', 'Ç': 'C', 'Ñ': 'N',
      'Â': 'A', 'Ê': 'E', 'Î': 'I', 'Ô': 'O', 'Û': 'U',
      'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U',
      'Ä': 'A', 'Ë': 'E', 'Ï': 'I', 'Ö': 'O', 'Ü': 'U',
      'ć': 'c', 'č': 'c', 'đ': 'd', 'š': 's', 'ž': 'z',
      'Ç': 'C', 'Ć': 'C', 'Č': 'C', 'Đ': 'D', 'Š': 'S', 'Ž': 'Z',
      '∂': '', 'ƒ': '', '†': '', '¥': '', '¨': '', '∆': '', '˙': '',
      '∫': '', '√': '', 'ß': '', '´': '', '∞': '', '§': '',
      '¶': '', '©': '', 'ƒ': '', '´': '', '®': '', '∆': '', '˜': '',
      '√': '', 'ƒ': '', '¥': '', '¨': '', 'ˆ': '',
      '∑': '', 'ø': '', 'π': '', '≥': '', '≤': '', 'µ': '',
      'œ': '', '¡': '', '™': '', '£': '', '¢': '', '§': '',
      '•': '', 'ª': '', 'º': '', '–': '', '“': '', '…': '',
      '¬': '', '˚': '', '¬': '', '˚': '', '∆': '', '˙': '',
      '©': '', 'ƒ': '', '∂': '', '∑': '', 'œ': '', '¡': '',
      '™': '', '£': '', '¢': '', '§': '', '¶': '', '•': '',
      'ª': '', 'º': '', '–': '', '≠': '', '‘': '', '“': '',
      'º': '', 'ª': '', '•': '', '¶': '', '§': '', '∞': '',
      '¢': '', '£': '', '™': '', 'œ': '', 'å': '', 'Ω': '',
      '≈': '', '√': '', '˜': '', 'µ': '', '≤': '', ' ': '',
      '≈': '', '∂': '', '®': '', '†': '', '¥': '',
      '¨': '', 'ˆ': '','ø':'', 'π':'', '≥':'', '≤':'', 'å':'',
      '∑':'', '´':'', '®':'', '∆':'', '˜':'', '∫':'', '√':'',
      'µ':'', '≤':'', '∂':'', '®':'', '†':'', '¥':'',
      '¨':'', 'ˆ':'', 'ø':'', 'π':'', '…':'', '¬':'', '≤':'',
      'µ':'', '˜':'', '∫':'', '√':'', 'ƒ':'', '§':'', '¶':'',
      '•':'', 'ª':'', 'º':'', 'π':'', '¬':'', '˚':'', '∆':'',
      '˙':'', '©':'', 'ƒ':'', '∂':'', '∑':'', 'œ':'', '¡':'',
      '™':'', '£':'', '¢':'', '§':'', '¶':'', '•':'', 'ª':'',
      'º':'', '–':'', '≠':'', '‘':'', '“':'', 'º':'', 'ª':'',
      '•':'', '¶':'', '§':'', '∞':'', '¢':'', '£':'', '™':'',
      'œ':'', 'å':'', 'Ω':'', '≈':'', '√':'', '˜':'',
      'µ':'', '≤':''
    };

    return inputString.replace(/[áéíóúãõçñâêîôûàèìòùäëïöüÁÉÍÓÚÃÕÇÑÂÊÎÔÛÀÈÌÒÙÄËÏÖÜćčđšžÇĆČĐŠŽ∂ƒ†¥¨∆˙∫√çß´∞§¶¨∆˙√çß∑¢∞§¶¨∆˙©ƒ∂´®∆˜√ƒ¥¨ˆ∑øπ≥≤µœ¡™£¢∞§¶•ªº–“…¬˚∆˙©ƒ∂∑œ¡™£¢∞§¶•ªº–≠‘“ºª•¶§∞¢£™œåΩ≈ç√∫˜µ≤ç≈∂®†¥¨ˆøπ…¬≤µ˜∫√ƒ∂®§¶•ªºπ¬˚˜∫√çß∑´•ª]/g, function (match) {
      return diacriticsMap[match];
    });
  }
  if (inputString == null) {
    return ""
  }
}


// Text that comes from the API or from other cells must never be read by Sheets as a formula:
// "=IMPORTXML(...)" in a name would send data of the spreadsheet to someone else. Sheets may read
// text that starts with "=", "+" or "-" as a formula, so that text gets an apostrophe prefix, which
// forces plain text and is not shown. The exception is text that starts with "+" or "-" and has
// only digits, spaces and number punctuation (phones, amounts): it has no letters, so no function
// or cell reference can be in it. Anything else is left as it is.
function safeText(value) {
  if (typeof value !== "string") {
    return value;
  }
  let startsAFormula = value.startsWith("=") || (/^[+-]/.test(value) && !/^[+-][\d\s().,%$+-]*$/.test(value));

  return startsAFormula ? "'" + value : value;
}

// Rows 11 to the last one, `width` columns from A, in a single call.
function readRows_(sheet, width) {
  let lastRow = sheet.getLastRow();
  if (lastRow < 11) {
    return [];
  }
  return sheet.getRange(11, 1, lastRow - 10, width).getValues();
}

// The value of a column (its letter, A to Z) in a row read by readRows_.
function cellOf_(row, letter) {
  return row[letter.charCodeAt(0) - 65];
}

// For the parts of a formula built by the SDK that are written inside quotes.
function formulaText(value) {
  return String(value).replace(/"/g, '""');
}

// A link formula built by the SDK with every received part escaped by formulaText(): the only value
// writeRows_ writes as a formula.
function LinkFormula(text) {
  this.text = text;
}

// Writes rows of values from (firstRow, firstColumn) in a single call: each call to a range is a round
// trip, and a page has up to 100 rows. Short rows are padded with empty cells.
function writeRows_(sheet, firstRow, firstColumn, rows) {
  let width = Math.max(0, ...rows.map(row => row.length));
  if (width == 0) {
    return;
  }
  let values = rows.map(row => Array.from({length: width}, (_, column) => cellValue_(row[column])));
  sheet.getRange(firstRow, firstColumn, values.length, width).setValues(values);
}

// Text goes through safeText, so nothing that came from the API or from other cells is read as a
// formula. Lists and objects are refused: Sheets would write them as text that safeText never saw.
function cellValue_(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof LinkFormula) {
    return value.text;
  }
  let isDate = Object.prototype.toString.call(value) === "[object Date]";
  if (!isDate && !["string", "number", "boolean"].includes(typeof value)) {
    throw new Error("A list or an object cannot be written to a cell");
  }
  return safeText(value);
}


function stringToCurrency(string) {
  return parseInt(string, 10)/100;
}


function formatToLocalDatetime(string){
  return Utilities.formatDate(new Date(string), "GMT-3", "yyyy-MM-dd");
}

function getHeaderColumns(sheet){
  return {
    'Extrato': ["Data", "Tipo de transação", "Valor", "Saldo Final", "Descrição", "Id Transação", "Tarifa", "Tags"],
    'Transferência com Aprovação': ["Nome", "CPF/CNPJ", "Valor", "Código do Banco / ISPB", "Agência", "Conta", "Data de Agendamento", "Tipo de conta (opcional)", "Tags", "Descrição", "Mensagem para o recebedor"],
    'Consulta de Boleto': ["Data de Emissão", "Nome", "CPF/CNPJ", "Status", "Valor", "Vencimento", "Linha digitável", "Id Boleto", "Tarifa", "Tags", "Link PDF"],
    'Consulta de Pagamento Boleto': ["Data de Criação", "Id Pagamento", "Valor", "Status", "Data de Agendamento", "Linha Digitável", "Descrição", "Tags"],
    'Consulta de Transferência': ["Data de Criação", "Id Transferência", "Valor", "Status", "Nome", "CPF/CNPJ", "Código do Banco", "Agência", "Número da Conta", "Ids de Transação (Saída, Estorno)"],
    'Pagamento de Boletos': ["Linha Digitável ou Código de Barras", "CPF/CPNJ do Beneficiário", "Data de Agendamento", "Descrição", "Tags"],
    'Consulta de Clientes': ["Id do Cliente", "Nome", "CPF/CNPJ", "E-Mail", "Telefone", "Logradouro", "Complemento", "Bairro", "Cidade", "Estado", "CEP", "Tags"],

    'Emissão de Boletos': ["Nome", "CPF/CNPJ", "Logradouro", "Complemento", "Bairro", "Cidade", "Código do Estado", "CEP", "Valor", "Data de Vencimento", "Multa", "Juros as Mês", "Dias para Baixa Automatica", "Desconto", "Data Desconto", "Descrição 1", "Valor 1", "Descrição 2", "Valor 2", "Descrição 3", "Valor 3", "Tags"],
  
    'Transferência Interna': ["Id do Recebedor", "Valor", "Descrição", "Identificador externo único", "Tags"],
    'Histórico de Boletos Emitidos': ["Data do Evento", "Evento", "Nome", "CPF/CPNJ", "Valor", "Valor de Emissão", "Desconto", "Multa", "Juros", "Data de Emissão", "Vencimento", "Linha Digitável", "Id do Boleto", "Tarifa", "Tags", "Link PDF",
  "Logradouro", "Complemento", "Bairro", "Cidade", "Estado", "CEP"],
    'Cadastro de Clientes': ["Nome", "CPF/CNPJ", "E-Mail", "Telefone", "Logradouro", "Complemento", "Bairro", "Cidade", "Estado", "CEP", "Tags"],
    'Consulta de Aprovações': ["Data da Solicitação", "Tipo de Pagamento", "Descrição", "Valor", "Solicitado por", "Status", "ID do pagamento", "Tags", "Nome", "CPF/CNPJ", "Codigo do Banco/ISPB", "Agencia", "Conta"],
    'Consulta de Invoices Emitidas': ["Data de Emissão", "Nome", "CPF/CNPJ", "Status", "Valor", "Valor de Emissão", "Desconto", "Multa", "Juros", "Vencimento", "Pagavel até", "Copia e Cola (BR Code)", "id da Invoice", "Tarifa", "Tags", "Link PDF"]
  }[sheet.getName()];
}


function formatHeader(sheet) {
  let headers = getHeaderColumns(sheet);
  sheet.setFrozenRows(10);
  writeRows_(sheet, 10, 1, [headers]);
  sheet.getRange(10, 1, 1, headers.length).setBackground("#0070e0").setFontColor("#ffffff");
}


function SetAllGreetings(){
  user = new getDefaultUser();
  for (sheet of SpreadsheetApp.getActiveSpreadsheet().getSheets()) {
    if (sheet.getSheetName().toLowerCase() != "credentials") {
      DisplayGreeting(user, sheet);
    }
  }
  getBalance();
}


// A2:A7, the balance line (A7) left empty until getBalance writes it.
function DisplayGreeting(user, sheet) {
  writeRows_(sheet, 2, 1, [
    ["Olá, " + user.name + "!"],
    ["Workspace: " + user.workspace],
    ["ID do Workspace: " + user.workspaceId],
    ["E-mail: " + user.email],
    ["Ambiente: " + user.environment],
    [""],
  ]);
}

function clearGreeting(sheet) {
  if (sheet.getSheetName().toLowerCase() != "credentials") {
    sheet.getRange("A2:A7").clearContent();
  }
}

function getDriveFolderOrCreate(folderName, rootFolder = null){
  if (!rootFolder){
    rootFolder = DriveApp.getRootFolder();
  }
  try {
    return rootFolder.getFoldersByName(folderName).next();
  }
  catch(e) {
    return rootFolder.createFolder(folderName);
  }
}

// Downloads the PDFs parallelRequestCount at a time and saves each one as <id>.pdf, in the order of the ids.
function savePdfsToDrive_(folder, ids, pathOf) {
  for (let start = 0; start < ids.length; start += parallelRequestCount) {
    let chunk = ids.slice(start, start + parallelRequestCount);
    let paths = chunk.map(pathOf);
    let responses = fetchAllWithSession_(paths, 'application/pdf');
    chunk.forEach((id, index) => folder.createFile(pdfFromResponse_(responses[index])[0]).setName(id + ".pdf"));
  }
}

function clearAll(){
  for (sheet of SpreadsheetApp.getActiveSpreadsheet().getSheets()) {
    clearGreeting(sheet);
    clearSheet(sheet);
  }
}

function clearSheet(sheet){
  try {
    sheet.getRange(11, 1, sheet.getLastRow()-10, 20).clearContent();
  } catch (e) {
    
  }
}

function checkPrivateKey(key)
{
  PrivateKey.fromPem(key);
}

function formatDateToISO(stringDate)
{
  return stringDate.replace(/(\d{2})\/(\d{2})\/(\d{4})*/, '$3-$2-$1');
}

function calculateExternalId(amount, name, taxId, bankCode, branchCode, accountNumber, tags, description){
  return bankCode + branchCode + accountNumber + name + taxId + amount.toString() + tags + description 
}

function clearCollumns(sheet, initialCollumn, endCollumn){
  sheet.getRange(11, initialCollumn, sheet.getLastRow()-10, endCollumn).clearContent();
}

// Content of an html file of the project, for the dialogs that share a piece of page (<?!= includeHtml_('name') ?>).
function includeHtml_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
