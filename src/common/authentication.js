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

    static renderLoginCard (e) {
        const loc = new Localization({
            "en": [
                "Name",
                "Change workspace",
                "Password"
            ],
            "pt-BR": [
                "Nome",
                "Alterar workspace",
                "Senha"
            ]
        });
        
        const {pictureUrl, name, organizationId, status} = Authentication.getSavedWorkspace();
        
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

        const emailInput = CardService.newTextInput()
            .setFieldName("email")
            .setTitle("Email")
        
        section.addWidget(emailInput)

        const passwordInput = CardService.newTextInput()
            .setFieldName("password")
            .setTitle("Senha")

        section.addWidget(passwordInput)

        
        section.addWidget(
            CardService.newTextButton()
                .setText("Login")
                .setOnClickAction(
                    CardService.newAction()
                        .setFunctionName("Authentication.navigateToHome")
                        // TBD: swap function to challenge
                )
        )
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

    static saveWorkspace(workspace) {
        const userProperties = PropertiesService.getUserProperties();
        userProperties.setProperty("WORKSPACE", JSON.stringify(workspace));
    }

    static getSavedWorkspace() {
        const userProperties = PropertiesService.getUserProperties();
        const workspace = userProperties.getProperty("WORKSPACE")
        if (!workspace) {
            return undefined;
        }

        return JSON.parse(workspace);
    }

    static deleteSavedWorkspace() {
        const userProperties = PropertiesService.getUserProperties();
        userProperties.deleteProperty("WORKSPACE")
    }

    static navigateToHome (e) {
        Authentication.deleteSavedWorkspace();
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

        const workspaceObj = workspaceInfos[0].workspaces[0];
        Authentication.saveWorkspace(workspaceObj);
        
        const card = Authentication.renderLoginCard(e, workspaceObj)

        const nav = CardService.newNavigation().updateCard(card);
        return CardService.newActionResponseBuilder()
            .setNavigation(nav)
            .build();
    }
}