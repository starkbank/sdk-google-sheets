function selectChargeEventDialog()
{
    let html = HtmlService.createHtmlOutputFromFile('FormViewChargeEvent');
    SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
    .showModalDialog(html, 'Histórico de Boletos Emitidos')
}

function viewChargeEvents(after, before, eventOption)
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Histórico de Boletos Emitidos');
    let i = 10;
    let cursor = "";
    let query = {};
    if(after) {
        query["after"] = after;
    }
    if(before) {
        query["before"] = before;
    }

    query["events"] = eventOption;
}