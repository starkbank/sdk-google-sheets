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
      throw JSON.stringify({"message": json[0]["errors"][0]["message"]})
    }
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

    let rows = [];
    for (let invoice of elementList){

      zeroCharges = false;
      let pdfLink = '=HYPERLINK("'+ formulaText(invoice["pdf"]) +'", "PDF")';
      // R, S and T show the first three splits.
      let splitAmounts = invoice["splits"].slice(0, 3).map(split => stringToCurrency(split["amount"].toString()));
      rows.push([
        formatToLocalDatetime(invoice["created"]),
        invoice["name"],
        invoice["taxId"],
        InvoiceStatusEnToPt(invoice["status"]),
        stringToCurrency(invoice["amount"]),
        stringToCurrency(invoice["nominalAmount"]),
        invoice["discountAmount"] ? stringToCurrency(invoice["discountAmount"]) : null,
        stringToCurrency(invoice["fineAmount"]),
        stringToCurrency(invoice["interestAmount"]),
        formatToLocalDatetime(invoice["due"]),
        invoice["expiration"],
        invoice["brcode"],
        invoice["id"],
        stringToCurrency(invoice["fee"]),
        invoice["tags"].join(","),
        new LinkFormula(pdfLink),
        splitAmounts.length > 0 ? "SIM" : "NÃO",
      ].concat(splitAmounts));

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
    writeRows_(sheet, i + 1, 1, rows);
    i += rows.length;
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
  let html = HtmlService.createTemplateFromFile('FormViewInvoices').evaluate();
  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
  .showModalDialog(html, 'Invoices Emitidas');
}