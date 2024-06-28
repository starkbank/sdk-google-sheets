
function CredentialsHeader(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  sheet.getRange(1, 2, 9, 1).clearContent();
  sheet.setFrozenRows(10);
  
  sheet.getRange('A1').setValue("Workspace");
  sheet.getRange('A2').setValue("E-mail");
  sheet.getRange('A3').setValue("Environment");
  sheet.getRange('A4').setValue("Access-Token");
  sheet.getRange('A5').setValue("Member name");
  sheet.getRange('A6').setValue("Workspace ID");
  sheet.getRange('A7').setValue("Private Key");
  sheet.getRange('A8').setValue("Public Key");
  sheet.getRange('A9').setValue("Access Id");
}

function getUserInputCredential(email, workspace, password, environment) {
  workspace = workspace.toLowerCase().trim() 

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  sheet.setFrozenRows(10);

  let workspaceInfos = parseResponse(UrlFetchApp.fetch(getHostname(environment, "v2") + "/workspace?username=" + workspace, null));

  if (workspaceInfos[0].workspaces.length == 0){
    Browser.msgBox("O workspace "+workspace+" não existe no StarkBank.");
  }
  let workspaceId = workspaceInfos[0]["workspaces"][0]["id"]
  let memberName = workspaceInfos[0]["workspaces"][0]["username"]

  SaveCredentials(workspace, email, environment, password, memberName, workspaceId);
  
  var key = KeyGen.generateKeyFromPassword(password, email);

  var keys = easyMake();

  let privateKeyPem = keys[0]
  let publicKeyPem = keys[1]
  
  requestBody = {
    expiration: 604800,
    publicKey: publicKeyPem,
    platform: "spreadsheet"
  }

  var jsonString = JSON.stringify(requestBody)

  sheet.getRange('B13').setValue(jsonString);
  sheet.getRange('B14').setValue(key.toPem());

  sheet.getRange('B16').setValue(privateKeyPem);
  sheet.getRange('B17').setValue(publicKeyPem);

  var challenge = {
    requestBody: jsonString,
    requestMethod: "POST",
    requestPath: "/session",
    type: "authenticator"
  }

  var payload = {
    "challenges": [challenge]
    }
  
  SaveSession(privateKeyPem, publicKeyPem, null);

  content = parseResponse(fetch("/challenge?expand=qrcode", method = 'POST', payload, null, 'v2', environment, key.toPem()));
  console.log(content)
  if (content[1] != 200) 
  {
    Browser.msgBox(content[0]["errors"][0]["message"] + "\\n Efetue o login novamente");
    throw new Error(JSON.stringify(content[0]))
  } else 
  {
    challengeCreated = content[0];

    sheet.getRange('B15').setValue(challengeCreated["challenges"][0]["id"]);

    return challengeCreated["challenges"][0]["qrcode"]
  }
}

function getChallengeApprove() {

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');

  var key = sheet.getRange('B14').getValue()
  var challengeId = sheet.getRange('B15').getValue()
  var environment = sheet.getRange('B3').getValue()

  var path = "/challenge/" + challengeId

  content = parseResponse(fetch(path, method = 'GET', null, null, 'v2', environment, key));
  console.log(content)

  if (content[1] != 200) 
  {
    throw new Error(JSON.stringify(content[0]))
  } else 
  {
    json = content[0];

    return json["challenge"]["status"]
  }
}

function postSessionChallenge() {

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');

  var jsonStringBody = sheet.getRange('B13').getValue()
  var keyPem = sheet.getRange('B14').getValue()
  var environment = sheet.getRange('B3').getValue()
  var challengeId = sheet.getRange('B15').getValue()

  content = parseResponse(maskFetch("/session", method = 'POST', jsonStringBody, null, 'v2', environment, keyPem, challengeId));

  if (content[1] != 200) 
  {
    throw new Error(JSON.stringify(content[0]))
  } else 
  {
    json = content[0];

    SaveSession(sheet.getRange('B16').getValue(), sheet.getRange('B17').getValue(), json["session"]["id"])
  }

}

function showQrcode() {
  var html = HtmlService.createHtmlOutputFromFile('qrcode').setHeight(400);
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Dados de Acesso');
}

function postPublicKey(privateKey, password, publicKey, environment) {
  var payload = {
  publicKeyPem: publicKey,
  password: password
  }

  return fetch("/public-key/migrate", method = 'POST', payload, null, 'v2', environment, privateKey)
}

function SaveCredentials(workspace, email, environment, accessToken, memberName, workspaceId) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  sheet.getRange(1,2,8,1).clearContent();
  sheet.setFrozenRows(10);
  
  sheet.getRange('B1').setValue(workspace);
  sheet.getRange('B2').setValue(email);
  sheet.getRange('B3').setValue(environment);
  sheet.getRange('B4').setValue(accessToken);
  sheet.getRange('B5').setValue(memberName);
  sheet.getRange('B6').setValue(workspaceId);
}

function SaveSession(privateKey, publicKey, accessId) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  sheet.getRange('B7').setValue(privateKey);
  sheet.getRange('B8').setValue(publicKey);
  sheet.getRange('B9').setValue("session/" + accessId);
}

function signInDialog() {
  var html = HtmlService.createHtmlOutputFromFile('FormCredentials').setHeight(600).setWidth(1100);
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Dados de Acesso');
}

function teste() {
  var html = HtmlService.createHtmlOutputFromFile('teste').setHeight(600).setWidth(1100);
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
      sessionId = accessId.split("/")[1];
      jsonSession = JSON.parse(fetch("/auth/session/" + sessionId, method = 'DELETE', null, null).content);
    } catch (e) {}
    clearAll();
    CredentialsHeader();
    if (displayMessage) {
      Browser.msgBox("Sessão encerrada com sucesso");
    }
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Solicitação de Cartões');
    sheet.getRange("B11").setFontColor("grey")
    sheet.getRange("D11").setFontColor("grey")
    sheet.getRange("J11").setFontColor("grey")

    sheet.getRange("B11").setValue("Ex: StarkBank")
    sheet.getRange("D11").setValue("Ex: (11) 99999-9999")
    sheet.getRange("J11").setValue("Ex: 20018-183")
  }
}
