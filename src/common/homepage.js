class Homepage {
    static render (e) {
        const language = Authentication.getUserProperty("userLocale")

        const loc = new Localization({
            "en": [
                "Powered by Stark Bank"
            ],
            "pt-BR": [
                "Desenvolvido por Stark Bank"
            ]
        });

        if (!Authentication.isAuthorized()) {
            return Authentication.renderSignInCard(e);
        }

        const balance = Balance.get();

        const section = CardService.newCardSection()
            .setHeader("Balance")
            .addWidget(
                CardService.newTextParagraph()
                    .setText(new Intl.NumberFormat(language, { style: 'currency', currency: 'BRL' }).format(balance))
            )

        const footer = CardService.newFixedFooter()
            .setPrimaryButton(
                CardService.newTextButton()
                    .setText(loc.getLocalized(language, 0))
                    .setOpenLink(
                        CardService.newOpenLink()
                            .setUrl('https://starkbank.com')
                    )
            );

        return CardService.newCardBuilder()
            .addSection(section)
            .setFixedFooter(footer)
            .build();
    }
}