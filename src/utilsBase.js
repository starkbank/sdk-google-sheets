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


function stringToCurrency(string) {
  return parseInt(string, 10)/100;
}


function formatToLocalDatetime(string){
  return Utilities.formatDate(new Date(string), "GMT-3", "yyyy-MM-dd");
}

function getHeaderColumns(sheet){
  return {
    'Extrato': ["Data", "Tipo de transação", "Valor", "Saldo Final", "Descrição", "Id Transação", "Tarifa", "Tags"],
    'Transferência com Aprovação': ["Nome", "CPF/CNPJ", "Valor", "Código do Banco / ISPB", "Agência", "Conta", "Data de Agendamento", "Tipo de conta (opcional)", "Tags", "Descrição"],
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
  for (let i = 0; i < headers.length; i++) {
    sheet.getRange(10, i+1).setValue(headers[i]).setBackground("#0070e0").setFontColor("#ffffff");
  }
}


function SetAllGreetings(){
  user = new getDefaultUser();
  for (sheet of SpreadsheetApp.getActiveSpreadsheet().getSheets()) {
    if (sheet.getSheetName().toLowerCase() != "credentials") {
      clearGreeting(sheet)
      DisplayGreeting(user, sheet);
    }
  }
  getBalance();
}


function DisplayGreeting(user, sheet) {
  sheet.getRange("A2").setValue("Olá, " + user.name + "!");
  sheet.getRange("A3").setValue("Workspace: " + user.workspace);
  sheet.getRange("A4").setValue("ID do Workspace: " + user.workspaceId);
  sheet.getRange("A5").setValue("E-mail: " + user.email);
  sheet.getRange("A6").setValue("Ambiente: " + user.environment);
}

function clearGreeting(sheet) {
  if (sheet.getSheetName().toLowerCase() != "credentials") {
    sheet.getRange("A2").setValue(null);
    sheet.getRange("A3").setValue(null);
    sheet.getRange("A4").setValue(null);
    sheet.getRange("A5").setValue(null);
    sheet.getRange("A6").setValue(null);
    sheet.getRange("A7").setValue(null);
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

function calculateExternalId(amount, name, taxId, bankCode, branchCode, accountNumber){
  return bankCode + branchCode + accountNumber + name + taxId + amount.toString() 
}

function clearCollumns(sheet, initialCollumn, endCollumn){
  sheet.getRange(11, initialCollumn, sheet.getLastRow()-10, endCollumn).clearContent();
}
