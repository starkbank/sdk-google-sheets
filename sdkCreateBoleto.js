
function createBoleto()
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Emissão de Boletos');
    let boletos = [];

    formatHeader(sheet);

    for(let i=11; i<=sheet.getLastRow(); i++) {

        let descriptions = [];
        for(let j=0; j<3; j++)
        {
            let columnText = String.fromCharCode(73 + 2*j);
            let text = sheet.getRange(columnText + i.toString()).getValue();
            if(text.length > 0)
            {
                let columnAmount = String.fromCharCode(73 + 2*j + 1);
                let description = {
                    text: text,
                    amount: parseInt(sheet.getRange(columnAmount + i.toString()).getValue())
                };
                descriptions.push(description);
            }
        }

        let boleto = {
            customerId: sheet.getRange('A' + i.toString()).getValue(),
            amount: parseInt(100*sheet.getRange('B' + i.toString()).getValue(), 10)
        };

        let dueDate = sheet.getRange('C' + i.toString()).getValue();
        if(dueDate.length > 0)
        {
            boleto["dueDate"] = formatDateToISO(dueDate);
        }
        let fine = new String(sheet.getRange('D' + i.toString()).getValue());
        if(fine.length > 0)
        {
            boleto["fine"] = parseFloat(fine);
        }
        let interest = new String(sheet.getRange('E' + i.toString()).getValue());
        if(interest.length > 0)
        {
            boleto["interest"] = parseFloat(interest);
        }
        let overdueLimit = new String(sheet.getRange('F' + i.toString()).getValue());
        if(overdueLimit.length > 0)
        {
            boleto["overdueLimit"] = parseInt(overdueLimit);
        }
        let discount = new String(sheet.getRange('G' + i.toString()).getValue());
        if(discount.length > 0)
        {
            boleto["discount"] = parseFloat(discount);
        }
        let discountDate = sheet.getRange('H' + i.toString()).getValue();
        if(discountDate.length > 0)
        {
            boleto["discountDate"] = formatDateToISO(discountDate);
        }


        if(descriptions.length > 0)
        {
            boleto["descriptions"] = descriptions;
        }
        let tags = sheet.getRange('O' + i.toString()).getValue().split(",");
        if(tags.length > 0)
        {
            boleto["tags"] = tags;
        }

        boletos.push(boleto);
    }

    let payload = {
        charges: boletos
    };

    try{
        fetch("/charge", method = 'POST', payload, null);
        Browser.msgBox("Boletos Emitidos");
    } catch(e)
    {
        let message = "Boletos não emitidos. ";
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