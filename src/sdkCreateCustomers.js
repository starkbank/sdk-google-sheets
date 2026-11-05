function createCustomers()
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Cadastro de Clientes');
    let customers = [];

    formatHeader(sheet);

    for(let row of readRows_(sheet, 11)){

        let address = {
            streetLine1: cellOf_(row, 'E'),
            streetLine2: cellOf_(row, 'F'),
            district: cellOf_(row, 'G'),
            city: cellOf_(row, 'H'),
            stateCode: cellOf_(row, 'I'),
            zipCode: cellOf_(row, 'J')
        };

        let tags = cellOf_(row, 'K').split(",");
    
        let customer = {
            name: cellOf_(row, 'A'),
            taxId: cellOf_(row, 'B'),
            email: cellOf_(row, 'C'),
            phone: cellOf_(row, 'D'),
            tags: tags,
            address: address
        };

        customers.push(customer);
    }

    let payload = {
        customers: customers
    };

    let response = null;
    try {
        response = parseResponse(fetch("/boleto/customer", method = 'POST', payload, null));
    } catch(e) {
        // Without a session the SDK throws its own message as JSON text, before anything is sent.
        if (typeof e !== "string") {
            throw e;
        }
        Browser.msgBox("Clientes não cadastrados. " + JSON.parse(e)["message"]);
        return;
    }

    let [json, status] = response;
    if (status == 200) {
        Browser.msgBox("Clientes cadastrados com sucesso!");
        return;
    }

    // "Element 0: ..." is the first customer, the one in row 11.
    let message = "Clientes não cadastrados. ";
    for (let suberror of json["errors"]) {
        let element = /^Element (\d+):(.*)$/.exec(suberror["message"]);
        message += "\n" + (element ? "Linha " + (11 + parseInt(element[1])) + ":" + element[2] : suberror["message"]);
    }
    Browser.msgBox(message);
}
