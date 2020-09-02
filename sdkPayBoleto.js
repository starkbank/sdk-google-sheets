function payBoletosDialog() {
    var html = HtmlService.createHtmlOutputFromFile('FormPayBoleto');
    SpreadsheetApp.getUi()
    .showModalDialog(html, 'Pagamento de Boletos');
}

function executeBoletoPayment(password, privateKeyPem)
{
    //verifyPassword(password);
    sendPayments(privateKeyPem);
}

function sendPayments(privateKeyPem)
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pagamento de Boletos');
    let payments = [];

    for(let i=11; i<=sheet.getLastRow(); i++) {
        let paymentItem  = {
            taxId: sheet.getRange('B' + i.toString()).getValue(),
            scheduled: sheet.getRange('C' + i.toString()).getValue().replace(/(\d{2})\/(\d{2})\/(\d{4})*/, '$3-$2-$1'),
            description: sheet.getRange('D' + i.toString()).getValue(),
            tags: sheet.getRange('E' + i.toString()).getValue().split(",")
        };

        let barCodeOrLine = sheet.getRange('A' + i.toString()).getValue();
        barCodeOrLine = barCodeOrLine.replace(/[^0-9]/g, '');
        if(barCodeOrLine.length > 44)
        {
            paymentItem["line"] = barCodeOrLine;
        }
        else
        {
            paymentItem["barCode"] = barCodeOrLine;
        }

        payments.push(paymentItem);
    }

    let payload = {
        payments: payments
    };

    //throw new Error(JSON.stringify(payload));

    json = JSON.parse(fetch("/charge-payment", method = 'POST', payload, null, 'v1', null, privateKeyPem).content);
}