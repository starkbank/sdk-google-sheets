class Authentication {
    static isAuthorized () {
        try {
            Balance.get()
            return true;
        } catch (e) {
            console.log("ERROR GETTING BALANCE", e)
            this.clearAuthProps()
            return false;
        }
    }
    
    static renderSignInCard (e) {
        const language = Authentication.getUserProperty("userLocale");
        const loc = new Localization({
            "en": [
                "Login into your Stark Bank account"
            ],
            "pt-BR": [
                "Acesse sua conta Stark Bank"
            ]
        });
        
        // Build login card
        const section = CardService.newCardSection()
            .setHeader("LOGIN")
            .addWidget(
                CardService.newTextParagraph()
                    .setText(loc.getLocalized(language, 0))
            )
            .addWidget(
                CardService.newTextButton()
                    .setText("Login")
                    .setOnClickAction(
                        CardService.newAction()
                            .setFunctionName("Authentication.showSignInDialog")
                    )
            )

        return CardService.newCardBuilder()
            .addSection(section)
            .build();
    }

    static showSignInDialog (e) {
        var html = HtmlService.createHtmlOutputFromFile('pages/FormCredentials')
            .setHeight(500)
            .setWidth(600);
        SpreadsheetApp.getUi()
            .showModalDialog(html, 'Login');
    }

    static navigateToHome (e) {
        const card = Homepage.render(e);

        const nav = CardService.newNavigation()
            .updateCard(card);
        
        return CardService.newActionResponseBuilder()
            .setNavigation(nav)
            .build();
    }
    
    static validateWorkspace (environment, workspaceName) {
        const language = Authentication.getUserProperty("userLocale");
        
        const loc = new Localization({
            "en": [
                "Workspace not found"
            ],
            "pt-BR": [
                "Workspace não encontrado"
            ]
        });

        if (!workspaceName) {
            Browser.msgBox(loc.getLocalized(language, 1));
            return;
        }

        const fetchWorkspaceResponse = parseResponse(
            UrlFetchApp.fetch(
                getHostname(environment, "v2") + "/workspace?username=" + workspaceName, 
                null
            )
        );

        const statusCode = fetchWorkspaceResponse[1];
        
        if (statusCode != 200) {
            return {
                success: false,
                message: `${statusCode}: ${JSON.stringify(payload, null, 2)}`
            };
        }

        if (fetchWorkspaceResponse[0].workspaces.length === 0) {
            return {
                success: false,
                message: loc.getLocalized(language, 0)
            };
        }

        const workspaceObj = fetchWorkspaceResponse[0].workspaces[0];
        
        return {
            success: true,
            workspace: workspaceObj
        };
    }

    static setUserProperty(property, value) {
        const userProperties = PropertiesService.getUserProperties();
        userProperties.setProperty(property, value);
    }

    static getUserProperty(property) {
        const userProperties = PropertiesService.getUserProperties();
        return userProperties.getProperty(property);
    }

    static deleteUserProperty(property) {
        const userProperties = PropertiesService.getUserProperties();
        userProperties.deleteProperty(property);
    }

    static getUserInputCredential(email, workspace, password, environment) {
        workspace = workspace.toLowerCase().trim()
        Authentication.setUserProperty("workspace", workspace)
        Authentication.setUserProperty("email", email)
        Authentication.setUserProperty("environment", environment)
    
        let workspaceInfos = Authentication.validateWorkspace(environment, workspace);
    
        if (!workspaceInfos.success) {
            throw workspaceInfos.message;
        }

        let workspaceId = workspaceInfos.workspace.id;
        Authentication.setUserProperty("workspaceId", workspaceId)
        let memberName = workspaceInfos.workspace.username;
        Authentication.setUserProperty("memberName", memberName)
    
        var keyFromCredentials = KeyGen.generateKeyFromPassword(password, email, environment);
        Authentication.setUserProperty("keyFromCredentials", keyFromCredentials.toPem())
    
        const keys = easyMake();
    
        let privateKeyPem = keys[0];
        Authentication.setUserProperty("privateKeyPem", privateKeyPem)
        let publicKeyPem = keys[1];
        Authentication.setUserProperty("publicKeyPem", publicKeyPem)
    
        const requestBody = {
            expiration: 604800,
            publicKey: publicKeyPem,
            platform: "spreadsheet"
        }
    
        const jsonString = JSON.stringify(requestBody);
        Authentication.setUserProperty("challengeJsonString", jsonString)

    
        const challenge = {
            requestBody: jsonString,
            requestMethod: "POST",
            requestPath: "/session",
            type: "authenticator"
        }
    
        const payload = {
            "challenges": [challenge]
        }

        const content = parseResponse(
            fetch("/challenge?expand=qrcode", "POST", payload, null, "v2", environment, keyFromCredentials.toPem())
        );
        
        if (content[1] != 200) {
            Browser.msgBox(content[0]["errors"][0]["message"] + "\\n Efetue o login novamente");
            throw new Error(JSON.stringify(content[0]))
        } else {
            const challengeCreated = content[0];
            const {
                id,
            } = challengeCreated.challenges[0];
            Authentication.setUserProperty("accessId", id)
    
            return challengeCreated.challenges[0].qrcode;
        }
    }

    static getChallengeStatus() {
        const challengeId = Authentication.getUserProperty("accessId")
        const environment = Authentication.getUserProperty("environment")
        const keyFromCredentials = Authentication.getUserProperty("keyFromCredentials")
        
        const path = "/challenge/" + challengeId;
    
        const content = parseResponse(fetch(path, 'GET', null, null, 'v2', environment, keyFromCredentials));
    
        if (content[1] != 200) {
            throw new Error(JSON.stringify(content[0]))
        } else {
            const json = content[0];
            return json.challenge.status;
        }
    }

    static saveApprovedChallenge() {
        const environment = Authentication.getUserProperty("environment");
        const keyFromCredentials = Authentication.getUserProperty("keyFromCredentials");

        const jsonStringBody = Authentication.getUserProperty("challengeJsonString");
        const challengeId = Authentication.getUserProperty("accessId");

        // TBD: Why?
        const content = parseResponse(maskFetch("/session", "POST", jsonStringBody, null, 'v2', environment, keyFromCredentials, challengeId));

        if (content[1] != 200) {
            throw new Error(JSON.stringify(content[0]))
        } else {
            const json = content[0];

            Authentication.setUserProperty("accessId", json.session.id);
        }
    }

    static getDefaultUser() {
        const email = Authentication.getUserProperty("email");
        let accessId = Authentication.getUserProperty("accessId");
        const workspace = Authentication.getUserProperty("workspace");
        const name = Authentication.getUserProperty("memberName");
        const accessToken = Authentication.getUserProperty("accessToken");
        const environment = Authentication.getUserProperty("environment");
        const workspaceId = Authentication.getUserProperty("workspaceId");
        const publicKey = Authentication.getUserProperty("publicKeyPem");
        const privateKey = Authentication.getUserProperty("privateKeyPem");

        if (accessId) {
            accessId = "session/" + accessId;
        }

        return {
            name,
            email,
            accessId,
            workspace,
            cartId: "",
            publicKey,
            privateKey,
            environment,
            workspaceId,
            accessToken,
        }
    }

    static clearAuthProps() {
        Authentication.deleteUserProperty("email");
        Authentication.deleteUserProperty("accessId");
        Authentication.deleteUserProperty("workspace");
        Authentication.deleteUserProperty("memberName");
        Authentication.deleteUserProperty("accessToken");
        Authentication.deleteUserProperty("environment");
        Authentication.deleteUserProperty("workspaceId");
        Authentication.deleteUserProperty("publicKeyPem");
        Authentication.deleteUserProperty("privateKeyPem");
        
        console.log("Credential props cleared")
    }
}

function authGetUserInputCredential(email, workspace, password, environment) {
    return Authentication.getUserInputCredential(email, workspace, password, environment);
}

function authGetChallengeStatus() {
    return Authentication.getChallengeStatus();
}

function authNavigateToHome() {
    return Authentication.navigateToHome();
}

function authSaveApprovedChallenge() {
    return Authentication.saveApprovedChallenge();
}