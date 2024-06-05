function SplitReceivers() {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Split Receivers');
    let line = 10;
    let query = {};
    let splitReceivers = [];
    let errorMessages = "";
    
    const initialLine = 11;
    const batchSize = 100;
    for (let batchInitialLine = initialLine; batchInitialLine <= sheet.getLastRow(); batchInitialLine = line){
        for (line = batchInitialLine; line < batchInitialLine + batchSize && line <= sheet.getLastRow(); line++){
            splitReceiver = {
                 name: sheet.getRange('A' + line.toString()).getValue(),
                 taxId: sheet.getRange('B' + line.toString()).getValue(),
                 bankCode: sheet.getRange('C' + line.toString()).getValue(),
                 branchCode: sheet.getRange('D' + line.toString()).getValue(),
                 accountNumber: sheet.getRange('E' + line.toString()).getValue(),
                 accountType: sheet.getRange('F' + line.toString()).getValue()
            };

            tags = removeDiacritics(sheet.getRange('G' + line.toString()).getValue());
            if (tags) {
                splitReceiver["tags"] = tags.split(",");
                for (let i = 0; i < splitReceiver["tags"].length; i++) {
                    splitReceiver["tags"][i] = splitReceiver["tags"][i].trim();
                }
            }
            splitReceivers.push(splitReceiver);
        }

        let payload = {"receivers": splitReceivers};

        let responseApi = fetch("/split-receiver", method = 'POST', payload, query);

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
    let successMessage = "Sucesso! \nTodas os receivers foram criados."
    errorMessages ? sendMessage(errorMessages) : sendMessage(successMessage)
}