function sendMessage(message) {
    SpreadsheetApp.getUi().alert(message);
}

function getUserCenterId() {
    centers = getCenter();
    return centers;
}

function getCenter() {
    checkLogin();
    let centers = [];
    let query = {};
    let cursor = "";

    do {
        query["cursor"] = cursor;
        query["fields"] = "id,name,badgeCount";
        let responseApi = fetch("/cost-center", method = 'GET', null, query);

        if (parseResponse(responseApi)[1] != 200) {
            Browser.msgBox(parseResponse(responseApi)[0]["errors"][0]["message"])
            throw new Error()
        }

        let [json, status] = parseResponse(responseApi);

        elementList = json["centers"];
        cursor = json["cursor"];

        for (let center of elementList) {
            centers.push(center);
        }
    } while (cursor);
    return centers;
}

function checkLogin() {
    let responseApi = fetch("/balance", method = 'GET', null, null);

    let [json, status] = parseResponse(responseApi);
    switch (status) {
        case 500:
            throw new Error(JSON.parse(json)["errors"]["message"]);
        case 400:
            let errors = Array.from(json["errors"]);
            Logger.log(errors)
            errors.forEach(error => {
                if (error.code == "invalidCredentials") {
                    sendMessage("Sessão expirada! \nFaça o login novamente");
                    return;
                };
                let errorMessage = error.message;
                sendMessage(errorMessage);
            });
    };
}

function sendPaymentRequestBatch(payload, query) {
    let [json, status] = parseResponse(fetch("/payment-request", method = 'POST', {"requests": payload}, query))
    return {
        "status": status,
        "content": json
    }
}

function confirmOrders(sheet, batch, chunkLen, batchSize, coll) {
    for (let sentOrder = 0; sentOrder < chunkLen; sentOrder++) {
        sheet.getRange(coll + (sentOrder + 11 + (batch * batchSize)).toString()).setValue("Enviado")
    }
}

function failOrders(sheet, batch, batchSize, errors, colStat, colReas) {
    let errorMessages = ""
    errors.forEach(
        error => {
            if (error.code == "invalidCredentials") {
                sendMessage("Sessão expirada! \nFaça o login novamente");
                return;
            };
            let message = error.message + "\n"
            if (/Element [0-9]*:/.test(error.message)) {
                let requestNumber = parseInt(error.message.split('Element ').pop().split(':')[0]);
                let lineNumber = parseInt(requestNumber)
                message = "Erro - Linha " + (requestNumber + 11 + (batch * batchSize)).toString() + ":" + error.message.split(':')[1] + "\n";
                sheet.getRange(`${colReas}${(lineNumber + 11 + (batch * batchSize)).toString()}`).setValue(error.message.split(':')[1])
                sheet.getRange(`${colStat}${(lineNumber + 11 + (batch * batchSize)).toString()}`).setValue("Falha")
            };
            errorMessages = errorMessages.concat(message);
            }
    )
    return errorMessages
}

function paymentRequestManager() {
    let externalOrders = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('paymentRequestExternal').getRange('C1').getValue();
    let json = JSON.parse(externalOrders.toString());
    return json
  }

function updatePaymentRequestManager(array, type) {
    let json = paymentRequestManager()
    json[type].push(...array)
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('paymentRequestExternal').getRange('C1').setValue(JSON.stringify(json));
}