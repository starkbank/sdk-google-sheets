function ViewPaymentRequest(after, before, status, centerId, type) {

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Aprovações');
  let i = 10;
  let cursor = "";
  let query = {
    "centerId": centerId,
    "type": type
  };
  if (after){
    query["after"] = after;
  }
  if (before){
    query["before"] = before;
  }
  if (status){
    query["status"] = status;
  }
  
  clearSheet(sheet);
  formatHeader(sheet);
  
  let user = new getDefaultUser();
  let zeroCharges = true;
  do {
    query["cursor"] = cursor;
    json = parseResponse(fetch("/payment-request", method = 'GET', null, query));

    if (json[1] != 200) {
      Browser.msgBox(json[0]["errors"][0]["message"])
      throw new Error()
    }

    json = json[0]

    elementList = json["requests"];
    cursor = json["cursor"];

    for (let payment of elementList){
      zeroCharges = false;
      i += 1;
      let tags = payment["tags"];
      sheet.getRange('A' + i.toString()).setValue(formatToLocalDatetime(payment["created"]));
      sheet.getRange('B' + i.toString()).setValue(payment["type"]);
      sheet.getRange('C' + i.toString()).setValue(payment["description"]);
      sheet.getRange('D' + i.toString()).setValue(stringToCurrency(payment["amount"]));
      sheet.getRange('E' + i.toString()).setValue(payment["actions"][1]["name"]);
      sheet.getRange('F' + i.toString()).setValue(payment["status"]);
      sheet.getRange('G' + i.toString()).setValue(payment["id"]);
      sheet.getRange('H' + i.toString()).setValue(tags.join(","));

      if (payment["type"] == "transfer") {
        sheet.getRange('I10').setValue("Nome");
        sheet.getRange('K10').setValue("Codigo do Banco/ISPB");
        sheet.getRange('L10').setValue("Agencia");
        sheet.getRange('M10').setValue("Conta");

        sheet.getRange('I' + i.toString()).setValue(payment["payment"]["name"]);
        sheet.getRange('J' + i.toString()).setValue(payment["payment"]["taxId"]);
        sheet.getRange('K' + i.toString()).setValue(payment["payment"]["bankCode"]);
        sheet.getRange('L' + i.toString()).setValue(payment["payment"]["branchCode"]);
        sheet.getRange('M' + i.toString()).setValue(payment["payment"]["accountNumber"]);
      }

      if (payment["type"] == "boleto-payment") {
        sheet.getRange('I10').setValue("Linha Digitavel / Código de Barras");
        sheet.getRange('K10').setValue("");
        sheet.getRange('L10').setValue("");
        sheet.getRange('M10').setValue("");

        sheet.getRange('J' + i.toString()).setValue(payment["payment"]["taxId"]);

        if (payment["payment"]["line"] != null){
          sheet.getRange('I' + i.toString()).setValue(payment["payment"]["line"]); 
        }

        if (payment["payment"]["barCode"] != null){
          sheet.getRange('I' + i.toString()).setValue(payment["payment"]["barCode"]);
        }
      }

      if (payment["type"] == "darf-payment") {
        sheet.getRange('I10').setValue("Linha Digitavel / Código de Barras");
        sheet.getRange('K10').setValue("");
        sheet.getRange('L10').setValue("");
        sheet.getRange('M10').setValue("");

        sheet.getRange('J' + i.toString()).setValue(payment["payment"]["taxId"]);

        if (payment["payment"]["line"] != null){
          sheet.getRange('I' + i.toString()).setValue(payment["payment"]["line"]); 
        }

        if (payment["payment"]["barCode"] != null){
          sheet.getRange('I' + i.toString()).setValue(payment["payment"]["barCode"]);
        }
      }

      if (payment["type"] == "utility-payment") {
        sheet.getRange('I10').setValue("Linha Digitavel / Código de Barras");
        sheet.getRange('K10').setValue("");
        sheet.getRange('L10').setValue("");
        sheet.getRange('M10').setValue("");

        if (payment["payment"]["line"] != null){
          sheet.getRange('I' + i.toString()).setValue(payment["payment"]["line"]); 
        }

        if (payment["payment"]["barCode"] != null){
          sheet.getRange('I' + i.toString()).setValue(payment["payment"]["barCode"]);
        }

      }

      if (payment["type"] == "tax-payment") {
        sheet.getRange('I10').setValue("Linha Digitavel / Código de Barras");
        sheet.getRange('K10').setValue("");
        sheet.getRange('L10').setValue("");
        sheet.getRange('M10').setValue("");

        if (payment["payment"]["line"] != null){
          sheet.getRange('I' + i.toString()).setValue(payment["payment"]["line"]); 
        }

        if (payment["payment"]["barCode"] != null){
          sheet.getRange('I' + i.toString()).setValue(payment["payment"]["barCode"]);
        }
        
      }

      if (payment["type"] == "brcode-payment") {
        sheet.getRange('I10').setValue("Linha Digitavel / Código de Barras");
        sheet.getRange('K10').setValue("");
        sheet.getRange('L10').setValue("");
        sheet.getRange('M10').setValue("");

        if (payment["payment"]["line"] != null){
          sheet.getRange('I' + i.toString()).setValue(payment["payment"]["line"]); 
        }

        if (payment["payment"]["barCode"] != null){
          sheet.getRange('I' + i.toString()).setValue(payment["payment"]["barCode"]);
        }
        
      }


    }
  } while (cursor);
  if (zeroCharges) {
    Browser.msgBox("Nenhum pagamento encontrado para o período selecionado!");
  }
}

function selectPaymentRequestDialog() {
    var html = HtmlService.createHtmlOutputFromFile('FormPaymentRequest')
  .setHeight(450)
  .setWidth(450);
    SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
    .showModalDialog(html, 'Consultar Aprovações');
}