function getDefaultUser() {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  this.workspace = sheet.getRange(1, 2).getValue();
  this.email = sheet.getRange(2, 2).getValue();
  this.environment = sheet.getRange(3, 2).getValue();
  this.accessToken = sheet.getRange(4, 2).getValue();
  this.name = sheet.getRange(5, 2).getValue();
  this.workspaceId = sheet.getRange(6, 2).getValue();
  this.privateKey = sheet.getRange(7, 2).getValue();
  this.publicKey = sheet.getRange(8, 2).getValue();
  this.accessId = sheet.getRange(9, 2).getValue();
  this.cartId = sheet.getRange(6, 3).getValue();
}
