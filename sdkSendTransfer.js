function sendTransferDialog() {
    var html = HtmlService.createHtmlOutputFromFile('FormSendTransfer');
    SpreadsheetApp.getUi()
    .showModalDialog(html, 'Envio de Transferência sem Aprovação');
}

function executeTransfer(password, privateKeyPem, description, externalId, tags)
{
    verifyPassword(password);
    sendTransfer(privateKeyPem, description, externalId, tags);
}

function sendTransfer(privateKeyPem, description, externalId, tags)
{

    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transferência sem Aprovação');
    let transfers = [];
    
    formatHeader(sheet);

    for(let i=11; i<=sheet.getLastRow(); i++) {
        transfers.push({
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

    let transaction = {
        externalId: externalId,
        description: description,
        tags: tags
    }

    let payload = {
        transaction: transaction,
        transfers: transfers
    }
    
    json = JSON.parse(fetch("/transfer", method = 'POST', payload, null, 'v1', null, privateKeyPem).content);
}