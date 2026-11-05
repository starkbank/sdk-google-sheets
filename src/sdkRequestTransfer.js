function createPaymentRequestArray(centerId, sheet, externalOrdersList) {
    let requestsList = [];
    let request = {};
    let payment = {};
    let initialLine = 11;
    let duplicatedPayments = 0;
    let emptyLines = 0;
    // The ids sent before and the ones of the rows above, for a membership check per row.
    let seenIds = new Set(externalOrdersList);
    let statuses = [];

    clearCollumns(sheet, 12, 13);
    for (let row of readRows_(sheet, 11)) {
        let customerName = removeDiacritics(cellOf_(row, 'A'));
        let taxId = removeDiacritics(cellOf_(row, 'B'));
        let amount = parseInt(Math.round(100 * cellOf_(row, 'C')), 10);
        let bankCode = removeDiacritics((cellOf_(row, 'D')).toString());
        let branchCode = removeDiacritics(cellOf_(row, 'E'));
        let accountNumber = removeDiacritics(cellOf_(row, 'F'));
        let schedule = cellOf_(row, 'G');
        let tags = removeDiacritics(cellOf_(row, 'I').toString());
        let description = removeDiacritics(cellOf_(row, 'J').toString());
        let displayDescription = removeDiacritics(cellOf_(row, 'K').toString());
        
        let externalId = calculateExternalId(amount, customerName, taxId, bankCode, branchCode, accountNumber, tags, description);
        statuses.push(["Não enviado"]);

        if(seenIds.has(externalId)) {
            duplicatedPayments +=1;
            statuses[statuses.length - 1] = ["Pagamento duplicado"];
            externalOrdersList.push(externalId);
        }

        if(!seenIds.has(externalId)) {
            payment = {
                name: customerName,
                taxId: taxId,
                amount: amount,
                bankCode: bankCode,
                branchCode: branchCode,
                accountNumber: accountNumber
            };
    
            accountType = cellOf_(row, 'H');
            if (accountType) {
                payment["accountType"] = accountType;
            }

            if (description) {
                payment["description"] = description;
            }

            if (displayDescription) {
                payment["displayDescription"] = displayDescription;
            }

            request = {
                centerId: centerId,
                type: "transfer",
                payment: payment,
            };

            if (tags) {
                request["tags"] = tags.split(",");
            }

            if (schedule != "") {
                request["due"] = formatToLocalDatetime(schedule);
            }
            if(customerName=="" && taxId=="" && bankCode=="" && branchCode=="" && accountNumber=="") {
              emptyLines += 1;
              statuses[statuses.length - 1] = ["Pagamentos incompletos."];
            }
            externalOrdersList.push(externalId)
            seenIds.add(externalId)
            requestsList.push(request);
        }
    }
    writeRows_(sheet, initialLine, 12, statuses);
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
    let uncertainBatchs = 0;
    let returnMessage = "";
    const statusColumns = {first: 12, notSent: "Não enviado"};

    if(ordersList == null) {
        return
    }
    
    let batchCount = Math.ceil(ordersList.length/batchSize);
    for (let batch = 0; batch < batchCount; batch++) {
        let ordersBatch = ordersList.slice((batch * batchSize), (batch * batchSize) + batchSize);
        let checkIds = externalOrdersList.slice(extOrderListLen + (batch * batchSize), (extOrderListLen + (batch * batchSize) + batchSize));
        let firstLine = 11 + batch * batchSize;
        let request = sendPaymentRequestBatch(ordersBatch, query);
        if (request["outcome"] == "sent") {
            confirmOrders(sheet, firstLine, ordersBatch.length, statusColumns);
            updatePaymentRequestManager(checkIds, "transfer")
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

function selectCenterDialog() {
    var html = HtmlService.createTemplateFromFile('FormSelectCenter').evaluate();
    SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
        .showModalDialog(html, 'Envio de Transferência para Aprovação');
}