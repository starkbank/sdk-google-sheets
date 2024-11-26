function createBoleto()
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Emissão de Boletos');
    let boletos = [];

    formatHeader(sheet);

    for(let i=11; i<=sheet.getLastRow(); i++) {

        let descriptions = [];
        for(let j=0; j<3; j++)
        {
            let columnText = String.fromCharCode(80 + 2*j);
            let text = sheet.getRange(columnText + i.toString()).getValue();
            if(text.length > 0)
            {
                let columnAmount = String.fromCharCode(80 + 2*j + 1);
                let description = {
                     text: removeDiacritics(text),
                     amount: parseInt(Math.round(100*sheet.getRange(columnAmount + i.toString()).getValue()), 10),
                };
                descriptions.push(description);
            }
        }

        let boleto = {
            amount: parseInt(Math.round(100*sheet.getRange('I' + i.toString()).getValue()), 10),
            descriptions: descriptions,
        };

        let name = sheet.getRange('A' + i.toString()).getValue();
        if (name.length > 0) 
        {
          boleto["name"] = removeDiacritics(name)
        }

        let taxId = sheet.getRange('B' + i.toString()).getValue();
        if (taxId.length > 0) 
        {
          boleto["taxId"] = taxId
        }

        let address = sheet.getRange('C' + i.toString()).getValue();
        {
          boleto["streetLine1"] = removeDiacritics(address.toLocaleLowerCase()) 
        }

        let complement = sheet.getRange('D' + i.toString()).getValue();
        {
          boleto["streetLine2"] = removeDiacritics(complement.toLocaleLowerCase()) 
        }

        let district =  sheet.getRange('E' + i.toString()).getValue();
        {
          boleto["district"] = district
        } 

        let city = new String(sheet.getRange('F' + i.toString()).getValue());
        {
          boleto["city"] = removeDiacritics(city.toLocaleLowerCase()) 
        }

        let stateCode = new String(sheet.getRange('G' + i.toString()).getValue());
        {
          boleto["stateCode"] = stateCode
        }

        let zipCode = new String(sheet.getRange('H' + i.toString()).getValue());
        {
          boleto["zipCode"] = zipCode
        }

        let dueDate = new String(sheet.getRange('J' + i.toString()).getValue());
        if(dueDate.length > 0)
        {
            boleto["due"] = formatToLocalDatetime(dueDate)
        }
        let fine = new String(sheet.getRange('K' + i.toString()).getValue());
        if(fine.length > 0)
        {
            boleto["fine"] = parseFloat(fine);
        }
        let interest = new String(sheet.getRange('L' + i.toString()).getValue());
        if(interest.length > 0)
        {
            boleto["interest"] = parseFloat(interest);
        }
        let overdueLimit = new String(sheet.getRange('M' + i.toString()).getValue());
        if(overdueLimit.length > 0)
        {
            boleto["overdueLimit"] = parseInt(overdueLimit);
        }

        let discount = new String(sheet.getRange('N' + i.toString()).getValue());
        let discountDate = new String(sheet.getRange('O' + i.toString()).getValue());

        if(discount.length > 0 && discountDate.length > 0)
        {
            
          boleto["discounts"] =  [{
              "percentage": parseFloat(discount),
              "date": formatToLocalDatetime(discountDate)
            }]
        }

        let tags = removeDiacritics(sheet.getRange('V' + i.toString()).getValue()).split(",");
        if(tags.length > 0)
        {
            boleto["tags"] = tags;
        }

        boletos.push(boleto);
    }

    let payload = {
      boletos: boletos
    }
    let e = fetch("/boleto", method = 'POST', payload, null, 'v2');
    if (parseResponse(e)[1] == 200)
    {
        Browser.msgBox("Boletos Emitidos");
    } else
    {
        let message = "Boletos não emitidos. ";
        let parsed = parseResponse(e)[0];

        if("errors" in parsed)
        {
            for(let suberror of parsed["errors"])
            {
                message += "\\n" + suberror["message"];
            }
        }
        Browser.msgBox(message);
    }
}