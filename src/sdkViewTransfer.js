function ViewTransfer(after, before, status = null) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Transferência');
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
  formatHeader(sheet);
  
  let zeroTransfers = true;
  do {
    query["cursor"] = cursor;
    json = parseResponse(fetch("/transfer", method = 'GET', null, query));

    if (json[1] != 200) {
      Browser.msgBox(json[0]["errors"][0]["message"])
    }

    json = json[0]

    elementList = json["transfers"];
    cursor = json["cursor"];
    
    let rows = [];
    for (let transfer of elementList){
      zeroTransfers = false;
      rows.push([
        formatToLocalDatetime(transfer["created"]),
        transfer["id"],
        stringToCurrency(transfer["amount"]),
        transferStatusEnToPt(transfer["status"]),
        transfer["name"],
        transfer["taxId"],
        transfer["bankCode"],
        transfer["branchCode"],
        transfer["accountNumber"],
        transfer["transactionIds"].join(","),
      ]);
    }
    writeRows_(sheet, i + 1, 1, rows);
    i += rows.length;
  } while (cursor);
  if (zeroTransfers) {
    Browser.msgBox("Nenhuma transferência encontrada para o período selecionado!");
  }
}

function getTransferDownloadList(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Transferência');
  let idList = [];
  for (let row of readRows_(sheet, 4)){
    let transferId = cellOf_(row, 'B');
    let transferStatus = cellOf_(row, 'D');
    if (transferStatus === "sucesso") {
      idList.push(transferId);
    }
    if (idList.length >= 30) {
      break;
    }
  }
  return idList;
}


function TransferDownload(id) {
  let path = "/transfer/" + pathSegment(id) + "/pdf";
  let pdfContent = fetchBuffer(path);
  return pdfContent;
}


function TransferDownloadAllDrive(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Transferência');
  let transferDriveFolder = getDriveFolderOrCreate("transfer", getDriveFolderOrCreate("starkbank"));
  for (let i = 11; i <= sheet.getLastRow(); i++){
    let transferId = sheet.getRange('B' + i.toString()).getValue();
    let transferStatus = sheet.getRange('D' + i.toString()).getValue();
    if (transferStatus === "sucesso") {
      let fileName = transferId + ".pdf";
      let pdfContent = TransferDownload(transferId);
      let blob = pdfContent[0];
      let pdfFile = transferDriveFolder.createFile(blob);
      pdfFile.setName(fileName);
    }
  }
  Browser.msgBox("Arquivos baixados para Google Drive na pasta starkbank/transfer");
}


function TransferDownloadAllLocal(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Transferência');
  let idList = getTransferDownloadList();
  
  if (idList.length == 0) {
    Browser.msgBox("Nenhuma transferência válida (sucesso) listada para download.");
    return;
  }
  if (idList.length >= 30) {
    let ui = SpreadsheetApp.getUi();
    let response = ui.alert(
      "Há mais de 30 arquivos listados. Por restrições do navegador, " + 
      "serão baixados apenas os 30 primeiros itens. " + 
      "Para realizar o download da lista completa, baixe os arquivos para o Google Drive. Continuar?", ui.ButtonSet.YES_NO
    );
    if (response != ui.Button.YES) { 
      return
    }
  }
  localTransferDownloadDialog();
}


function TransferDownloadBase64Encoded(id){
  let blob = TransferDownload(id);
  let status = blob[1]
  blob = blob[0]
  if (status != 200) {
    throw new Error(blob[0])
  }
  return {
    id: id,
    content: Utilities.base64Encode(blob.getBytes())
  };
}


function localTransferDownloadDialog() {
  let html = HtmlService.createHtmlOutputFromFile('FormDownloadTransfers');
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Baixando comprovantes de transferência');
}


function selectTransferDialog() {
  var html = HtmlService.createTemplateFromFile('FormViewTransfer').evaluate();
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Transferências');
}


function transferStatusEnToPt(status){
  switch (status){
    case "success":
      return "sucesso";
    case "processing":
      return "processando";
    case "failed":
      return "falha";
    case "unknown":
      return "desconhecido";
    default:
      return "outro";
  }
}