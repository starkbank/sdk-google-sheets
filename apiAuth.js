
function CredentialsHeader(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  sheet.getRange(1, 2, 8, 1).clearContent();
  sheet.setFrozenRows(10);
  
  sheet.getRange('A1').setValue("Workspace");
  sheet.getRange('A2').setValue("E-mail");
  sheet.getRange('A3').setValue("Environment");
  sheet.getRange('A4').setValue("Access-Token");
  sheet.getRange('A5').setValue("Member name");
  sheet.getRange('A6').setValue("Workspace ID");
}

function getUserInputCredential(email, workspace, password, environment) {
  
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  sheet.setFrozenRows(10);
  
  payload = {
    workspace: workspace,
    email: email,
    password: password,
    platform: "api"
  }
  
  json = JSON.parse(fetch("/auth/access-token", method = 'POST', payload, null, "v1", environment).content);
  clearAll();
  let accessToken = json["accessToken"];
  let memberName = json["member"]["name"];
  let workspaceId = json["member"]["workspaceId"];
  
  SaveCredentials(workspace, email, environment, accessToken, memberName, workspaceId);
}

function verifyPassword(password) {
  let user = new getDefaultUser();

  payload = {
    workspace: user.workspace,
    email: user.email,
    password: password,
    platform: "api"
  }
  fetch("/auth/access-token", method = 'POST', payload, null, "v1", user.environment);
}

function SaveCredentials(workspace, email, environment, accessToken, membername, workspaceId) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  sheet.getRange(1,2,8,1).clearContent();
  sheet.setFrozenRows(10);
  
  sheet.getRange('B1').setValue(workspace);
  sheet.getRange('B2').setValue(email);
  sheet.getRange('B3').setValue(environment);
  sheet.getRange('B4').setValue(accessToken);
  sheet.getRange('B5').setValue(membername);
  sheet.getRange('B6').setValue(workspaceId);
}

function signInDialog() {
  var html = HtmlService.createHtmlOutputFromFile('FormCredentials');
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Dados de Acesso');
}

function signOut(displayMessage = true) {
  let ui = SpreadsheetApp.getUi();
  let response = ui.alert('Encerrar sessão? Dados nas planilhas serão deletados!', ui.ButtonSet.YES_NO);
  if (response == ui.Button.YES) { 
    let user = new getDefaultUser();
    try {
      json = JSON.parse(fetch("/auth/access-token/" + user.accessToken, method = 'DELETE', null, null).content);
    } catch (e) {}
    clearAll();
    CredentialsHeader();
    if (displayMessage) {
      Browser.msgBox("Sessão encerrada com sucesso");
    }
  }
}

