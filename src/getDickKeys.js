function getDictKey()
{
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Chave PIX');
  let errorsCount = 0;
  var jsonData = [];
  clearCollumns(sheet, 11, 11)
  for(let i=11; i<=sheet.getLastRow(); i++) 
  {
    var keyId = sheet.getRange('A' + i.toString()).getValue()

    if (keyId.length == 13) 
    {
      keyId = "+" + keyId
    }

    if(sheet.getRange('F' + i.toString()).getValue() == "") {
      json = parseResponse(fetch("/dict-key/" + keyId, method = 'GET'));
      
      if (json[1] != 200) {
        if (json[0]["errors"][0]["code"] == "invalidPixKey") 
        {
          errorsCount += 1;
          sheet.getRange('K' + i.toString()).setValue("A chave informada não corresponde a nenhum dos padrões conhecidos (e-mail, número de celular no formato E164 — ex: 5511988887777, CPF, CNPJ ou EVP) ou não está vinculada a nenhuma conta ativa.");
        }
        if (json[0]["errors"][0]["code"] != "invalidPixKey")
        {
          errorsCount += 1;
          sheet.getRange('K' + i.toString()).setValue(json[0]["errors"][0]["message"]);
        }
      }
      if(json[1] == 200) {
        json = json[0]
  
        sheet.getRange('F' + i.toString()).setValue(json["key"]["name"])
        sheet.getRange('G' + i.toString()).setValue(json["key"]["taxId"])
        sheet.getRange('H' + i.toString()).setValue(json["key"]["ispb"])
        sheet.getRange('I' + i.toString()).setValue(json["key"]["branchCode"])
        sheet.getRange('J' + i.toString()).setValue(json["key"]["accountNumber"])
        sheet.getRange('K' + i.toString()).setValue(json["key"]["type"])
    
        var amount = sheet.getRange('B' + i.toString()).getValue();
    
        jsonData.push(
          {
            id: i,
            keyId: keyId,
            tags: sheet.getRange('C' + i.toString()).getValue(),
            description: sheet.getRange('D' + i.toString()).getValue(),
            displayDescription: sheet.getRange('E' + i.toString()).getValue(),
            amount: amount,
            taxId: json["key"]["taxId"],
            name: json["key"]["name"],
            ispb: json["key"]["ispb"],
            branchCode: json["key"]["branchCode"],
            accountNumber: json["key"]["accountNumber"],
            accountType: json["key"]["accountType"]
          }
        );
        } 
    }
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
        
        var key = -11;
    
        for (let i=11; i<=jsonData.length + 10; i++) 
        {
          sheet.getRange('A' + i.toString()).setValue(jsonData[i + key]["name"])
          sheet.getRange('B' + i.toString()).setValue(jsonData[i + key]["taxId"])
          sheet.getRange('C' + i.toString()).setValue(jsonData[i + key]["amount"])
          sheet.getRange('D' + i.toString()).setValue(jsonData[i + key]["ispb"])
          sheet.getRange('E' + i.toString()).setValue(jsonData[i + key]["branchCode"])
          sheet.getRange('F' + i.toString()).setValue(jsonData[i + key]["accountNumber"])
          sheet.getRange('H' + i.toString()).setValue(jsonData[i + key]["accountType"])
          sheet.getRange('I' + i.toString()).setValue(jsonData[i + key]["tags"])
          sheet.getRange('J' + i.toString()).setValue(jsonData[i + key]["description"])
          sheet.getRange('K' + i.toString()).setValue(jsonData[i + key]["displayDescription"])
        }
    
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