function createPaymentRequestArray(centerId, sheet, externalOrdersList) {
    let requestsList = [];
    let request = {};
    let payment = {};
    let initialLine = 11;
    let duplicatedPayments = 0;
    let emptyLines = 0;

    clearCollumns(sheet, 11, 12);
    for (let line = initialLine; line <= sheet.getLastRow(); line++) {
        let customerName = removeDiacritics(sheet.getRange('A' + line.toString()).getValue());
        let taxId = removeDiacritics(sheet.getRange('B' + line.toString()).getValue());
        let amount = parseInt(Math.round(100 * sheet.getRange('C' + line.toString()).getValue()), 10);
        let bankCode = removeDiacritics((sheet.getRange('D' + line.toString()).getValue()).toString());
        let branchCode = removeDiacritics(sheet.getRange('E' + line.toString()).getValue());
        let accountNumber = removeDiacritics(sheet.getRange('F' + line.toString()).getValue());
        let schedule = sheet.getRange('G' + line.toString()).getValue();
        
        let externalId = calculateExternalId(amount, customerName, taxId, bankCode, branchCode, accountNumber);
        sheet.getRange(`K${line}`).setValue("Não enviado");

        if(externalOrdersList.includes(externalId)) {
            duplicatedPayments +=1;
            sheet.getRange(`L${line}`).setValue("Pagamento duplicado");
            externalOrdersList.push(externalId);
        }

        if(!externalOrdersList.includes(externalId)) {
            payment = {
                name: customerName,
                taxId: taxId,
                amount: amount,
                bankCode: bankCode,
                branchCode: branchCode,
                accountNumber: accountNumber
            };
    
            accountType = sheet.getRange('H' + line.toString()).getValue();
            if (accountType) {
                payment["accountType"] = accountType;
            }
    
            tags = removeDiacritics(sheet.getRange('I' + line.toString()).getValue());
            if (tags) {
                request["tags"] = tags.split(",");
            }
    
            description = removeDiacritics(sheet.getRange('J' + line.toString()).getValue())
            if (description) {
                payment["description"] = description;
            }
    
            request = {
                centerId: centerId,
                type: "transfer",
                payment: payment,
            };
    
            if (schedule != "") {
                request["due"] = formatToLocalDatetime(schedule);
            }
            if(customerName=="" && taxId=="" && bankCode=="" && branchCode=="" && accountNumber=="") {
              emptyLines += 1;
              sheet.getRange(`L${line}`).setValue("Pagamentos incompletos.");
            }
            externalOrdersList.push(externalId)
            requestsList.push(request);
        }
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
    return requestsList
}

function managePaymentRequestTransfer(centerId) {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transferência com Aprovação');
    formatHeader(sheet);
    let externalOrdersList = paymentRequestManager().transfer;
    let extOrderListLen = externalOrdersList.length;
    let query = {}
    let ordersList = createPaymentRequestArray(centerId, sheet, externalOrdersList);
    let batchSize = 100;
    let failedBatchs = 0;
    let returnMessage = "";

    if(ordersList == null) {
      return
    }
    
    for (let batch = 0; batch < Math.ceil(ordersList.length/batchSize); batch++) {
        let ordersBatch = ordersList.slice((batch * batchSize), (batch * batchSize) + batchSize);
        let checkIds = externalOrdersList.slice(extOrderListLen + (batch * batchSize), (extOrderListLen + (batch * batchSize) + batchSize));
        let request = sendPaymentRequestBatch(ordersBatch, query);
        switch (request["status"]) {
            case 200:
                confirmOrders(sheet, batch, ordersBatch.length, batchSize, "K");
                updatePaymentRequestManager(checkIds, "transfer")
                break;
            case 500:
            case 400:
                failedBatchs += 1;
                returnMessage = returnMessage + failOrders(sheet, batch, batchSize, Array.from(request["content"]["errors"]), "K", "L");
                break;
        }
    }
    if(failedBatchs == 0) {
        sendMessage("Todos os itens foram enviados.");
        return
    }
    if(failedBatchs == Math.ceil(ordersList.length/batchSize)) {
        sendMessage("Falha no envio, verifique a situação de suas solicitações." + "\n\n" + returnMessage);
        return
    }
    if(failedBatchs < Math.ceil(ordersList.length/batchSize)) {
        sendMessage("Falha no envio de alguns itens, verifique a situação de suas solicitações." + "\n\n" + returnMessage);
        return
    }
}

function selectCenterDialog() {
    var html = HtmlService.createHtmlOutputFromFile('FormSelectCenter');
    SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
        .showModalDialog(html, 'Envio de Transferência para Aprovação');
}