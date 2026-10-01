
function fetchCustomers()
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Clientes');
    let i = 10;
    let cursor = "";
    let query = {};

    clearSheet(sheet);
    formatHeader(sheet);

    let zeroElements = true;
    do {
        query["cursor"] = cursor;
        json = parseResponse(fetch("/boleto/customer", method = 'GET', null, query));

        if (json[1] != 200) {
          throw new Error(json[0]["errors"][0]["message"])
        }

        json = json[0]

        let customers = json["customers"];
        cursor = json["cursor"];
        for(let element of customers)
        {
            zeroElements = false;
            i++;
            sheet.getRange('A' + i.toString()).setValue(safeText(element["id"]));
            sheet.getRange('B' + i.toString()).setValue(safeText(element["name"]));
            sheet.getRange('C' + i.toString()).setValue(safeText(element["taxId"]));
            sheet.getRange('D' + i.toString()).setValue(safeText(element["email"]));
            sheet.getRange('E' + i.toString()).setValue(safeText(element["phone"]));

            let address = element["address"];
            sheet.getRange('F' + i.toString()).setValue(safeText(address["streetLine1"]));
            sheet.getRange('G' + i.toString()).setValue(safeText(address["streetLine2"]));
            sheet.getRange('H' + i.toString()).setValue(safeText(address["district"]));
            sheet.getRange('I' + i.toString()).setValue(safeText(address["city"]));
            sheet.getRange('J' + i.toString()).setValue(safeText(address["stateCode"]));
            sheet.getRange('K' + i.toString()).setValue(safeText(address["zipCode"]));

            sheet.getRange('L' + i.toString()).setValue(safeText(element["tags"].join(", ")));
        }
    } while(cursor);
    if(zeroElements) {
        Browser.msgBox("Nenhum cliente cadastrado.");
    }
}