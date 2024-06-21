
function SendOrder(centerId) {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transferência com Aprovação');
    let line = 10;
    let query = {};
    let request = {};
    let requests = [];
    let payment = {};
    let errorMessages = "";
    
    formatHeader(sheet);
    
    const initialLine = 11;
    const batchSize = 100;
    for (let batchInitialLine = initialLine; batchInitialLine <= sheet.getLastRow(); batchInitialLine = line){
        requests = [];
        request = {};
        for (line = batchInitialLine; line < batchInitialLine + batchSize && line <= sheet.getLastRow(); line++){
            payment = {
                name: removeDiacritics(sheet.getRange('A' + line.toString()).getValue()),
                taxId: sheet.getRange('B' + line.toString()).getValue(),
                amount: parseInt(Math.round(100*sheet.getRange('C' + line.toString()).getValue()), 10),
                bankCode: sheet.getRange('D' + line.toString()).getValue(),
                branchCode: sheet.getRange('E' + line.toString()).getValue(),
                accountNumber: sheet.getRange('F' + line.toString()).getValue()
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
        let payload = {requests: requests};
        let responseApi = fetch("/payment-request", method = 'POST', payload, query);

        if (parseResponse(responseApi)[1] != 200) {
          Browser.msgBox(parseResponse(responseApi)[0]["errors"][0]["message"])
          throw new Error()
        }

        let [json, status] = parseResponse(responseApi)
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
                        let lineNumber = parseInt(requestNumber) + batchInitialLine;
                        message = "Erro - Linha " + lineNumber + ":" + errorMessage.split(':')[1] + "\n";
                    };
                    errorMessages = errorMessages.concat(message);
                })
        }
    }
    let successMessage = "Sucesso! \nTodas as transferências foram enviadas para aprovação."
    errorMessages ? sendMessage(errorMessages) : sendMessage(successMessage)
}
    
function sendMessage(message){
    SpreadsheetApp.getUi().alert(message);
}

function getUserCenterId(){
    centers = getCenter();
    return centers;
}

function getCenter(){
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

    if (parseResponse(responseApi)[1] != 200) {
        Browser.msgBox(parseResponse(responseApi)[0]["errors"][0]["message"])
        throw new Error()
      }

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
