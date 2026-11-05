function getDictKey()
{
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Chave PIX');
  let errorsCount = 0;
  var jsonData = [];
  clearCollumns(sheet, 11, 11)
  // The rows without a name (column F) yet are looked up, parallelRequestCount at a time.
  let lookups = [];
  readRows_(sheet, 6).forEach((row, index) => {
    var keyId = cellOf_(row, 'A')

    if (keyId.length == 13) 
    {
      keyId = "+" + keyId
    }

    if(cellOf_(row, 'F') == "") {
      lookups.push({line: 11 + index, keyId: keyId, row: row});
    }
  });

  for (let start = 0; start < lookups.length; start += parallelRequestCount) {
    let chunk = lookups.slice(start, start + parallelRequestCount);
    let paths = chunk.map(lookup => "/dict-key/" + pathSegment(lookup.keyId));
    let responses = fetchAllWithSession_(paths, 'application/json');
    let keyRows = [];
    chunk.forEach((lookup, index) => {
      json = parseResponse(responses[index]);
      
      if (json[1] != 200) {
        errorsCount += 1;
        keyRows.push({line: lookup.line, column: 11, values: [dictKeyError_(json[0]["errors"][0])]});
      }
      if(json[1] == 200) {
        json = json[0]
        keyRows.push({line: lookup.line, column: 6, values: [
          json["key"]["name"],
          json["key"]["taxId"],
          json["key"]["ispb"],
          json["key"]["branchCode"],
          json["key"]["accountNumber"],
          json["key"]["type"],
        ]});
    
        jsonData.push(
          {
            id: lookup.line,
            keyId: lookup.keyId,
            tags: cellOf_(lookup.row, 'C'),
            description: cellOf_(lookup.row, 'D'),
            displayDescription: cellOf_(lookup.row, 'E'),
            amount: cellOf_(lookup.row, 'B'),
            taxId: json["key"]["taxId"],
            name: json["key"]["name"],
            ispb: json["key"]["ispb"],
            branchCode: json["key"]["branchCode"],
            accountNumber: json["key"]["accountNumber"],
            accountType: json["key"]["accountType"]
          }
        );
      }
    });
    writeKeyRows_(sheet, keyRows);
  }

  var ui = SpreadsheetApp.getUi();
  
  if(errorsCount == 0){
    var resultado = ui.alert(
      'Deseja prosseguir?',
      'Foram encontradas ' + jsonData.length + ' Chaves Pix válidas. Deseja mover para a aba de Transferências com Aprovação? Dados na aba de Transferências com Aprovação serão apagados.',
      ui.ButtonSet.OK_CANCEL);
    
      if (resultado == ui.Button.OK) {
        sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Transferência com Aprovação");
        sheet.activate();
        
        // Column G (the schedule) is left as it is.
        writeRows_(sheet, 11, 1, jsonData.map(data => [data["name"], data["taxId"], data["amount"], data["ispb"], data["branchCode"], data["accountNumber"]]));
        writeRows_(sheet, 11, 8, jsonData.map(data => [data["accountType"], data["tags"], data["description"], data["displayDescription"]]));
    
      } else {
        return
      }    
  }
  if(errorsCount > 1){
    ui.alert(
      'Algumas chaves estão incorretas, verifique as informações e tente novamente.?',
      'Foram encontradas ' + errorsCount + ' Chaves Pix invválidas.',
      ui.ButtonSet.OK)
  }
}

function dictKeyError_(error) {
  if (error["code"] == "invalidPixKey") {
    return "A chave informada não corresponde a nenhum dos padrões conhecidos (e-mail, número de celular no formato E164 — ex: 5511988887777, CPF, CNPJ ou EVP) ou não está vinculada a nenhuma conta ativa.";
  }
  return error["message"];
}

// Writes the looked up rows, one call per run of consecutive rows that start at the same column: a key
// found fills F to K, a key with an error only K.
function writeKeyRows_(sheet, keyRows) {
  let run = [];
  for (let keyRow of keyRows) {
    let previous = run[run.length - 1];
    if (previous && (previous.line + 1 != keyRow.line || previous.column != keyRow.column)) {
      writeRows_(sheet, run[0].line, run[0].column, run.map(item => item.values));
      run = [];
    }
    run.push(keyRow);
  }
  if (run.length > 0) {
    writeRows_(sheet, run[0].line, run[0].column, run.map(item => item.values));
  }
}
