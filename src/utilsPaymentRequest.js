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

// What became of a batch: "sent"; "rejected" (a 4xx answer: nothing was created); or "unknown" (a 5xx
// answer, an answer that is not JSON, or none at all): the requests may exist, so the person checks
// them before sending those rows again.
function sendPaymentRequestBatch(payload, query) {
    let response = null;
    try {
        response = fetch("/payment-request", method = 'POST', {"requests": payload}, query)
    } catch (error) {
        // Without a session the SDK throws its own message as text, before anything is sent.
        if (typeof error === "string") {
            throw error;
        }
        return {"outcome": "unknown", "errors": []}
    }
    let status = response.getResponseCode();
    if (status == 200) {
        return {"outcome": "sent", "errors": []}
    }
    if (status >= 400 && status < 500) {
        let errors = errorsOf_(response);
        return {"outcome": "rejected", "errors": errors.length > 0 ? errors : [{"code": "httpError", "message": "A API recusou o envio (status " + status + ")."}]}
    }
    return {"outcome": "unknown", "errors": []}
}

function errorsOf_(response) {
    try {
        return Array.from(JSON.parse(response.getContentText())["errors"] || []);
    } catch (error) {
        return [];
    }
}

// statusColumns: {first: the status column (the reason is the next one), notSent: the status of a row not sent}.
function confirmOrders(sheet, firstLine, chunkLen, statusColumns) {
    writeRows_(sheet, firstLine, statusColumns.first, Array.from({length: chunkLen}, () => ["Enviado"]));
}

function markUncertainOrders_(sheet, firstLine, chunkLen, statusColumns) {
    let statuses = Array.from({length: chunkLen}, () => ["Verificar", "Confira em Consulta de Aprovações antes de enviar de novo"]);
    writeRows_(sheet, firstLine, statusColumns.first, statuses);
}

function failOrders(sheet, firstLine, chunkLen, errors, statusColumns) {
    let statuses = Array.from({length: chunkLen}, () => [statusColumns.notSent, ""]);
    let errorMessages = ""
    errors.forEach(
        error => {
            if (error.code == "invalidCredentials") {
                sendMessage("Sessão expirada! \nFaça o login novamente");
                return;
            };
            let message = error.message + "\n"
            let element = /Element ([0-9]+):/.exec(error.message);
            if (element) {
                let index = parseInt(element[1]);
                message = "Erro - Linha " + (index + firstLine).toString() + ":" + error.message.split(':')[1] + "\n";
                if (index < chunkLen) {
                    statuses[index] = ["Falha", error.message.split(':')[1]];
                }
            };
            errorMessages = errorMessages.concat(message);
            }
    )
    writeRows_(sheet, firstLine, statusColumns.first, statuses);
    return errorMessages
}

// One message for the whole sending: everything sent, some or all batches refused, or batches whose
// outcome is unknown and must be checked before they are sent again.
function sendOutcomeMessage_(batchCount, failedBatchs, uncertainBatchs, returnMessage) {
    if (failedBatchs == 0 && uncertainBatchs == 0) {
        sendMessage("Todos os itens foram enviados.");
        return
    }
    if (uncertainBatchs > 0) {
        let uncertain = "Não foi possível confirmar o envio de alguns itens: eles estão marcados como \"Verificar\". Confira em \"Consulta de Aprovações\" antes de enviá-los de novo.";
        sendMessage(returnMessage ? uncertain + "\n\n" + returnMessage : uncertain);
        return
    }
    if (failedBatchs == batchCount) {
        sendMessage("Falha no envio, verifique a situação de suas solicitações." + "\n\n" + returnMessage);
        return
    }
    sendMessage("Falha no envio de alguns itens, verifique a situação de suas solicitações." + "\n\n" + returnMessage);
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