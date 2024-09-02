class Authentication {
    static isAuthorized () {
        // Check if there is a private key

        // Check if private key is working
        try {
            Balance.get()
            return true;
        } catch (e) {
            return false;
        }
    }
    
    static renderWorkspaceSelectorCard (e) {
        const loc = new Localization({
            "en": [
                "Workspace name",
                "Validate",
                "Name"
            ],
            "pt-BR": [
                "Nome do Workspace",
                "Validar",
                "Nome"
            ]
        });

        const workspaceInput = CardService.newTextInput()
            .setFieldName("workspace")
            .setTitle("Workspace")
        
        // Build login card
        const section = CardService.newCardSection()
            .setHeader("LOGIN")
            .addWidget(
                CardService.newTextParagraph()
                    .setText(loc.getLocalized(e, 0))
            )
            .addWidget(workspaceInput)
            .addWidget(
                CardService.newTextButton()
                    .setText(loc.getLocalized(e, 1))
                    .setOnClickAction(
                        CardService.newAction()
                            .setFunctionName("Authentication.validateWorkspace")
                            .addRequiredWidget("workspace")
                    )
            )

        return CardService.newCardBuilder()
            .addSection(section)
            .build();
    }

    static renderLoginCard (e, workspace) {
        const loc = new Localization({
            "en": [
                "Name",
                "Change workspace"
            ],
            "pt-BR": [
                "Nome",
                "Alterar workspace"
            ]
        });
        const {pictureUrl, name, organizationId, status} = workspace;
        
        const card =  CardService.newCardBuilder();
        const section = CardService.newCardSection();

        if (pictureUrl) {
            section.addWidget(
                CardService.newImage()
                    .setImageUrl(pictureUrl)
            )
        }

        if (name) {
            section.addWidget(
                CardService.newDecoratedText()
                    .setText(name)
                    .setTopLabel(loc.getLocalized(e, 0))
            )
        }

        if (organizationId) {
            section.addWidget(
                CardService.newDecoratedText()
                    .setText(organizationId)
                    .setTopLabel("ID")
            )
        }

        if (status) {
            section.addWidget(
                CardService.newDecoratedText()
                    .setText(status)
                    .setTopLabel("Status")
            )
        }
        
        section.addWidget(
            CardService.newTextButton()
                .setText(loc.getLocalized(e, 1))
                .setOnClickAction(
                    CardService.newAction()
                        .setFunctionName("Authentication.navigateToHome")
                )
        )
        
        card.addSection(section)

        return card.build()
    }

    static navigateToHome (e) {
        const card = Authentication.renderWorkspaceSelectorCard(e);

        const nav = CardService.newNavigation()
            .updateCard(card);
        
        return CardService.newActionResponseBuilder()
            .setNavigation(nav)
            .build();
    }
    
    static requestChallenge (email, pass, workspace) {
        // Generate challenge
        // Build card with QRCode
        return;
    }
    
    static isChallengeApproved () {
        // Check challenge status
        return;
    }
    
    static saveCredentials (privateKey, publicKey, workspace) {
        // Save on user properties
        Authentication.refreshAddOn();
        return;
    }
    
    static refreshAddOn () {
        // Refresh add-on after successfull login
    }
    
    static validateWorkspace (e) {
        const loc = new Localization({
            "en": [
                "Workspace not found"
            ],
            "pt-BR": [
                "Workspace não encontrado"
            ]
        });
        const workspace = e.formInputs?.workspace?.[0];

        if (!workspace) {
            Browser.msgBox(loc.getLocalized(e, 1));
            return;
        }

        let workspaceInfos = parseResponse(
            UrlFetchApp.fetch(
                getHostname(Utils.getEnv(), "v2") + "/workspace?username=" + workspace, 
                null
            )
        );

        const statusCode = workspaceInfos[1];
        
        if (statusCode != 200) {
            Browser.msgBox(`${statusCode}: ${JSON.stringify(payload, null, 2)}`);
            return;
        }

        if (workspaceInfos[0].workspaces.length === 0) {
            Browser.msgBox(loc.getLocalized(e, 0));
            return;
        }
        
        const card = Authentication.renderLoginCard(e, workspaceInfos[0].workspaces[0])

        const nav = CardService.newNavigation().updateCard(card);
        return CardService.newActionResponseBuilder()
            .setNavigation(nav)
            .build();
    }
}