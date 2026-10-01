function CredentialsHeader(){
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  sheet.getRange(1, 2, 9, 1).clearContent();
  sheet.setFrozenRows(10);
  
  // Labels of fields that earlier versions kept in the sheet.
  sheet.getRangeList(["A4", "A7:A9"]).clearContent();

  sheet.getRange('A1').setValue("Workspace");
  sheet.getRange('A2').setValue("E-mail");
  sheet.getRange('A3').setValue("Environment");
  sheet.getRange('A5').setValue("Member name");
  sheet.getRange('A6').setValue("Workspace ID");
}

function getUserInputCredential(email, workspace, password, environment) {
  workspace = workspace.toLowerCase().trim() 

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  sheet.setFrozenRows(10);

  let workspaceInfos = parseResponse(UrlFetchApp.fetch(getHostname(environment, "v2") + "/workspace?username=" + queryValue(workspace), null));

  if (workspaceInfos[0].workspaces.length == 0){
    Browser.msgBox("O workspace "+workspace+" não existe no StarkBank.");
  }
  let workspaceId = workspaceInfos[0]["workspaces"][0]["id"]
  let memberName = workspaceInfos[0]["workspaces"][0]["username"]

  purgeLegacyCredentials_();
  // The previous session ends here: it is revoked on the API too, so it does not stay valid without an owner.
  revokeCurrentSession_();
  SessionStore.clearSession();
  SaveCredentials(workspace, email, environment, memberName, workspaceId);
  
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

  SessionStore.startHandshake({
    requestBody: jsonString,
    memberKeyPem: key.toPem(),
    sessionPrivateKeyPem: privateKeyPem,
    sessionPublicKeyPem: publicKeyPem
  });

  var challenge = {
    requestBody: jsonString,
    requestMethod: "POST",
    requestPath: "/session",
    type: "authenticator"
  }

  var payload = {
    "challenges": [challenge]
    }
  
  content = parseResponse(fetch("/challenge?expand=qrcode", method = 'POST', payload, null, 'v2', environment, key.toPem()));

  if (content[1] != 200) 
  {
    SessionStore.clearHandshake();
    Browser.msgBox(content[0]["errors"][0]["message"] + "\\n Efetue o login novamente");
    throw new Error(JSON.stringify(content[0]))
  } else 
  {
    challengeCreated = content[0];

    SessionStore.saveHandshake({challengeId: challengeCreated["challenges"][0]["id"]});

    return challengeCreated["challenges"][0]["qrcode"]
  }
}

function getChallengeApprove() {

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');

  // The form polls every 500ms without waiting for the answer, so a poll may still be running
  // after the session was created (and the handshake discarded).
  if (isLoginCompleted_()) {
    return "approved"
  }

  let handshake = requireHandshake_("memberKeyPem", "challengeId")
  var environment = SessionStore.loadProfile().environment

  var path = "/challenge/" + pathSegment(handshake.challengeId)

  content = parseResponse(fetch(path, method = 'GET', null, null, 'v2', environment, handshake.memberKeyPem));

  if (content[1] != 200) 
  {
    throw new Error(JSON.stringify(content[0]))
  } else 
  {
    json = content[0];

    if (json["challenge"]["status"] == "expired" || json["challenge"]["status"] == "denied") {
      SessionStore.clearHandshake()
    }

    return json["challenge"]["status"]
  }
}

function postSessionChallenge() {

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');

  if (isLoginCompleted_()) {
    return
  }

  let handshake = requireHandshake_()
  var environment = SessionStore.loadProfile().environment

  content = parseResponse(maskFetch("/session", method = 'POST', handshake.requestBody, null, 'v2', environment, handshake.memberKeyPem, handshake.challengeId));

  if (content[1] != 200) 
  {
    SessionStore.clearHandshake()
    throw new Error(JSON.stringify(content[0]))
  } else 
  {
    json = content[0];

    SessionStore.saveSession({
      privateKey: handshake.sessionPrivateKeyPem,
      publicKey: handshake.sessionPublicKeyPem,
      accessId: KeyGen.generateSessionAccessId(json["session"]["id"])
    })
    SessionStore.clearHandshake()

    let paymentRequestExternalIdsheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('paymentRequestExternal');
    paymentRequestExternalIdsheet.getRange("C1").setValue("{\"transfer\": [], \"boleto\": []}")
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

// Only non secret data goes to the sheet, for display. Keys, the session and who the user is live in SessionStore.
function SaveCredentials(workspace, email, environment, memberName, workspaceId) {
  SessionStore.saveProfile({workspace: workspace, email: email, environment: environment, name: memberName, workspaceId: workspaceId});

  // The cells only show who logged in last.
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  sheet.getRange(1,2,8,1).clearContent();
  sheet.setFrozenRows(10);
  
  sheet.getRange('B1').setValue(safeText(workspace));
  sheet.getRange('B2').setValue(safeText(email));
  sheet.getRange('B3').setValue(safeText(environment));
  sheet.getRange('B5').setValue(safeText(memberName));
  sheet.getRange('B6').setValue(safeText(workspaceId));
}

// Removes the secrets an earlier version left in the sheet and, as best effort, revokes the
// session it stored there. The previous session is not reused: the user logs in again.
function purgeLegacyCredentials_() {
  // Rows where earlier versions kept secrets (password, session keys, access id and the pending
  // login data). They are never written anymore.
  const legacySecretRows = [4, 7, 8, 9, 13, 14, 15, 16, 17];

  // Set while the legacy session is being revoked, because the revocation request reads the user again.
  if (purgeLegacyCredentials_.running) {
    return;
  }
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  let rows = sheet.getRange(4, 2, 14, 1).getValues();
  let legacyValue = row => rows[row - 4][0];
  // Sheets returns typed values: a password such as "0" or "false" is not a string here.
  if (legacySecretRows.every(row => legacyValue(row) === "")) {
    return;
  }

  purgeLegacyCredentials_.running = true;
  try {
    let environment = sheet.getRange('B3').getValue();
    try {
      sheet.getRangeList(["B4", "B8", "B13:B17", "A4", "A7:A9"]).clearContent();
    } catch (error) {
      // Without edit access the secrets cannot be removed, and trying to revoke on every call would be wasteful.
      Logger.log("Could not remove the legacy credentials from the sheet: " + error.message);
      return;
    }

    // The session key and id stay until the revocation has used them.
    revokeLegacySession_(environment, legacyValue(9), legacyValue(7));
    for (let cell of ["B7", "B9"]) {
      try {
        sheet.getRange(cell).clearContent();
      } catch (error) {
        Logger.log("Could not remove the legacy session from the sheet: " + error.message);
      }
    }
  } finally {
    purgeLegacyCredentials_.running = false;
  }
}

// The access id comes from a cell anyone with edit access can change, so only the exact format
// of a session access id is used to build the request.
function revokeLegacySession_(environment, accessId, privateKeyPem) {
  let match = String(accessId).match(/^session\/([A-Za-z0-9_-]+)$/);
  if (!privateKeyPem || !match || match[1] == "null") {
    return;
  }

  try {
    let response = maskFetch("/auth/session/" + pathSegment(match[1]), 'DELETE', null, null, 'v2', environment, privateKeyPem, null, accessId);
    if (response.getResponseCode() != 200) {
      Logger.log("Could not revoke the legacy session: status " + response.getResponseCode());
    }
  } catch (error) {
    // No error details: parsing a corrupted key can put key material in the message.
    Logger.log("Could not revoke the legacy session");
  }
}

// Starting a login ends the previous session, so a stored session means the login is done.
function isLoginCompleted_() {
  return Boolean(SessionStore.loadSession().accessId);
}

// The handshake is gone when it expires (10 minutes) or when the cache evicts it.
function requireHandshake_(...fields) {
  let handshake = SessionStore.loadHandshake(...fields);
  if (!handshake) {
    throw JSON.stringify({"message": "O login expirou. Por favor, faça login novamente."});
  }

  return handshake;
}

function signInDialog() {
  var html = HtmlService.createTemplateFromFile('FormCredentials').evaluate().setHeight(600).setWidth(1100);
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Dados de Acesso');
}

// Ends the session on the API too, so that it stops working before its expiration. Without a
// session there is nothing to revoke. An error answer usually means the session is already gone
// (expired), so only a request that could not be made counts as a failure (returns true).
function revokeCurrentSession_() {
  try {
    let user = new getDefaultUser();
    let match = String(user.accessId).match(/^session\/([A-Za-z0-9_-]+)$/);
    if (!match) {
      return false;
    }

    let response = fetch("/auth/session/" + pathSegment(match[1]), 'DELETE', null, null);
    if (response.getResponseCode() != 200) {
      Logger.log("The session was not revoked on the API: status " + response.getResponseCode());
    }
    return false;
  } catch (error) {
    Logger.log("The session could not be revoked on the API");
    return true;
  }
}

function signOut(displayMessage = true) {
  let ui = SpreadsheetApp.getUi();
  let response = ui.alert('Encerrar sessão? Dados nas planilhas serão deletados!', ui.ButtonSet.YES_NO);
  if (response == ui.Button.YES) { 
    let couldNotRevoke = revokeCurrentSession_();
    SessionStore.clearAll();
    clearAll();
    CredentialsHeader();
    if (displayMessage) {
      Browser.msgBox(couldNotRevoke
        ? "Sessão encerrada neste dispositivo, mas não foi possível encerrá-la no servidor. Ela deixará de valer quando expirar."
        : "Sessão encerrada com sucesso");
    }
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Solicitação de Cartões');
    sheet.getRange("B11").setFontColor("grey")
    sheet.getRange("D11").setFontColor("grey")
    sheet.getRange("J11").setFontColor("grey")

    sheet.getRange("B11").setValue("Ex: StarkBank")
    sheet.getRange("D11").setValue("Ex: (11) 99999-9999")
    sheet.getRange("J11").setValue("Ex: 20018-183")

    let paymentRequestExternalIdsheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('paymentRequestExternal');
    paymentRequestExternalIdsheet.getRange("C1").setValue("{\"transfer\": [], \"boleto\": []}")
  }
}
