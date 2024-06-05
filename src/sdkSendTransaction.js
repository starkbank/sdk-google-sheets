function sendTransactionDialog() {
    var html = HtmlService.createHtmlOutputFromFile('FormSendTransaction').setWidth(1000).setHeight(450);
    SpreadsheetApp.getUi()
    .showModalDialog(html, 'Envio de Transferência Interna');
}

function executeTransaction(password, privateKeyPem, receiverId, amount, description, externalId, tags)
{
    verifyPassword(password);
    sendTransaction(privateKeyPem, receiverId, amount, description, externalId, tags);
}

function sendTransaction(privateKeyPem, receiverId, amount, description, externalId, tags)
{
  
    let transaction = {
        receiverId: receiverId,
        amount: parseInt(100*amount, 10),
        description: description,
        externalId: externalId,
        tags: tags.split(",")
    };

    let payload = {
        transaction: transaction
    };
                      // Change to v2
    json = JSON.parse(fetch("/bank/transaction", method = 'POST', payload, null, 'v1', null, privateKeyPem).content);
}