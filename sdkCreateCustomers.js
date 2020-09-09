
function createCustomers()
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Cadastro de Clientes');
    let customers = [];

    formatHeader(sheet);

    for(let i=11; i<=sheet.getLastRow(); i++){

        let address = {
            streetLine1: sheet.getRange('E' + i.toString()).getValue(),
            streetLine2: sheet.getRange('F' + i.toString()).getValue(),
            district: sheet.getRange('G' + i.toString()).getValue(),
            city: sheet.getRange('H' + i.toString()).getValue(),
            stateCode: sheet.getRange('I' + i.toString()).getValue(),
            zipCode: sheet.getRange('J' + i.toString()).getValue()
        };

        let tags = sheet.getRange('K' + i.toString()).getValue().split(",");
    
        let customer = {
            name: sheet.getRange('A' + i.toString()).getValue(),
            taxId: sheet.getRange('B' + i.toString()).getValue(),
            email: sheet.getRange('C' + i.toString()).getValue(),
            phone: sheet.getRange('D' + i.toString()).getValue(),
            tags: tags,
            address: address
        };

        customers.push(customer);
    }

    let payload = {
        customers: customers
    };

    try {
        fetch("/charge/customer", method = 'POST', payload, null);
        Browser.msgBox("Clientes cadastrados com sucesso!");
    } catch(e) {
        let message = "Clientes não cadastrados. ";
        let parsed = JSON.parse(e);
        let message2 = parsed["message"];
        if(message2.includes("Element")) {
            let splitMessage = message2.split(":");
            splitMessage[0] = splitMessage[0].replace("Element ", "");
            splitMessage[0] = "Linha " + (10 - (-splitMessage[0]));
            message += splitMessage.join(":");
        }

        if("errors" in parsed)
        {
            for(let suberror of parsed["errors"])
            {
                let suberrorMessage = suberror["message"];
                let splitMessage = suberrorMessage.split(":");
                splitMessage[0] = splitMessage[0].replace("Element ", "");
                splitMessage[0] = "Linha " + (10 - (-splitMessage[0]));
                let newMessage = splitMessage.join(":");
                message += "\n" + newMessage;
            }
        }
        Browser.msgBox(message);

    }

}