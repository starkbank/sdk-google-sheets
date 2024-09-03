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
    
    static renderSignInCard (e) {
        const language = e.commonEventObject.userLocale;
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
        Authentication._deleteSavedWorkspace();
        const card = Authentication.renderSignInCard(e);

        const nav = CardService.newNavigation()
            .updateCard(card);
        
        return CardService.newActionResponseBuilder()
            .setNavigation(nav)
            .build();
    }
    
    static validateWorkspace (environment, workspaceName) {
        const {language} = Authentication.getJsonProperty("language");
        
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

    static setJsonProperty(property, jsonObject) {
        const userProperties = PropertiesService.getUserProperties();
        userProperties.setProperty(property, JSON.stringify(jsonObject));
        return true;
    }

    static getJsonProperty(property) {
        const userProperties = PropertiesService.getUserProperties();
        const objString = userProperties.getProperty(property);
        return JSON.parse(objString);
    }

    static deleteJsonProperty(property) {
        const userProperties = PropertiesService.getUserProperties();
        userProperties.deleteProperty(property);
        return true;
    }

    static getUserInputCredential(email, workspace, password, environment) {
        workspace = workspace.toLowerCase().trim()
    
        let workspaceInfos = Authentication.validateWorkspace(environment, workspace);
    
        if (!workspaceInfos.success) {
            throw workspaceInfos.message;
        }

        let workspaceId = workspaceInfos.workspace.id;
        let memberName = workspaceInfos.workspace.username;
    
        var key = KeyGen.generateKeyFromPassword(password, email, environment);
    
        const keys = easyMake();
    
        let privateKeyPem = keys[0];
        let publicKeyPem = keys[1];
    
        const requestBody = {
            expiration: 604800,
            publicKey: publicKeyPem,
            platform: "spreadsheet"
        }
    
        const jsonString = JSON.stringify(requestBody);

        Authentication.setJsonProperty("credentials", {
            workspace,
            email,
            environment,
            memberName,
            workspaceId,
            jsonString,
            privateKeyPem,
            publicKeyPem,
            keyPem: key.toPem(),
        });
    
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
            fetch("/challenge?expand=qrcode", "POST", payload, null, "v2", environment, key.toPem())
        );
        
        if (content[1] != 200) {
            Browser.msgBox(content[0]["errors"][0]["message"] + "\\n Efetue o login novamente");
            throw new Error(JSON.stringify(content[0]))
        } else {
            const challengeCreated = content[0];
    
            Authentication.setJsonProperty("challenge", challengeCreated.challenges[0]);
            Utils.logJson(challengeCreated);
    
            return challengeCreated["challenges"][0]["qrcode"]
        }
    }

    static getChallengeApprove() {
        const challenge = Authentication.getJsonProperty("challenge").challenges[0];
        Utils.logJson(challenge);
        const {key, challengeId, environment} = challenge;
        // var key = sheet.getRange('B14').getValue()
        // var challengeId = sheet.getRange('B15').getValue()
        // var environment = sheet.getRange('B3').getValue()
    
        var path = "/challenge/" + challengeId
    
        content = parseResponse(fetch(path, method = 'GET', null, null, 'v2', environment, key));
        console.log(content)
    
        if (content[1] != 200) {
            throw new Error(JSON.stringify(content[0]))
        } else {
            json = content[0];
    
            return json["challenge"]["status"]
        }
    }
}

function authGetUserInputCredential(email, workspace, password, environment) {
    return Authentication.getUserInputCredential(email, workspace, password, environment);
}