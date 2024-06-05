function payBoletosDialog() {
    var html = HtmlService.createHtmlOutputFromFile('FormPayBoleto');
    SpreadsheetApp.getUi()
    .showModalDialog(html, 'Pagamento de Boletos');
}

function executeBoletoPayment(centerId)
{
    let user = new getDefaultUser();
    sendPayments(centerId);
}

function sendPayments(centerId)
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pagamento de Boletos');
    let payments = [];

    formatHeader(sheet);

    for(let i=11; i<=sheet.getLastRow(); i++) {

        let boleto = {
          centerId: centerId,
          type: "boleto-payment"
        }

        let paymentItem  = {
            taxId: sheet.getRange('B' + i.toString()).getValue()
        };

        if (sheet.getRange('D' + i.toString()).getValue().length > 1) {
          paymentItem["description"] = removeDiacritics(sheet.getRange('D' + i.toString()).getValue())
        }

        if (sheet.getRange('E' + i.toString()).getValue().length > 1) {
          paymentItem["tags"] = removeDiacritics(sheet.getRange('E' + i.toString()).getValue().split(","))
        }

        if (sheet.getRange('C' + i.toString()).getValue().length > 1) {
          boleto["due"] = formatToLocalDatetime(sheet.getRange('C' + i.toString()).getValue())
        }

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

        boleto["payment"] = paymentItem

        payments.push(boleto);
    }

    let payload = {
        requests: payments
    };

    result = parseResponse(fetch("/payment-request", method = 'POST', payload, null, 'v2'));

    if (result[1] != 200) {
      Browser.msgBox(result[0]["errors"][0]["message"]);
    } else {
      Browser.msgBox("Pagamentos enviados com sucesso !!"); 
    }
}