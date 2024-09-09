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

    for(let i=11; i<=sheet.getLastRow(); i++) {
        sheet.getRange(`F${i}`).setValue("Não enviado.");
        let boleto = {
          centerId: centerId,
          type: "boleto-payment"
        }

        let paymentItem  = {
            taxId: sheet.getRange('B' + i.toString()).getValue()
        };

        if (sheet.getRange('D' + i.toString()).getValue().length > 1) {
          paymentItem["description"] = removeDiacritics(sheet.getRange('D' + i.toString()).getValue())
        }

        if (sheet.getRange('E' + i.toString()).getValue().length > 1) {
          paymentItem["tags"] = removeDiacritics(sheet.getRange('E' + i.toString()).getValue().split(","))
        }

        if (sheet.getRange('C' + i.toString()).getValue().length > 1) {
          boleto["due"] = formatToLocalDatetime(sheet.getRange('C' + i.toString()).getValue())
        }

        let barCodeOrLine = sheet.getRange('A' + i.toString()).getValue();
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

        if(linesList.includes(barCodeOrLine)) {
          duplicatedPayments +=1;
          sheet.getRange(`G${i}`).setValue("Pagamento duplicado");
        }
        if(barCodeOrLine == "" || paymentItem["description"] == "" || paymentItem["description"] == undefined) {
          emptyLines +=1;
          sheet.getRange(`G${i}`).setValue("pagamento incompleto");
        }
        linesList.push(barCodeOrLine)
        payments.push(boleto);
    }

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
  var html = HtmlService.createHtmlOutputFromFile('FormPayBoleto');
  SpreadsheetApp.getUi()
  .showModalDialog(html, 'Pagamento de Boletos');
}
