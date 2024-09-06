const STARK_LOGO_URL = "https://starkbank.com/static/icon.png";

/**
 * Callback for rendering the homepage card.
 * @return {CardService.Card} The card to show to the user.
 */
function onHomepage(e) {
    console.log(e);
    Authentication.setUserProperty("userLocale", e.userLocale)
    Authentication.setUserProperty("userCountry", e.userCountry)
    
    return Homepage.render(e);
}

function onFileScopeGranted(e) {
    return;
}

function onInstall(e) {
    onOpen(e);
    // Perform additional setup as needed.
}

function onOpen(e) {
    SpreadsheetApp.getUi().createAddonMenu() // Or DocumentApp.
        .addItem('Insert chart', 'insertChart')
        .addItem('Update charts', 'updateCharts')
        .addToUi();
}