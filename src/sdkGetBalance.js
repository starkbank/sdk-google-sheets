
function getBalance(getError=false) {
    try{
        let [json, status] = parseResponse(fetch("/balance", method = 'GET', null));

        if (status != 200 && getError) {
            switch (status) {
                case 500:
                    throw new Error(JSON.parse(json)["errors"]["message"]);
                case 400:
                    let errors = Array.from(json["errors"]);   
                    Logger.log(errors)
                    errors.forEach(error => {
                        if (error.code == "invalidCredentials") {
                            Browser.msgBox("Sessão expirada! \nFaça o login novamente");
                            return;
                        };
                        let errorMessage = error.message;
                        Browser.msgBox(errorMessage);
                    });
            };
            for(sheet of SpreadsheetApp.getActiveSpreadsheet().getSheets()) {
                if(sheet.getSheetName().toLowerCase() != "credentials") {
                    sheet.getRange("A7").setValue(null);
                }
            }
            return
        }

        if (status != 200 && !getError) {
            return
        }

        let balance = parseInt(json["balances"][0]["amount"]) / 100.0;
        for(sheet of SpreadsheetApp.getActiveSpreadsheet().getSheets()) {
            if(sheet.getSheetName().toLowerCase() != "credentials") {
                sheet.getRange("A7").setValue("Saldo: R$ " + Number(balance).toLocaleString("PT"));
            }
        }
    }
    catch(e)
    {
        Browser.msgBox(e);
    }
}

function viewBalance() {
    getBalance(true)
}