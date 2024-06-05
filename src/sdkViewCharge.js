
function ViewCharge(after, before, status) {

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Boleto');
  let i = 10;
  let cursor = "";
  let query = {};
  if (after){
    query["after"] = after;
  }
  if (before){
    query["before"] = before;
  }
  if (status){
    query["status"] = status;
  }
  
  clearSheet(sheet);
  formatHeader(sheet);
  
  let user = new getDefaultUser();
  let hostname = getHostname(user.environment.toLowerCase(), "v2");
  let zeroCharges = true;
  do {
    query["cursor"] = cursor;
    json = parseResponse(fetch("/boleto", method = 'GET', null, query));

    if (json[1] != 200) {
      Browser.msgBox(json[0]["errors"][0]["message"])
      throw new Error()
    }

    json = json[0]

    elementList = json["boletos"];
    cursor = json["cursor"];

    for (let charge of elementList){
      zeroCharges = false;
      i += 1;
      let pdfLink = '=HYPERLINK("' + hostname + "/boleto/" + charge["id"] + '/pdf", "PDF")';
      let tags = charge["tags"];
      sheet.getRange('A' + i.toString()).setValue(formatToLocalDatetime(charge["created"]));
      sheet.getRange('B' + i.toString()).setValue(charge["name"]);
      sheet.getRange('C' + i.toString()).setValue(charge["taxId"]);
      sheet.getRange('D' + i.toString()).setValue(ChargeStatusEnToPt(charge["status"]));
      sheet.getRange('E' + i.toString()).setValue(stringToCurrency(charge["amount"]));
      sheet.getRange('F' + i.toString()).setValue(formatToLocalDatetime(charge["due"]));
      sheet.getRange('G' + i.toString()).setValue(charge["line"]);
      sheet.getRange('H' + i.toString()).setValue(charge["id"]);
      sheet.getRange('I' + i.toString()).setValue(stringToCurrency(charge["fee"]));
      sheet.getRange('J' + i.toString()).setValue(tags.join(","));
      sheet.getRange('K' + i.toString()).setValue(pdfLink);
    }
  } while (cursor);
  if (zeroCharges) {
    Browser.msgBox("Nenhum boleto encontrado para o período selecionado!");
  }
}


function ChargeDownloadAllDrive(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Boleto');
  let chargeDriveFolder = getDriveFolderOrCreate("boleto", getDriveFolderOrCreate("starkbank"));
  for (let i = 11; i <= sheet.getLastRow(); i++){
    let chargeId = sheet.getRange('H' + i.toString()).getValue();
    let fileName = chargeId + ".pdf";
    let pdfContent = ChargeDownload(chargeId);
    let pdfFile = chargeDriveFolder.createFile(pdfContent);
    pdfFile.setName(fileName);
  }
  Browser.msgBox("Arquivos baixados para Google Drive na pasta starkbank/boleto");
}


function ChargeDownloadAllLocal(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Boleto');
  let idList = getChargeDownloadList();
  
  if (idList.length == 0) {
    Browser.msgBox("Nenhum boleto listado para download.");
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
  localChargeDownloadDialog();
}

function getChargeDownloadList(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Boleto');
  let idList = [];
  for (let i = 11; i <= sheet.getLastRow(); i++){
    let chargeId = sheet.getRange('H' + i.toString()).getValue();
    idList.push(chargeId);
  }
  return idList;
}


function ChargeDownload(id) {
  let path = "/boleto/" + id + "/pdf";
  let pdfContent = fetchBuffer(path)[0];
  return pdfContent;
}

function ChargeDownloadBase64Encoded(id){
  let blob = ChargeDownload(id);
  return {
    id: id,
    content: Utilities.base64Encode(blob.getBytes())}
  ;
}


function localChargeDownloadDialog() {
  let html = HtmlService.createHtmlOutputFromFile('FormDownloadCharges');
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Baixando boletos');
}

function selectChargeDialog() {
  let html = HtmlService.createHtmlOutputFromFile('FormViewCharge');
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Boletos Emitidos');
}


function ChargeStatusEnToPt(status){
  switch (status){
    case "paid":
      return "pago";
    case "created":
      return "pendente de registro";
    case "registered":
      return "registrado";
    case "overdue":
      return "vencido";
    case "canceled":
      return "cancelado";
    case "failed":
      return "falha";
    case "unknown":
      return "desconhecido";
    default:
      return "outro";
  }
}
