
function createBoleto()
{
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Emissão de Boletos');
    let boletos = [];

    formatHeader(sheet);

    for(let i=11; i<=sheet.getLastRow(); i++) {
        let boleto = {
            customerId: sheet.getRange('A' + i.toString()).getValue(),
            amount: parseInt(100*sheet.getRange('B' + i.toString()).getValue(), 10),
            dueDate: formatDateToISO(sheet.getRange('C' + i.toString()).getValue()),
            fine: parseFloat(sheet.getRange('D' + i.toString().getValue())),
            interest: parseFloat(sheet.getRange('E' + i.toString()).getValue()),
            overdueLimit: parseInt(sheet.getRange('F' + i.toString()).getValue()),
            discount: parseFloat(sheet.getRange('G' + i.toString()).getValue()),
            discountDate: formatDateToISO(sheet.getRange('H' + i.toString()).getValue()),
            
        }
    }
}