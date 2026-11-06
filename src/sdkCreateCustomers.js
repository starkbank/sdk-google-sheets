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