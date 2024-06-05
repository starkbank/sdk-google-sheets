function getDictKey()
{
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Chave PIX');

  var jsonData = [];

  for(let i=11; i<=sheet.getLastRow(); i++) 
  {
    var keyId = sheet.getRange('A' + i.toString()).getValue()

    if (keyId.length == 13) 
    {
      keyId = "+" + keyId
    }

    json = parseResponse(fetch("/dict-key/" + keyId, method = 'GET'));

    if (json[1] != 200) {

      if (json[0]["errors"][0]["code"] == "invalidPixKey") 
      {
        Browser.msgBox("A chave informada não corresponde nenhum dos padrões conhecidos de chave. As chaves conhecidas são emails, números de celular no padrão E164 (ex: 5511988887777), CPFs válidos, CNPJs válidos e EVPs.")
        return
      }
      if (json[0]["errors"][0]["code"] != "invalidPixKey")
      {
        Browser.msgBox("Linha: " + i + "\n\n " + json[0]["errors"][0]["message"])
        return
      }
    }

    json = json[0]

    sheet.getRange('E' + i.toString()).setValue(json["key"]["name"])
    sheet.getRange('F' + i.toString()).setValue(json["key"]["taxId"])
    sheet.getRange('G' + i.toString()).setValue(json["key"]["ispb"])
    sheet.getRange('H' + i.toString()).setValue(json["key"]["branchCode"])
    sheet.getRange('I' + i.toString()).setValue(json["key"]["accountNumber"])
    sheet.getRange('J' + i.toString()).setValue(json["key"]["type"])

    var amount = sheet.getRange('B' + i.toString()).getValue();

    jsonData.push(
      {
        id: i,
        keyId: keyId,
        tags: sheet.getRange('C' + i.toString()).getValue(),
        description: sheet.getRange('D' + i.toString()).getValue(),
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

  var ui = SpreadsheetApp.getUi();

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
    }

  } else {
    return
  }

}