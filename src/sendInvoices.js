function sendInvoices() {
   let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Emissão de Invoice Pix');
    let line = 10;
    let query = {};
    let invoices = [];
    let errorMessages = "";
    
    const initialLine = 11;
    const batchSize = 100;
    const rows = readRows_(sheet, 13);
    const lastLine = initialLine + rows.length - 1;
    for (let batchInitialLine = initialLine; batchInitialLine <= lastLine; batchInitialLine = line){
        for (line = batchInitialLine; line < batchInitialLine + batchSize && line <= lastLine; line++){
            let row = rows[line - initialLine];
            invoice = {
                 amount: parseInt(Math.round(100*cellOf_(row, 'C')), 10),
                 taxId: cellOf_(row, 'B'),
                 name: removeDiacritics(cellOf_(row, 'A')),
            };

            var descriptions = []
            var due = cellOf_(row, 'D')
            var expiration = cellOf_(row, 'G')
            var fine = cellOf_(row, 'E')
            var interest = cellOf_(row, 'F')


            if (cellOf_(row, 'H')) {
              descriptions.push({
                "key": removeDiacritics(cellOf_(row, 'H')),
                "value": removeDiacritics(cellOf_(row, 'I').toString())
              })
            }

            if (cellOf_(row, 'J')) {
              descriptions.push({
                "key": removeDiacritics(cellOf_(row, 'J')),
                "value": removeDiacritics(cellOf_(row, 'K').toString())
              })
            }

            if (cellOf_(row, 'L')) {
              descriptions.push({
                "key": removeDiacritics(cellOf_(row, 'L')),
                "value": removeDiacritics(cellOf_(row, 'M').toString())
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