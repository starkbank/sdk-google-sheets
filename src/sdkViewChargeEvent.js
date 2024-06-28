function selectChargeEventDialog()
{
    let html = HtmlService.createHtmlOutputFromFile('FormViewChargeEvent').setHeight(400);
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

    query["types"] = eventOption;

    clearSheet(sheet);
    formatHeader(sheet);

    let user = new getDefaultUser();
    let hostname = getHostname(user.environment.toLowerCase(), "v2");
    let zeroLogs = true;

    do {
        query["cursor"] = cursor;

        json = parseResponse(fetch("/boleto/log", method = 'GET', null, query));

        if (json[1] != 200) {
          throw new Error(json[0]["errors"][0]["message"])
        }

        elementsList = json[0]["logs"];
        cursor = json[0]["cursor"];

        let idsList = [];
        let chargeIdLineAmountDict = {};
        for(let log of elementsList)
        {
            zeroLogs = false;
            i +=1;
            let charge = log["boleto"];
            let pdfLink = '=HYPERLINK("' + hostname + "/boleto/" + charge["id"] + '/pdf", "PDF")';
            let tags = charge["tags"];
            idsList.push(charge["id"]);
            chargeIdLineAmountDict[charge["id"]] = [i, parseInt(charge["amount"])];
            sheet.getRange('A' + i.toString()).setValue(formatToLocalDatetime(log["created"]));
            sheet.getRange('B' + i.toString()).setValue(eventEntoPt(charge["status"]));
            sheet.getRange('C' + i.toString()).setValue(charge["name"]);
            sheet.getRange('D' + i.toString()).setValue(charge["taxId"]);
            sheet.getRange('E' + i.toString()).setValue(stringToCurrency(charge["amount"]));

            sheet.getRange('J' + i.toString()).setValue(formatToLocalDatetime(charge["created"]));
            sheet.getRange('K' + i.toString()).setValue(formatToLocalDatetime(charge["due"]));
            sheet.getRange('L' + i.toString()).setValue(charge["barCode"]);
            sheet.getRange('M' + i.toString()).setValue(charge["id"]);
            sheet.getRange('N' + i.toString()).setValue(parseInt(charge["fee"]) / 100.0);
            sheet.getRange('O' + i.toString()).setValue(tags.join(","));
            sheet.getRange('P' + i.toString()).setValue(pdfLink);
            sheet.getRange('Q' + i.toString()).setValue(charge["streetLine1"]);
            sheet.getRange('R' + i.toString()).setValue(charge["streetLine2"]);
            sheet.getRange('S' + i.toString()).setValue(charge["district"]);
            sheet.getRange('T' + i.toString()).setValue(charge["city"]);
            sheet.getRange('U' + i.toString()).setValue(charge["stateCode"]);
            sheet.getRange('V' + i.toString()).setValue(charge["zipCode"]);
        }
        if(idsList.length > 0)
        {
            getCreatedLogs(idsList, chargeIdLineAmountDict, sheet);
        }

    } while(cursor);
    if(zeroLogs) {
        Browser.msgBox("Nenhum boleto encontrado para os critérios pesquisados.");
    }
}

function getCreatedLogs(idsList, chargeIdLineAmountDict, sheet)
{
    let cursor = "";
    let query = {};
    
    query["types"] = "registered";
    query["boletoIds"] = idsList.join(",");


    do {
        query["cursor"] = cursor;
        json = parseResponse(fetch("/boleto/log", method='GET', null, query));

        if (json[1] != 200) {
          throw new Error(json[0]["errors"][0]["message"])
        }

        elementsList = json[0]["logs"];
        cursor = json[0]["cursor"];

        for(let log of elementsList)
        {
            let charge = log["boleto"];
            
            let line = chargeIdLineAmountDict[charge["id"]][0];
            let amount = chargeIdLineAmountDict[charge["id"]][1] / 100.0;
            let nominalAmount = parseInt(charge["amount"]) / 100.0;
            let deltaAmount = amount - nominalAmount;
            sheet.getRange('F' + line.toString()).setValue(nominalAmount);

            if(deltaAmount < 0) {
                sheet.getRange('G' + line.toString()).setValue(deltaAmount);
            } 
            else if(deltaAmount > 0) {
                let fine = parseInt(charge["fine"]) * nominalAmount/100;
                let interest = amount - fine - nominalAmount;
                sheet.getRange('H' + line.toString()).setValue(fine);
                sheet.getRange('I' + line.toString()).setValue(interest);
            }            
        }

    } while(cursor);

}

function eventEntoPt(event)
{
    switch(event)
    {
        case "paid":
            return "pago";
        case "bank":
            return "creditado";
        case "register":
            return "criado (pendente de registro)";
        case "registered":
            return "registrado";
        case "overdue":
            return "vencido";
        case "cancel":
            return "em cancelamento";
        case "canceled":
            return "cancelado";
        case "failed":
            return "falha";
        case "unknown":
            return "desconhecido";
        case "update":
            return "em atualização";
        case "updated":
            return "atualizado";
    }
}