function cartShop() {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Solicitação de Cartões');

  var orders = [];
  var orderNumbers = [];

  let line = 10;
  let query = {};
  let errorMessages = "";

  const initialLine = 11;
  const batchSize = 100;

  if (sheet.getLastRow() - initialLine > 1000) {
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

  for (let batchInitialLine = initialLine; batchInitialLine <= sheet.getLastRow(); batchInitialLine = line) {
    orders = [];
    orderNumbers = [];
    for (line = batchInitialLine; line < batchInitialLine + batchSize && line <= sheet.getLastRow(); line++) {
      var cartId = id;
      var kitId = kitSelector[sheet.getRange('A' + line.toString()).getValue()];
      var displayName2 = removeDiacritics(sheet.getRange('B' + line.toString()).getValue().toString());
      var holderName = removeDiacritics(sheet.getRange('C' + line.toString()).getValue().toString());
      var displayName1 = removeDiacritics(sheet.getRange('D' + line.toString()).getValue().toString());
      var shippingPhone = removeDiacritics(sheet.getRange('E' + line.toString()).getValue().toString().replace(/\u202C/g, ''));
      var shippingStreetLine1 = removeDiacritics(sheet.getRange('F' + line.toString()).getValue().toString());
      var shippingStreetLine2 = removeDiacritics(sheet.getRange('G' + line.toString()).getValue().toString());
      var shippingDistrict = removeDiacritics(sheet.getRange('H' + line.toString()).getValue().toString());
      var shippingCity = removeDiacritics(sheet.getRange('I' + line.toString()).getValue().toString());
      var shippingStateCode = sheet.getRange('J' + line.toString()).getValue().toString().trim().toUpperCase();
      var shippingZipCode = sheet.getRange('K' + line.toString()).getValue().toString();
      var shippingCountryCode = "BRA";

      let hasError = false;

      if (removeDiacritics(sheet.getRange('A' + line.toString()).getValue().toString()) == "") {
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
  sheet.getRange('C6').setValue(cartId);
  var html = HtmlService.createHtmlOutputFromFile('FormRedirect').setWidth(300).setHeight(120);
  SpreadsheetApp.getUi().showModalDialog(html, 'Cartões Enviados');
}

function corporateCardKits(kitList) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('corporateShopKits');
  var range = sheet.getRange(1, 5, sheet.getMaxRows());
  range.clear();
  let i = 10;
  for (let item of kitList) {
    sheet.getRange('E' + i.toString()).setValue(item["name"].toString());
    i++
  }
}

function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var editedCell = range.getA1Notation();

  if ("Solicitação de Cartões" == SpreadsheetApp.getActiveSheet().getSheetName() && editedCell.substring(1, 3) == "11") {
    sheet.getRange(editedCell).setFontColor("black");
    sheet.getRange(editedCell).setValue(sheet.getRange(editedCell).getValue());

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

function redirect() {
  let user = new getDefaultUser();
  var ws = user.workspace.toLowerCase();
  var env = user.environment.toLowerCase();
  var cartId = user.cartId.toLowerCase();
  var novaURL = "https://" + ws + ".starkbank.com/cart/" + cartId;

  if (env != "production") {
    var novaURL = "https://" + ws + "." + env + ".starkbank.com/cart/" + cartId;
  }
  return novaURL
}