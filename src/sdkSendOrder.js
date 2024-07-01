
function SendOrder(centerId) {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transferência com Aprovação');
    let externalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('paymentRequestExternal');
    let line = 10;
    let query = {};
    let request = {};
    let requests = [];
    let payment = {};
    let errorMessages = "";
    let sentItems = "";
    let bactchLineExternalId = 11;
    formatHeader(sheet);
    
    const initialLine = 11;
    const batchSize = 100;

    let stringJson = ""

    if (externalSheet.getRange('C1').getValue().toString().length < 2) {
        stringJson = "{}";
    }

    if (externalSheet.getRange('C1').getValue().toString().length >= 2) {
        stringJson = externalSheet.getRange('C1').getValue().toString().trim()
    }

    let jsonExternalId = JSON.parse(stringJson);

    for (let batchInitialLine = initialLine; batchInitialLine <= sheet.getLastRow(); batchInitialLine = line){
        requests = [];
        request = {};
        externalIds = [];
        anysent = true;

        for (line = batchInitialLine; line < batchInitialLine + batchSize && line <= sheet.getLastRow(); line++){

            let customerName = removeDiacritics(sheet.getRange('A' + line.toString()).getValue());
            let taxId = removeDiacritics(sheet.getRange('B' + line.toString()).getValue());
            let amount = parseInt(Math.round(100*sheet.getRange('C' + line.toString()).getValue()), 10);
            let bankCode = removeDiacritics(sheet.getRange('D' + line.toString()).getValue());
            let branchCode = removeDiacritics(sheet.getRange('E' + line.toString()).getValue());
            let accountNumber = removeDiacritics(sheet.getRange('F' + line.toString()).getValue());

            let calculatedExternalId = calculateExternalId(amount, customerName, taxId, bankCode, branchCode, accountNumber)

            if (jsonExternalId[calculatedExternalId]) {
                bactchLineExternalId += 1;
                jsonExternalId[calculatedExternalId] = line
                externalIds.push(calculatedExternalId)
            }

            if (!jsonExternalId[calculatedExternalId]) {

                jsonExternalId[calculatedExternalId] = line

                externalIds.push(calculatedExternalId)
                payment = {
                    name: customerName,
                    taxId: taxId,
                    amount: amount,
                    bankCode: bankCode,
                    branchCode: branchCode,
                    accountNumber: accountNumber
                };
    
                var schedule = sheet.getRange('G' + line.toString()).getValue();
    
                accountType = sheet.getRange('H' + line.toString()).getValue();
                if (accountType) {
                    payment["accountType"] = accountType;
                }
    
                tags = removeDiacritics(sheet.getRange('I' + line.toString()).getValue());
                if (tags) {
                    request["tags"] = tags.split(",");
                }
    
                description = removeDiacritics(sheet.getRange('J' + line.toString()).getValue())
                if (description) {
                    payment["description"] = description;
                }
                
                request = {
                    centerId: centerId,
                    type: "transfer",
                    payment: payment,
                };
    
                if (schedule != "") {
                    request["due"] = formatToLocalDatetime(schedule)
                }
                
                requests.push(request);
            }
        }

        if (requests.length > 0) {
            let payload = {requests: requests};
            let responseApi = fetch("/payment-request", method = 'POST', payload, query);

            let [json, status] = parseResponse(responseApi)
            if (status == 200) {
                let lastExternalIdRow = 11
                if (externalSheet.getLastRow() > 7) {
                    lastExternalIdRow = externalSheet.getLastRow() + 1
                }

                for (let c in jsonExternalId) {
                    sheet.getRange("K" + jsonExternalId[c].toString()).setValue("Pagemento Enviado")
                }

                sentItems = "!!";

                externalSheet.getRange("C1").setValue(JSON.stringify(jsonExternalId))
            }
            switch (status) {
                case 500:
                    throw new Error(JSON.parse(json)["errors"]["message"]);
                case 400:
                    let errors = Array.from(json["errors"]);   
                    errors.forEach(error => {
                        if (error.code == "invalidCredentials") {
                            sendMessage("Sessão expirada! \nFaça o login novamente");
                            return;
                        };
                        let errorMessage = error.message;

                        let message = errorMessage + "\n"
                        if (/Element [0-9]*:/.test(errorMessage)) {
                            let requestNumber = errorMessage.split('Element ').pop().split(':')[0];
                            let lineNumber = parseInt(requestNumber)

                            let tempJson = requests[lineNumber]["payment"]

                            let customerName = tempJson["name"]
                            let taxId = tempJson["taxId"]
                            let amount = tempJson["amount"]
                            let bankCode = tempJson["bankCode"]
                            let branchCode = tempJson["branchCode"]
                            let accountNumber = tempJson["accountNumber"]

                            let calculatedExternalId = calculateExternalId(amount, customerName, taxId, bankCode, branchCode, accountNumber)
                            
                            message = "Erro - Linha " + jsonExternalId[calculatedExternalId].toString() + ":" + errorMessage.split(':')[1] + "\n";
                        };
                        errorMessages = errorMessages.concat(message);
                    })
                    sendMessage(errorMessages);
                    return
            }
        }
    }

    sentItems ? sendMessage("Items enviados\n" + sentItems + "\n\n" + errorMessages) : sendMessage(errorMessages); 
}
    
function sendMessage(message){
    SpreadsheetApp.getUi().alert(message);
}

function getUserCenterId(){
    centers = getCenter();
    return centers;
}

function getCenter(){
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

        for (let center of elementList){
            centers.push(center);
        }
    } while (cursor);
    return centers;
}

function checkLogin(){
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

function selectCenterDialog() {
    var html = HtmlService.createHtmlOutputFromFile('FormSelectCenter');
    SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
    .showModalDialog(html, 'Envio de Transferência para Aprovação');
}
