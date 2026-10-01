function getDefaultUser() {
  purgeLegacyCredentials_();
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  // Who the user is comes with the session: the cells are shared with everyone who opens the spreadsheet.
  let {session, profile} = SessionStore.loadSessionAndProfile();
  // A session without a profile was made by a version that kept the profile in the cells, and the
  // requests could not be built from it: the user logs in again.
  if (!profile.environment) {
    session = {privateKey: "", publicKey: "", accessId: ""};
  }
  this.workspace = profile.workspace;
  this.email = profile.email;
  this.environment = profile.environment;
  this.name = profile.name;
  this.workspaceId = profile.workspaceId;
  this.privateKey = session.privateKey;
  this.publicKey = session.publicKey;
  this.accessId = session.accessId;
  this.cartId = sheet.getRange(6, 3).getValue();
}
