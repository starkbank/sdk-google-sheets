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
      Browser.msgBox(splits[0]["errors"][0]["message"])
      throw new Error()
    }
    if (splits[0]["splits"].length<1) {
      Browser.msgBox("Nenhum Split foi encontrado!");
      throw new Error()
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
    console.log(receivers);
    
    for (let split of splits){
      zeroCharges = false;
      i += 1;
      sheet.getRange('A' + i.toString()).setValue(split["created"]);
      sheet.getRange('B' + i.toString()).setValue(split["source"]);
      sheet.getRange('C' + i.toString()).setValue(split["receiverId"]);
      sheet.getRange('D' + i.toString()).setValue(receivers[split.receiverId]);
      sheet.getRange('E' + i.toString()).setValue(stringToCurrency(split["amount"]));
      sheet.getRange('F' + i.toString()).setValue(split["status"]);
    };
  } while (cursor);
}

function selectSplitsDialog() {
  var html = HtmlService.createHtmlOutputFromFile('FormViewSplits');
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Splits');
}
