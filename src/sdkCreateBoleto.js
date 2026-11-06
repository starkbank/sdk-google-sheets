function createBoleto()
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Emissão de Boletos');
    let boletos = [];

    formatHeader(sheet);

    for(let row of readRows_(sheet, 22)) {

        let descriptions = [];
        for(let j=0; j<3; j++)
        {
            let columnText = String.fromCharCode(80 + 2*j);
            let text = cellOf_(row, columnText);
            if(text.length > 0)
            {
                let columnAmount = String.fromCharCode(80 + 2*j + 1);
                let description = {
                     text: removeDiacritics(text),
                     amount: parseInt(Math.round(100*cellOf_(row, columnAmount)), 10),
                };
                descriptions.push(description);
            }
        }

        let boleto = {
            amount: parseInt(Math.round(100*cellOf_(row, 'I')), 10),
            descriptions: descriptions,
        };

        let name = cellOf_(row, 'A');
        if (name.length > 0) 
        {
          boleto["name"] = removeDiacritics(name)
        }

        let taxId = cellOf_(row, 'B');
        if (taxId.length > 0) 
        {
          boleto["taxId"] = taxId
        }

        let address = cellOf_(row, 'C');
        {
          boleto["streetLine1"] = removeDiacritics(address.toLocaleLowerCase()) 
        }

        let complement = cellOf_(row, 'D');
        {
          boleto["streetLine2"] = removeDiacritics(complement.toLocaleLowerCase()) 
        }

        let district =  cellOf_(row, 'E');
        {
          boleto["district"] = district
        } 

        let city = new String(cellOf_(row, 'F'));
        {
          boleto["city"] = removeDiacritics(city.toLocaleLowerCase()) 
        }

        let stateCode = new String(cellOf_(row, 'G'));
        {
          boleto["stateCode"] = stateCode
        }

        let zipCode = new String(cellOf_(row, 'H'));
        {
          boleto["zipCode"] = zipCode
        }

        let dueDate = new String(cellOf_(row, 'J'));
        if(dueDate.length > 0)
        {
            boleto["due"] = formatToLocalDatetime(dueDate)
        }
        let fine = new String(cellOf_(row, 'K'));
        if(fine.length > 0)
        {
            boleto["fine"] = parseFloat(fine);
        }
        let interest = new String(cellOf_(row, 'L'));
        if(interest.length > 0)
        {
            boleto["interest"] = parseFloat(interest);
        }
        let overdueLimit = new String(cellOf_(row, 'M'));
        if(overdueLimit.length > 0)
        {
            boleto["overdueLimit"] = parseInt(overdueLimit);
        }

        let discount = new String(cellOf_(row, 'N'));
        let discountDate = new String(cellOf_(row, 'O'));

        if(discount.length > 0 && discountDate.length > 0)
        {
            
          boleto["discounts"] =  [{
              "percentage": parseFloat(discount),
              "date": formatToLocalDatetime(discountDate)
            }]
        }

        let tags = removeDiacritics(cellOf_(row, 'V')).split(",");
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