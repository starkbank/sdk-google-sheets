
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
    json = parseResponse(fetch("/transaction", method = 'GET', null, query));

    if (json[1] != 200) {
      throw JSON.stringify({"message": json[0]["errors"][0]["message"]})
    }

    json = json[0]

    elementList = json["transactions"];
    cursor = json["cursor"];
    
    let rows = [];
    for (let transact of elementList){
      zeroTransactions = false;
      let sign = transact["flow"] === "in" ? 1 : -1;
      rows.push([
        formatToLocalDatetime(transact["created"]),
        getTransactionType(transact["source"].split("/")[0]),
        sign*stringToCurrency(transact["amount"]),
        stringToCurrency(transact["balance"]),
        transact["description"],
        transact["id"],
        stringToCurrency(transact["fee"]),
        transact["tags"].join(","),
      ]);
    }
    writeRows_(sheet, i + 1, 1, rows);
    i += rows.length;
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
  var html = HtmlService.createTemplateFromFile('FormViewStatement').evaluate();
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Extrato');
}