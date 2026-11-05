
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
      throw JSON.stringify({"message": json[0]["errors"][0]["message"]})
    }

    json = json[0]

    elementList = json["boletos"];
    cursor = json["cursor"];

    let rows = [];
    for (let charge of elementList){
      zeroCharges = false;
      let pdfLink = '=HYPERLINK("' + hostname + "/boleto/" + formulaText(charge["id"]) + '/pdf", "PDF")';
      rows.push([
        formatToLocalDatetime(charge["created"]),
        charge["name"],
        charge["taxId"],
        ChargeStatusEnToPt(charge["status"]),
        stringToCurrency(charge["amount"]),
        formatToLocalDatetime(charge["due"]),
        charge["line"],
        charge["id"],
        stringToCurrency(charge["fee"]),
        charge["tags"].join(","),
        new LinkFormula(pdfLink),
      ]);
    }
    writeRows_(sheet, i + 1, 1, rows);
    i += rows.length;
  } while (cursor);
  if (zeroCharges) {
    Browser.msgBox("Nenhum boleto encontrado para o período selecionado!");
  }
}


function ChargeDownloadAllDrive(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Boleto');
  let chargeDriveFolder = getDriveFolderOrCreate("boleto", getDriveFolderOrCreate("starkbank"));
  let ids = readRows_(sheet, 8).map(row => cellOf_(row, 'H'));
  savePdfsToDrive_(chargeDriveFolder, ids, id => "/boleto/" + pathSegment(id) + "/pdf");
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
  return readRows_(sheet, 8).map(row => cellOf_(row, 'H'));
}


function ChargeDownload(id) {
  let path = "/boleto/" + pathSegment(id) + "/pdf";
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
  let html = HtmlService.createTemplateFromFile('FormViewCharge').evaluate();
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
