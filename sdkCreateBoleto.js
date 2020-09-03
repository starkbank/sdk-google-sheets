
function createBoleto()
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Emissão de Boletos');
    let boletos = [];

    formatHeader(sheet);

    for(let i=11; i<=sheet.getLastRow(); i++) {

        let descriptions = [];
        for(let j=0; j<3; j++)
        {
            let column = String.fromCharCode(73 + j);
            let text = sheet.getRange(column + i.toString()).getValue();
            if(text.lenght > 0)
            {
                let description = {
                    text: text,
                    amount: parseInt(sheet.getRange(column + i.toString()).getValue())
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
        let fine = sheet.getRange('D' + i.toString()).getValue();
        if(fine.length > 0)
        {
            boleto["fine"] = parseFloat(fine);
        }
        let interest = sheet.getRange('E' + i.toString()).getValue();
        if(interest.length > 0)
        {
            boleto["interest"] = parseFloat(interest);
        }
        let overdueLimit = sheet.getRange('F' + i.toString()).getValue();
        if(overdueLimit.length > 0)
        {
            boleto["overdueLimit"] = parseInt(overdueLimit);
        }
        let discount = sheet.getRange('G' + i.toString()).getValue();
        if(discount.length > 0)
        {
            boleto["dicount"] = parseFloat(discount);
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
        if(tags.lenght > 0)
        {
            boleto["tags"] = tags;
        }

        boletos.push(boleto);
    }

    let payload = {
        charges: boletos
    };
    
    Browser.msgBox(JSON.stringify(payload));
    //throw new Error(payload);

    //json = JSON.parse(fetch("/charge", method = 'POST', payload, null).content);
}