function payBoletosDialog() {
    var html = HtmlService.createHtmlOutputFromFile('FormPayBoleto');
    SpreadsheetApp.getUi()
    .showModalDialog(html, 'Pagamento de Boletos');
}

function executeBoletoPayment(password, privateKeyPem)
{
    verifyPassword(password);
    sendPayments(privateKeyPem);
}

function sendPayments(privateKeyPem)
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pagamento de Boletos');
    let payments = [];

    for(let i=11; i<=sheet.getLastRow(); i++) {
        payments.push({
            line: sheet.getRange('A' + i.toString()).getValue(),
            taxId: sheet.getRange('B' + i.toString()).getValue(),
            scheduled: sheet.getRange('C' + i.toString()).getValue(),
            description: sheet.getRange('D' + i.toString()).getValue(),
            tags: sheet.getRange('E' + i.toString()).getValue().split(",")
        });
    }

    let payload = {
        payments: payments
    }

    json = JSON.parse(fetch("/charge-payment", method = 'POST', payload, null, 'v1', null, privateKeyPem).content);
}