function executeBoletoPayment(centerId)
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
    let returnMessage = "";
    let query = {}

    if(ordersList == null) {
      return
    }

    for (let batch = 0; batch<Math.ceil(ordersList.length/batchSize); batch++) {
      let ordersBatch = ordersList.slice((batch * batchSize), (batch * batchSize) + batchSize);
      let request = sendPaymentRequestBatch(ordersBatch, query);
      let checkIds = externalOrdersList.slice(extOrderListLen + (batch * batchSize), (extOrderListLen + (batch * batchSize) + batchSize));

      switch (request["status"]) {
          case 200:
              confirmOrders(sheet, batch, ordersBatch.length, batchSize, "F");
              updatePaymentRequestManager(checkIds, "boleto")
              break;
          case 400:
              failedBatchs += 1;
              returnMessage = returnMessage + failOrders(sheet, batch, batchSize, Array.from(request["content"]["errors"]), "F", "G");
              break;
      }
  }
  if(failedBatchs == 0) {
    sendMessage("Todos os itens foram enviados.");
    return
  }
  if(failedBatchs < ordersList.length/batchSize) {
      sendMessage("Falha no envio de alguns itens, verifique a situação de suas solicitações." + "\n\n" + returnMessage);
      return
  }
  if(failedBatchs == ordersList.length/batchSize) {
    sendMessage("Falha no envio, verifique a situação de suas solicitações." + "/n/n" + returnMessage);
    return
  }
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

        if (cellOf_(row, 'D').length > 1) {
          paymentItem["description"] = removeDiacritics(cellOf_(row, 'D'))
        }

        if (cellOf_(row, 'E').length > 1) {
          paymentItem["tags"] = removeDiacritics(cellOf_(row, 'E').split(","))
        }

        if (cellOf_(row, 'C').length > 1) {
          boleto["due"] = formatToLocalDatetime(cellOf_(row, 'C'))
        }

        let barCodeOrLine = cellOf_(row, 'A');
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
