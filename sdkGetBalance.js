
function getBalance() {
    let user = new getDefaultUser();
    try{
        let jsonData = JSON.parse(fetch("/bank/account/" + user.workspaceId, method = 'GET', null).content);
        let balance = parseInt(jsonData["account"]["balance"]) / 100.0;
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