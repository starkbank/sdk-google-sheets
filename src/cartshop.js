function cartShop() {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Solicitação de Cartões');

  var orders = [];
  var orderNumbers = [];

  let line = 10;
  let query = {};
  let errorMessages = "";

  const initialLine = 11;
  const batchSize = 100;
  const rows = readRows_(sheet, 11);
  const lastLine = initialLine + rows.length - 1;

  if (lastLine - initialLine > 1000) {
    Browser.msgBox("Quantidade limite de items no carrinho excedida, faça um carrinho com menos de 1000 itens.");
    throw new Error()
  }

  var responseApi = parseResponse(fetch("/corporate-shop-cart", method = 'POST', {}));
  var kitIdObjects = parseResponse(fetch("/corporate-shop-kit?status=active", method = 'GET'))[0]["kits"];

  corporateCardKits(kitIdObjects);

  let kitSelector = {};

  for (let item of kitIdObjects) {
    kitSelector[item["name"]] = item["id"]
  };

  if (responseApi[1] != 200) {
    Browser.msgBox(responseApi[0]["errors"][0]["message"]);
    throw new Error()
  }

  var fetchedJson = responseApi[0];

  var id = fetchedJson["cart"]["id"];

  for (let batchInitialLine = initialLine; batchInitialLine <= lastLine; batchInitialLine = line) {
    orders = [];
    orderNumbers = [];
    for (line = batchInitialLine; line < batchInitialLine + batchSize && line <= lastLine; line++) {
      let row = rows[line - initialLine];
      var cartId = id;
      var kitId = kitSelector[cellOf_(row, 'A')];
      var displayName2 = removeDiacritics(cellOf_(row, 'B').toString());
      var holderName = removeDiacritics(cellOf_(row, 'C').toString());
      var displayName1 = removeDiacritics(cellOf_(row, 'D').toString());
      var shippingPhone = removeDiacritics(cellOf_(row, 'E').toString().replace(/\u202C/g, ''));
      var shippingStreetLine1 = removeDiacritics(cellOf_(row, 'F').toString());
      var shippingStreetLine2 = removeDiacritics(cellOf_(row, 'G').toString());
      var shippingDistrict = removeDiacritics(cellOf_(row, 'H').toString());
      var shippingCity = removeDiacritics(cellOf_(row, 'I').toString());
      var shippingStateCode = cellOf_(row, 'J').toString().trim().toUpperCase();
      var shippingZipCode = cellOf_(row, 'K').toString();
      var shippingCountryCode = "BRA";

      let hasError = false;

      if (removeDiacritics(cellOf_(row, 'A').toString()) == "") {
        hasError = true;
      };

      if (displayName1 == "") {
        hasError = true;
      };

      if (displayName2 == "") {
        hasError = true;
      };

      if (shippingPhone == "") {
        hasError = true;
      };

      if (shippingDistrict == "") {
        hasError = true;
      };

      if (shippingStateCode == "") {
        hasError = true;
      };

      if (shippingZipCode == "") {
        hasError = true;
      };

      if (shippingPhone == "") {
        hasError = true;
      };

      if (hasError == true) {
        Browser.msgBox("Por favor, preencha todos os campos")
        return
      };

      if (shippingZipCode.trim()[5] != "-") {
        shippingZipCode = shippingZipCode.trim().substring(0, 5) + "-" + shippingZipCode.substring(5, 8);
      };

      if (shippingStreetLine1 != "") {
        shippingStreetLine1 = shippingStreetLine1[0].toUpperCase() + shippingStreetLine1.substring(1);
      };

      var item = {
        "kitId": kitId,
        "cartId": cartId,
        "displayName1": displayName1,
        "displayName2": displayName2,
        "holderName": holderName,
        "shippingStreetLine1": shippingStreetLine1,
        "shippingStreetLine2": shippingStreetLine2,
        "shippingDistrict": shippingDistrict,
        "shippingCity": shippingCity,
        "shippingStateCode": shippingStateCode,
        "shippingZipCode": shippingZipCode,
        "shippingCountryCode": shippingCountryCode,
        "shippingPhone": "+55" + shippingPhone
      };

      orderNumbers.push(line);
      orders.push(item);
    };

    if (orderNumbers.length > 0) {
      let payload = { items: orders };
      let responseApi = fetch("/corporate-shop-item", method = 'POST', payload, query);
      if (parseResponse(responseApi)[1] != 200) {
        Browser.msgBox(parseResponse(responseApi)[0]["errors"][0]["message"]);
        throw new Error();
      };

      let [json, status] = parseResponse(responseApi);

      switch (status) {
        case 500:
          throw new Error(JSON.parse(json)["errors"]["message"]);
        case 400:
          let errors = Array.from(json["errors"]);
          errors.forEach(error => {
            if (error.code == "invalidCredentials") {
              sendMessage("Sessão expirada! \nFaça o login novamente");
              return;
            };
            let errorMessage = error.message;
            let message = errorMessage + "\n";

            if (/Element [0-9]*:/.test(errorMessage)) {
              let requestNumber = errorMessage.split('Element ').pop().split(':')[0];
              let lineNumber = parseInt(requestNumber) + batchInitialLine;
              message = "Erro - Linha " + lineNumber + ":" + errorMessage.split(':')[1] + "\n";
            };
            errorMessages = errorMessages.concat(message);
          })
      }
    }
  }

  sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
  sheet.getRange('C6').setValue(safeText(cartId));
  var html = HtmlService.createTemplateFromFile('FormRedirect').evaluate().setWidth(300).setHeight(120);
  SpreadsheetApp.getUi().showModalDialog(html, 'Cartões Enviados');
}

function corporateCardKits(kitList) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('corporateShopKits');
  var range = sheet.getRange(1, 5, sheet.getMaxRows());
  range.clear();
  writeRows_(sheet, 10, 5, kitList.map(item => [item["name"].toString()]));
}

function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var editedCell = range.getA1Notation();

  if ("Solicitação de Cartões" == SpreadsheetApp.getActiveSheet().getSheetName() && editedCell.substring(1, 3) == "11") {
    sheet.getRange(editedCell).setFontColor("black");
    sheet.getRange(editedCell).setValue(safeText(sheet.getRange(editedCell).getValue()));

    if (removeDiacritics(sheet.getRange("B11").getValue()) == "") {
      sheet.getRange("B11").setFontColor("grey");
      sheet.getRange("B11").setValue("Ex: StarkBank");
    }

    if (removeDiacritics(sheet.getRange("E11").getValue()) == "") {
      sheet.getRange("E11").setFontColor("grey");
      sheet.getRange("E11").setValue("Ex: (11) 99999-9999");
    }

    if (removeDiacritics(sheet.getRange("K11").getValue()) == "") {
      sheet.getRange("K11").setFontColor("grey");
      sheet.getRange("K11").setValue("Ex: 20018-183");
    }

  }
}

// The link is opened in the browser by the dialog, and the cart id is kept in a cell that anyone who
// edits the sheet can change: only what workspaces, environments and cart ids are made of is used.
function redirect() {
  let user = new getDefaultUser();
  var ws = user.workspace.toLowerCase();
  var env = user.environment.toLowerCase();
  var cartId = String(user.cartId).toLowerCase();
  // The environments are the ones of getHostname().
  if (!/^[a-z0-9_-]+$/.test(ws) || !["production", "sandbox", "development"].includes(env) || !/^[a-z0-9_-]*$/.test(cartId)) {
    throw JSON.stringify({"message": "Não foi possível abrir o carrinho: workspace, ambiente ou carrinho inválidos."});
  }
  var novaURL = "https://" + ws + ".starkbank.com/cart/" + cartId;

  if (env != "production") {
    var novaURL = "https://" + ws + "." + env + ".starkbank.com/cart/" + cartId;
  }
  return novaURL
}