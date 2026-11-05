
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
        let rows = [];
        for(let element of customers)
        {
            zeroElements = false;
            let address = element["address"];
            rows.push([
                element["id"],
                element["name"],
                element["taxId"],
                element["email"],
                element["phone"],
                address["streetLine1"],
                address["streetLine2"],
                address["district"],
                address["city"],
                address["stateCode"],
                address["zipCode"],
                element["tags"].join(", "),
            ]);
        }
        writeRows_(sheet, i + 1, 1, rows);
        i += rows.length;
    } while(cursor);
    if(zeroElements) {
        Browser.msgBox("Nenhum cliente cadastrado.");
    }
}