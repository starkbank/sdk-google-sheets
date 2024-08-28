function ViewInvoice(after, before, status) {

  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Invoices Emitidas');
  let i = 10;
  let cursor = "";
  let query = {};
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
  let hostname = getHostname(user.environment.toLowerCase(), "v2");
  let zeroCharges = true;
  do {
    query["cursor"] = cursor;
    json = parseResponse(fetch("/invoice", method = 'GET', null, query));

    if (json[1] != 200) {
      throw new Error(json[0]["errors"][0]["message"])
    }
    console.log(json)
    json = json[0]

    elementList = json["invoices"];
    cursor = json["cursor"];

    // var invoiceListString1 = "";
    // var invoiceListString2 = "";
    // var splitByInvoice = {}

    // var num = 0;

    // for (let split of elementList) {
    //   num += 1
    //   if (num <= 50) {
    //     invoiceListString1 += "invoice/" + split["id"] + ","
    //   }
    //   if (num > 50) {
    //     invoiceListString2 += "invoice/" + split["id"] + ","
    //   }
    // }

    // var queryParams = {
    //   "tags": invoiceListString1
    // }

    // json = parseResponse(fetch("/split", method = 'GET', null, queryParams));

    // if (json[1] != 200) {
    //   Browser.msgBox(json[0]["errors"][0]["message"])
    //   throw new Error()
    // }

    // var splits = json[0]["splits"]

    // var queryParams = {
    //   "tags": invoiceListString2
    // }

    // json = parseResponse(fetch("/split", method = 'GET', null, queryParams));

    // if (json[1] != 200) {
    //   Browser.msgBox(json[0]["errors"][0]["message"])
    //   throw new Error()
    // }

    // splits.concat(json[0]["splits"])

    // for (split of splits){
    //   try {
    //     splitByInvoice[split["source"].substring(8, 24)].push(split["amount"])
    //   } catch {
    //     splitByInvoice[split["source"].substring(8, 24)] = [split["amount"]]
    //   }
    // }

    for (let invoice of elementList){

      zeroCharges = false;
      i += 1;
      let pdfLink = '=HYPERLINK("'+ invoice["pdf"] +'", "PDF")';
      let tags = invoice["tags"];
      sheet.getRange('A' + i.toString()).setValue(formatToLocalDatetime(invoice["created"]));
      sheet.getRange('B' + i.toString()).setValue(invoice["name"]);
      sheet.getRange('C' + i.toString()).setValue(invoice["taxId"]);
      sheet.getRange('D' + i.toString()).setValue(InvoiceStatusEnToPt(invoice["status"]));
      sheet.getRange('E' + i.toString()).setValue(stringToCurrency(invoice["amount"]));
      sheet.getRange('F' + i.toString()).setValue(stringToCurrency(invoice["nominalAmount"]));
      if (invoice["discountAmount"]) {
        sheet.getRange('G' + i.toString()).setValue(stringToCurrency(invoice["discountAmount"]));
      }
      sheet.getRange('H' + i.toString()).setValue(stringToCurrency(invoice["fineAmount"]));
      sheet.getRange('I' + i.toString()).setValue(stringToCurrency(invoice["interestAmount"]));
      sheet.getRange('J' + i.toString()).setValue(formatToLocalDatetime(invoice["due"]));
      sheet.getRange('K' + i.toString()).setValue(invoice["expiration"]);
      sheet.getRange('L' + i.toString()).setValue(invoice["brcode"]);
      sheet.getRange('M' + i.toString()).setValue(invoice["id"]);
      sheet.getRange('N' + i.toString()).setValue(stringToCurrency(invoice["fee"]));
      sheet.getRange('O' + i.toString()).setValue(tags.join(","));
      sheet.getRange('P' + i.toString()).setValue(pdfLink);

      sheet.getRange('Q' + i.toString()).setValue("NÃO");

      if (invoice["splits"].length > 0) {
        sheet.getRange('Q' + i.toString()).setValue("SIM")
        for (let split = 0; split <= 3; split++) {
          const column = ["R", "S", "T"];
          try {
            console.log(invoice["splits"][split]["amount"])
            sheet.getRange(column[split] + i.toString()).setValue(stringToCurrency(invoice["splits"][split]["amount"].toString()));
          } catch {
            break
          }
        }
      }

      // if (splitByInvoice[invoice["id"]]){
      //   if (splitByInvoice[invoice["id"]].length >= 1){

      //     sheet.getRange('R' + i.toString()).setValue(stringToCurrency(splitByInvoice[invoice["id"]][0]));

      //     sheet.getRange('Q' + i.toString()).setValue("SIM");

      //   }

      //   if (splitByInvoice[invoice["id"]].length >= 2) {
          
      //     sheet.getRange('S' + i.toString()).setValue(stringToCurrency(splitByInvoice[invoice["id"]][1]));

      //   }

      //   if (splitByInvoice[invoice["id"]].length > 2) {
          
      //     sheet.getRange('S' + i.toString()).setValue(stringToCurrency(splitByInvoice[invoice["id"]][2]));
          
      //   }
      // }
    }
  } while (cursor);
  if (zeroCharges) {
    Browser.msgBox("Nenhuma Invoice encontrada para o período selecionado!");
  }
}

function InvoiceStatusEnToPt(status){
  switch (status){
    case "paid":
      return "pago";
    case "created":
      return "criado";
    case "voided":
      return "revertido";
    case "overdue":
      return "vencido";
    case "canceled":
      return "cancelado";
    case "expired":
      return "expirado";
    case "unknown":
      return "desconhecido";
    default:
      return "outro";
  }
}

function selectViewInvoiceDialog() {
  let html = HtmlService.createHtmlOutputFromFile('FormViewInvoices');
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Invoices Emitidas');
}