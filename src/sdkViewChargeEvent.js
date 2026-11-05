function selectChargeEventDialog()
{
    let html = HtmlService.createTemplateFromFile('FormViewChargeEvent').evaluate().setHeight(400);
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

    // The history has 22 columns (A to V).
    clearSheet(sheet, 22);
    formatHeader(sheet);

    let user = new getDefaultUser();
    let hostname = getHostname(user.environment.toLowerCase(), "v2");
    let zeroLogs = true;

    do {
        query["cursor"] = cursor;

        json = parseResponse(fetch("/boleto/log", method = 'GET', null, query));

        if (json[1] != 200) {
          throw JSON.stringify({"message": json[0]["errors"][0]["message"]})
        }

        elementsList = json[0]["logs"];
        cursor = json[0]["cursor"];

        let idsList = [];
        let chargeIdLineAmountDict = {};
        let rows = [];
        for(let log of elementsList)
        {
            zeroLogs = false;
            let charge = log["boleto"];
            let pdfLink = '=HYPERLINK("' + hostname + "/boleto/" + formulaText(charge["id"]) + '/pdf", "PDF")';
            idsList.push(charge["id"]);
            // A boleto may have several events in the page: each row keeps its own amount.
            chargeIdLineAmountDict[charge["id"]] = (chargeIdLineAmountDict[charge["id"]] || []).concat([[rows.length, parseInt(charge["amount"])]]);
            rows.push([
                formatToLocalDatetime(log["created"]),
                eventEntoPt(charge["status"]),
                charge["name"],
                charge["taxId"],
                stringToCurrency(charge["amount"]),
                null,
                null,
                null,
                null,
                formatToLocalDatetime(charge["created"]),
                formatToLocalDatetime(charge["due"]),
                charge["barCode"],
                charge["id"],
                parseInt(charge["fee"]) / 100.0,
                charge["tags"].join(","),
                new LinkFormula(pdfLink),
                charge["streetLine1"],
                charge["streetLine2"],
                charge["district"],
                charge["city"],
                charge["stateCode"],
                charge["zipCode"],
            ]);
        }
        writeRows_(sheet, i + 1, 1, rows);
        if(idsList.length > 0)
        {
            // F to I (nominal amount, discount, fine and interest) come from the registered logs.
            writeRows_(sheet, i + 1, 6, getCreatedLogs(idsList, chargeIdLineAmountDict));
        }
        i += rows.length;

    } while(cursor);
    if(zeroLogs) {
        Browser.msgBox("Nenhum boleto encontrado para os critérios pesquisados.");
    }
}

// Columns F to I of each row of the page; chargeIdLineAmountDict has, by boleto id, the [row index, amount] of each of its rows.
function getCreatedLogs(idsList, chargeIdLineAmountDict)
{
    let cursor = "";
    let query = {};
    let amountRows = idsList.map(() => [null, null, null, null]);
    
    query["types"] = "registered";
    query["boletoIds"] = idsList.join(",");


    do {
        query["cursor"] = cursor;
        json = parseResponse(fetch("/boleto/log", method='GET', null, query));

        if (json[1] != 200) {
          throw JSON.stringify({"message": json[0]["errors"][0]["message"]})
        }

        elementsList = json[0]["logs"];
        cursor = json[0]["cursor"];

        for(let log of elementsList)
        {
            let charge = log["boleto"];
            
            for (let [index, amountCents] of chargeIdLineAmountDict[charge["id"]]) {
                fillAmounts_(amountRows[index], amountCents / 100.0, charge);
            }
        }

    } while(cursor);

    return amountRows;
}

// Nominal amount (F), and the discount (G) or the fine (H) and interest (I) that make the paid amount.
function fillAmounts_(amountRow, amount, charge)
{
    let nominalAmount = parseInt(charge["amount"]) / 100.0;
    let deltaAmount = amount - nominalAmount;
    amountRow[0] = nominalAmount;
    if(deltaAmount < 0) {
        amountRow[1] = deltaAmount;
        return;
    }
    if(deltaAmount > 0) {
        let fine = parseFloat(charge["fine"]) * nominalAmount/100;
        amountRow[2] = fine;
        amountRow[3] = amount - fine - nominalAmount;
    }
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