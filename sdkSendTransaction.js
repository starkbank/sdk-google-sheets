function sendTransactionDialog() {
    var html = HtmlService.createHtmlOutputFromFile('FormSendTransaction');
    SpreadsheetApp.getUi()
    .showModalDialog(html, 'Envio de Transferência Interna');
}

function executeTransaction(password, privateKeyPem)
{
    verifyPassword(password);
}

function sendTransaction(privateKeyPem)
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transferência Interna');

    formatHeader(sheet);

    for(let i=11; i<=sheet.getLastRow(); i++) {
        let transaction = {
            receiverId: sheet.getRange('A' + i.toString()).getValue(),
            amount: parseInt(100*sheet.getRange('B' + i.toString()).getValue(), 10),
            description: sheet.getRange('C' + i.toString()).getValue(),
            externalId: sheet.getRange('D' + i.toString()).getValue(),
            tags: sheet.getRange('E' + i.toString()).getValue().split(",")
        };
        
    }

}