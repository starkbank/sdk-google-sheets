
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
          Browser.msgBox(json[0]["errors"][0]["message"])
          throw new Error()
        }

        json = json[0]

        let customers = json["customers"];
        cursor = json["cursor"];
        for(let element of customers)
        {
            zeroElements = false;
            i++;
            sheet.getRange('A' + i.toString()).setValue(element["id"]);
            sheet.getRange('B' + i.toString()).setValue(element["name"]);
            sheet.getRange('C' + i.toString()).setValue(element["taxId"]);
            sheet.getRange('D' + i.toString()).setValue(element["email"]);
            sheet.getRange('E' + i.toString()).setValue(element["phone"]);

            let address = element["address"];
            sheet.getRange('F' + i.toString()).setValue(address["streetLine1"]);
            sheet.getRange('G' + i.toString()).setValue(address["streetLine2"]);
            sheet.getRange('H' + i.toString()).setValue(address["district"]);
            sheet.getRange('I' + i.toString()).setValue(address["city"]);
            sheet.getRange('J' + i.toString()).setValue(address["stateCode"]);
            sheet.getRange('K' + i.toString()).setValue(address["zipCode"]);

            sheet.getRange('L' + i.toString()).setValue(element["tags"].join(", "));
        }
    } while(cursor);
    if(zeroElements) {
        Browser.msgBox("Nenhum cliente cadastrado.");
    }
}