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
      throw new Error(json[0]["errors"][0]["message"])
    }

    json = json[0]

    elementList = json["requests"];
    cursor = json["cursor"];

    let rows = [];
    let header = null;
    for (let payment of elementList){
      zeroCharges = false;
      let row = [
        formatToLocalDatetime(payment["created"]),
        payment["type"],
        payment["description"],
        stringToCurrency(payment["amount"]),
        payment["actions"][1]["name"],
        payment["status"],
        payment["id"],
        payment["tags"].join(","),
      ];
      rows.push(row);
      let columns = paymentRequestColumns_(payment);
      if (!columns) {
        continue;
      }
      header = columns.header;
      row.push(...columns.values);
    }
    // I10 and K10:M10 name the columns of the last row that has them (J10 keeps its label).
    if (header) {
      writeRows_(sheet, 10, 9, [[header[0]]]);
      writeRows_(sheet, 10, 11, [header.slice(1)]);
    }
    writeRows_(sheet, i + 1, 1, rows);
    i += rows.length;
  } while (cursor);
  if (zeroCharges) {
    Browser.msgBox("Nenhum pagamento encontrado para o período selecionado!");
  }
}

// Columns I to M of a payment request and the header they go under, by type of payment.
function paymentRequestColumns_(request) {
  let payment = request["payment"];
  if (request["type"] == "transfer") {
    return {
      header: ["Nome", "Codigo do Banco/ISPB", "Agencia", "Conta"],
      values: [payment["name"], payment["taxId"], payment["bankCode"], payment["branchCode"], payment["accountNumber"]],
    };
  }
  if (!["boleto-payment", "darf-payment", "utility-payment", "tax-payment", "brcode-payment"].includes(request["type"])) {
    return null;
  }
  // The bar code wins over the line when both come.
  let line = payment["barCode"] != null ? payment["barCode"] : payment["line"];
  let taxId = ["boleto-payment", "darf-payment"].includes(request["type"]) ? payment["taxId"] : null;
  return {
    header: ["Linha Digitavel / Código de Barras", "", "", ""],
    values: [line, taxId],
  };
}

function selectPaymentRequestDialog() {
    var html = HtmlService.createTemplateFromFile('FormPaymentRequest').evaluate()
  .setHeight(450)
  .setWidth(450);
    SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
    .showModalDialog(html, 'Consultar Aprovações');
}