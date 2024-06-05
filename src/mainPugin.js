function onOpen() {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('Login')
      .addItem('Login', 'showHelloWorld')
      .addToUi();

    ui.createMenu('Get Transfers')
      .addItem('get transfers', 'getTransfers')
      .addToUi();
  }
  
  function showHelloWorld() {
    var htmlOutput = HtmlService.createHtmlOutputFromFile('FormCredentials')
        .setWidth(1100)
        .setHeight(600);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Login');
  }

  function getTransfers() {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = null
    try {
        sheet = spreadsheet.insertSheet('poarr');
        sheet.activate();
    } catch { }
    var htmlOutput = HtmlService.createHtmlOutputFromFile('FormViewTransfer')
        .setWidth(1100)
        .setHeight(600);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'ViewTransfers');
  }