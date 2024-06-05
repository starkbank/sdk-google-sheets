function sendInvoices() {
   let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Emissão de Invoice Pix');
    let line = 10;
    let query = {};
    let invoices = [];
    let errorMessages = "";
    
    const initialLine = 11;
    const batchSize = 100;
    for (let batchInitialLine = initialLine; batchInitialLine <= sheet.getLastRow(); batchInitialLine = line){
        for (line = batchInitialLine; line < batchInitialLine + batchSize && line <= sheet.getLastRow(); line++){
            invoice = {
                 amount: parseInt(Math.round(100*sheet.getRange('C' + line.toString()).getValue()), 10),
                 taxId: sheet.getRange('B' + line.toString()).getValue(),
                 name: removeDiacritics(sheet.getRange('A' + line.toString()).getValue()),
            };

            var descriptions = []
            var due = sheet.getRange('D' + line.toString()).getValue()
            var expiration = sheet.getRange('G' + line.toString()).getValue()
            var fine = sheet.getRange('E' + line.toString()).getValue()
            var interest = sheet.getRange('F' + line.toString()).getValue()


            if (sheet.getRange('H' + line.toString()).getValue()) {
              descriptions.push({
                "key": removeDiacritics(sheet.getRange('H' + line.toString()).getValue()),
                "value": removeDiacritics(sheet.getRange('I' + line.toString()).getValue().toString())
              })
            }

            if (sheet.getRange('J' + line.toString()).getValue()) {
              descriptions.push({
                "key": removeDiacritics(sheet.getRange('J' + line.toString()).getValue()),
                "value": removeDiacritics(sheet.getRange('K' + line.toString()).getValue().toString())
              })
            }

            if (sheet.getRange('L' + line.toString()).getValue()) {
              descriptions.push({
                "key": removeDiacritics(sheet.getRange('L' + line.toString()).getValue()),
                "value": removeDiacritics(sheet.getRange('M' + line.toString()).getValue().toString())
              })
            }

            if (due) {
              invoice["due"] = formatToLocalDatetime(due)
            }

            if (expiration) {
              invoice["expiration"] = parseInt(expiration) * 3600
            }

            if (fine) {
              invoice["fine"] = parseFloat(fine)
            }

            if (interest) {
              invoice["interest"] = parseFloat(interest)
            }

            if (descriptions.length > 0){
              invoice["descriptions"] = descriptions
            }

            invoices.push(invoice);
        }

        let payload = {"invoices": invoices};

        let responseApi = fetch("/invoice", method = 'POST', payload, query);

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
    let successMessage = "Sucesso! \nTodas as Invoices foram criadas !"
    errorMessages ? sendMessage(errorMessages) : sendMessage(successMessage)
}