
function SendOrder(teamId) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transferência com Aprovação');
  let i = 10;
  let cursor = "";
  let query = {};
  let orders = [];
  
  formatHeader(sheet);
  
  for (let i = 11; i <= sheet.getLastRow(); i++){
    orders.push({
      name: sheet.getRange('A' + i.toString()).getValue(),
      taxId: sheet.getRange('B' + i.toString()).getValue(),
      amount: parseInt(100*sheet.getRange('C' + i.toString()).getValue(), 10),
      bankCode: sheet.getRange('D' + i.toString()).getValue(),
      branchCode: sheet.getRange('E' + i.toString()).getValue(),
      accountNumber: sheet.getRange('F' + i.toString()).getValue(),
      tags: sheet.getRange('G' + i.toString()).getValue().split(","),
      description: sheet.getRange('H' + i.toString()).getValue()
    });
  }
  payload = {
    teamId: teamId,
    orders: orders
  }
  json = JSON.parse(fetch("/team/order", method = 'POST', payload, query).content);
}

function getUserTeamId(){
  teams = getTeams();
  return teams;
}

function getTeams(){
  teams = [];
  
  let query = {};
  let cursor = "";
  
  do {
    query["cursor"] = cursor;
    json = JSON.parse(fetch("/team", method = 'GET', null, query).content);
    elementList = json["teams"];
    cursor = json["cursor"];
    
    for (let team of elementList){
      teams.push(team);
    }
  } while (cursor);
  return teams;
}

function selectTeamDialog() {
  var html = HtmlService.createHtmlOutputFromFile('FormSelectTeam');
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Envio de Transferência para Aprovação');
}