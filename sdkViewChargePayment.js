
function ViewChargePayment(after, before, status = null) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Pagamento Boleto');
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
  let zeroPayments = true;
  do {
    query["cursor"] = cursor;
    json = JSON.parse(fetch("/charge-payment", method = 'GET', null, query).content);
    elementList = json["payments"];
    cursor = json["cursor"];
    
    for (let payment of elementList){
      zeroPayments = false;
      i += 1;
      
      let tags = payment["tags"];
      sheet.getRange('A' + i.toString()).setValue(formatToLocalDatetime(payment["created"]));
      sheet.getRange('B' + i.toString()).setValue(payment["id"]);
      sheet.getRange('C' + i.toString()).setValue(stringToCurrency(payment["amount"]));
      sheet.getRange('D' + i.toString()).setValue(ChargePaymentStatusEnToPt(payment["status"]));
      sheet.getRange('E' + i.toString()).setValue(formatToLocalDatetime(payment["scheduled"]));
      sheet.getRange('F' + i.toString()).setValue(payment["line"]);
      sheet.getRange('G' + i.toString()).setValue(payment["description"]);
      sheet.getRange('H' + i.toString()).setValue(tags.join(","));
    }
  } while (cursor);
  if (zeroPayments) {
    Browser.msgBox("Nenhum pagamento encontrado para o período selecionado!");
  }
}


function ChargePaymentDownloadAllDrive(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Pagamento Boleto');
  let paymentDriveFolder = getDriveFolderOrCreate("boleto-payment", getDriveFolderOrCreate("starkbank"));
  for (let i = 11; i <= sheet.getLastRow(); i++){
    let paymentId = sheet.getRange('B' + i.toString()).getValue();
    let paymentStatus = sheet.getRange('D' + i.toString()).getValue();
    if (paymentStatus === "sucesso") {
      let fileName = paymentId + ".pdf";
      let pdfContent = ChargePaymentDownload(paymentId);
      let pdfFile = paymentDriveFolder.createFile(pdfContent);
      pdfFile.setName(fileName);
    }
  }
  Browser.msgBox("Arquivos baixados para Google Drive na pasta starkbank/boleto-payment");
}


function ChargePaymentDownloadAllLocal(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Pagamento Boleto');
  let idList = getChargePaymentDownloadList();
  
    if (idList.length == 0) {
      Browser.msgBox("Nenhum pagamento válido (sucesso) listado para download.");
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
  localChargePaymentDownloadDialog();
}

function getChargePaymentDownloadList(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Pagamento Boleto');
  let idList = [];
  for (let i = 11; i <= sheet.getLastRow(); i++){
    let paymentId = sheet.getRange('B' + i.toString()).getValue();
    let paymentStatus = sheet.getRange('D' + i.toString()).getValue();
    if (paymentStatus === "sucesso") {
      idList.push(paymentId);
    }
    if (idList.length >= 30) {
      break;
    }
  }
  return idList;
}


function ChargePaymentDownload(id) {
  let path = "/charge-payment/" + id + "/pdf";
  let pdfContent = fetchBuffer(path).content;
  return pdfContent;
}

function ChargePaymentDownloadBase64Encoded(id){
  let blob = ChargePaymentDownload(id);
  return {
    id: id,
    content: Utilities.base64Encode(blob.getBytes())
  };
}


function localChargePaymentDownloadDialog() {
  let html = HtmlService.createHtmlOutputFromFile('FormDownloadChargePayments');
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Baixando comprovantes de pagamento');
}


function selectChargePaymentDialog() {
  var html = HtmlService.createHtmlOutputFromFile('FormViewChargePayment');
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Pagamento de Boletos');
}


function ChargePaymentStatusEnToPt(status){
  switch (status){
    case "created":
      return "criado";
    case "canceled":
      return "cancelado";
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
