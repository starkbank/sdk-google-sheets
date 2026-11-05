function executeBoletoPayment(centerId)
{
    withSendingLock_(() => sendBoletoPaymentRequests_(centerId));
}

function sendBoletoPaymentRequests_(centerId)
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pagamento de Boletos');
    let user = new getDefaultUser();
    formatHeader(sheet);
    clearCollumns(sheet, 6, 7);
    let externalOrdersList = paymentRequestManager().boleto;
    let extOrderListLen = externalOrdersList.length;
    let ordersList = createPaymentRequestArrayBoleto(centerId, sheet, externalOrdersList);
    let batchSize = 100;
    let failedBatchs = 0;
    let uncertainBatchs = 0;
    let returnMessage = "";
    let query = {}
    const statusColumns = {first: 6, notSent: "Não enviado."};

    if(ordersList == null) {
      return
    }

    let batchCount = Math.ceil(ordersList.length/batchSize);
    for (let batch = 0; batch < batchCount; batch++) {
      let ordersBatch = ordersList.slice((batch * batchSize), (batch * batchSize) + batchSize);
      let firstLine = 11 + batch * batchSize;
      let request = sendPaymentRequestBatch(ordersBatch, query);
      let checkIds = externalOrdersList.slice(extOrderListLen + (batch * batchSize), (extOrderListLen + (batch * batchSize) + batchSize));

      if (request["outcome"] == "sent") {
          confirmOrders(sheet, firstLine, ordersBatch.length, statusColumns);
          updatePaymentRequestManager(checkIds, "boleto")
          continue;
      }
      if (request["outcome"] == "rejected") {
          failedBatchs += 1;
          returnMessage = returnMessage + failOrders(sheet, firstLine, ordersBatch.length, request["errors"], statusColumns);
          continue;
      }
      uncertainBatchs += 1;
      markUncertainOrders_(sheet, firstLine, ordersBatch.length, statusColumns);
  }
  sendOutcomeMessage_(batchCount, failedBatchs, uncertainBatchs, returnMessage);
}

function createPaymentRequestArrayBoleto(centerId, sheet, linesList)
{
    let payments = [];
    let duplicatedPayments = 0;
    let emptyLines = 0;
    // The lines sent before and the ones of the rows above, for a membership check per row.
    let seenLines = new Set(linesList);
    let statuses = [];

    for(let row of readRows_(sheet, 5)) {
        statuses.push(["Não enviado.", null]);
        let boleto = {
          centerId: centerId,
          type: "boleto-payment"
        }

        let paymentItem  = {
            taxId: cellOf_(row, 'B')
        };

        let description = removeDiacritics(cellOf_(row, 'D'));
        if (description.length > 1) {
          paymentItem["description"] = description
        }

        let tags = removeDiacritics(cellOf_(row, 'E'));
        if (tags.length > 1) {
          paymentItem["tags"] = tags.split(",")
        }

        // A date cell (a Date) or a date typed as text.
        let due = cellOf_(row, 'C');
        if (due !== "") {
          boleto["due"] = formatToLocalDatetime(due)
        }

        let barCodeOrLine = String(cellOf_(row, 'A'));
        barCodeOrLine = barCodeOrLine.replace(/[^0-9]/g, '');
        if(barCodeOrLine.length > 44)
        {
            paymentItem["line"] = barCodeOrLine;
        }
        else
        {
            paymentItem["barCode"] = barCodeOrLine;
        }

        boleto["payment"] = paymentItem

        if(seenLines.has(barCodeOrLine)) {
          duplicatedPayments +=1;
          statuses[statuses.length - 1][1] = "Pagamento duplicado";
        }
        if(barCodeOrLine == "" || paymentItem["description"] == "" || paymentItem["description"] == undefined) {
          emptyLines +=1;
          statuses[statuses.length - 1][1] = "pagamento incompleto";
        }
        linesList.push(barCodeOrLine)
        seenLines.add(barCodeOrLine)
        payments.push(boleto);
    }
    writeRows_(sheet, 11, 6, statuses);

    if(duplicatedPayments>0 && emptyLines>0) {
      sendMessage("Existem pagamentos duplicados e linhas incompletas, verifique os pagamentos e tente novamente.");
      return null
    }
    if(duplicatedPayments>0) {
      sendMessage("Você está enviando pagamentos duplicados, remova as duplicadas e tente novamente.");
      return null
    }
    if(emptyLines>0) {
      sendMessage("Você está enviando linhas em branco, preencha os campos e tente novamente.");
      return null
    }
    return payments
}

function payBoletosDialog() {
  var html = HtmlService.createTemplateFromFile('FormPayBoleto').evaluate();
  SpreadsheetApp.getUi()
  .showModalDialog(html, 'Pagamento de Boletos');
}
