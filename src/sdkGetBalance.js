
function getBalance() {
    try{
        let json = parseResponse(fetch("/balance", method = 'GET', null));
        if (json[1] != 200) {
          Browser.msgBox(json[0]["errors"][0]["message"])
          throw new Error()
        }
        jsonData = json[0]
        let balance = parseInt(jsonData["balances"][0]["amount"]) / 100.0;
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