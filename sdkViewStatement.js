
function ViewStatement(after, before) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Extrato');
  let i = 10;
  let cursor = "";
  let query = {};
  if (after){
    query["after"] = after
  }
  if (before){
    query["before"] = before;
  }
  
  clearSheet(sheet);
  formatHeader(sheet);
  
  let zeroTransactions = true;
  do {
    query["cursor"] = cursor;
    json = JSON.parse(fetch("/bank/transaction", method = 'GET', null, query).content);
    elementList = json["transactions"];
    cursor = json["cursor"];
    
    for (let transact of elementList){
      zeroTransactions = false;
      i += 1;
      
      let sign = transact["flow"] === "in" ? 1 : -1;
      let tags = transact["tags"];
      sheet.getRange(i, 1).setValue(formatToLocalDatetime(transact["created"]));
      sheet.getRange(i, 2).setValue(getTransactionType(transact["path"]));
      sheet.getRange(i, 3).setValue(sign*stringToCurrency(transact["amount"]));
      sheet.getRange(i, 4).setValue(stringToCurrency(transact["balance"]));
      sheet.getRange(i, 5).setValue(transact["description"]);
      sheet.getRange(i, 6).setValue(transact["id"]);
      sheet.getRange(i, 7).setValue(stringToCurrency(transact["fee"]));
      sheet.getRange(i, 8).setValue(tags.join(","));
    }
  } while (cursor);
  if (zeroTransactions) {
    Browser.msgBox("Nenhuma transação encontrada para o período selecionado!");
  }
}


function getTransactionType(path){
  let splitPath = path.split("/");
  let type = "";
  if (path.includes("chargeback")){
    type += "Estorno: "
  }
  switch (splitPath[0]){
    case "self":
      return type + "Transferência interna";
    case "charge":
    case "boleto":
      return type + "Recebimento de boleto pago";
    case "charge-payment":
    case "boleto-payment":
      return type + "Pagamento de boleto";
    case "bar-code-payment":
      return type + "Pagamento de concessionária";
    case "team":
      return type + "Transf. com aprovação";
    case "transfer":
    case "transfer-request":
      return type + "Transf. sem aprovação";
    default:
      return type + "Outros";
  }
}

function selectStatementDialog() {
  var html = HtmlService.createHtmlOutputFromFile('FormViewStatement');
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Extrato');
}