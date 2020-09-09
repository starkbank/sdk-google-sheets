function goStatementSheet() {
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Extrato'));
}

function goViewTransferSheet() {
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Transferência'));
}


function goViewChargeSheet() {
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Boleto'));
}


function goViewChargePaymentSheet() {
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Pagamento Boleto'));
}


function goSendOrderSheet() {
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transferência com Aprovação'));
}


function goHomeSheet() {
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Principal'));
}

function goSendTransferSheet() {
 SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transferência sem Aprovação')) 
}

function goPayBoletos()
{
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pagamento de Boletos'));
}

function goViewCustomers()
{
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Consulta de Clientes'));
}

function goCreateBoleto()
{
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Emissão de Boletos'));
}

function goTransaction()
{
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transferência Interna'));
}

function goViewChargeEvent()
{
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Histórico de Boletos Emitidos'));
}

function goCreateCustomers()
{
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Cadastro de Clientes'));
}