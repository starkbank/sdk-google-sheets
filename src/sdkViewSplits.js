function viewSplits(after, before, status = null) {

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Split Consultas');
  let i = 10;
  let cursor = "";
  let query = {};
  if (after){
    query["after"] = after
  }
  if (before){
    query["before"] = before;
  }
  if (status){
    query["status"] = status;
  }

  clearSheet(sheet);

  do {
    query["cursor"] = cursor;
    let splits = parseResponse(fetch("/split", method = 'GET', null, query));

    if (splits[1] != 200) {
      throw JSON.stringify({"message": splits[0]["errors"][0]["message"]})
    }
    if (splits[0]["splits"].length<1) {
      Browser.msgBox("Nenhum Split foi encontrado!");
      return
    }

    splits = splits[0];
    cursor = splits["cursor"];
    splits = splits["splits"];

    let receiverIds = [];
    for (let split of splits) {
      receiverIds.push(split["receiverId"]);
    };
    
    let response = parseResponse(fetch("/split-receiver", method = 'GET', null ,{"ids": receiverIds}));
    let receivers = {}
    for (let obj of response[0]['receivers']) {
      receivers[obj.id] = obj.taxId;
    }
    
    let rows = splits.map(split => [
      split["created"],
      split["source"],
      split["receiverId"],
      receivers[split.receiverId],
      stringToCurrency(split["amount"]),
      split["status"],
    ]);
    writeRows_(sheet, i + 1, 1, rows);
    i += rows.length;
  } while (cursor);
}

function selectSplitsDialog() {
  var html = HtmlService.createTemplateFromFile('FormViewSplits').evaluate();
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Splits');
}
