class Homepage {
    static render (e) {
        const loc = new Localization({
            "en": [
                "Powered by Stark Bank"
            ],
            "pt-BR": [
                "Desenvolvido por Stark Bank"
            ]
        });

        const savedWorkspace = PropertiesService.getUserProperties()
            .getProperty("WORKSPACE");
        
        if (!Authentication.isAuthorized()) {
            if (savedWorkspace) {
                return Authentication.renderLoginCard(e)
            }

            return Authentication.renderWorkspaceSelectorCard(e);
        }

        const footer = CardService.newFixedFooter()
            .setPrimaryButton(
                CardService.newTextButton()
                    .setText(loc.getLocalized(e, 0))
                    .setOpenLink(
                        CardService.newOpenLink()
                            .setUrl('https://starkbank.com')
                    )
            );

        return CardService.newCardBuilder()
            .setFixedFooter(footer)
            .build();
    }
}