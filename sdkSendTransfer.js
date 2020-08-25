function sendTransferDialog()
{
    var html = HtmlService.createHtmlOutputFromFile('FormSendOrder');
    SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
    .showModalDialog(html, 'Envio de Transferência sem Aprovação');
}