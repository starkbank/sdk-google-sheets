
function Response(status, content) {
    this.status = status;
    this.content = content;
}

function getHostname(environment, version = "v2") {
    return {
        'production': 'https://api.starkbank.com/' + version,
        'sandbox': 'https://sandbox.api.starkbank.com/' + version,
        'development': 'https://development.api.starkbank.com/' + version
    }[environment.toLowerCase()];
}

function maskFetch(path, method = 'GET', payload = null, query = null, version = "v2", environment = null, privateKeyPem = null, challengeId = null) {

    let user = new getDefaultUser();
    if (!user.privateKey) {
        throw JSON.stringify({ "message": "Erro de autenticação! Por favor, faça login novamente." });
    }
    if (!environment) {
        environment = environment || user.environment.toLowerCase();
    }
    let hostname = getHostname(environment, version);
    let options = {
        method: method,
        muteHttpExceptions: true,
    };
    let url = hostname + path;

    if (query) {
        let queryString = '';
        let separator = '?';
        for (let key in query) {
            if (query[key]) {
                queryString += separator + key + '=' + query[key];
                separator = '&';
            }
        }
        url += queryString;
    }

    if (privateKeyPem) {
        var accessId = KeyGen.generateMemberAccessId(user.workspaceId, user.email)
    } else {
        var accessId = user.accessId;
    }

    if (!privateKeyPem) {
        var privateKeyPem = user.privateKey;
    }

    let accessTime = Math.round((new Date()).getTime() / 1000).toString();
    options['headers'] = {
        'Access-Id': accessId,
        'User-Agent': 'App-StarkBank-GSheets-v0.6.6b',
        'User-Agent-Override': 'App-StarkBank-GSheets-v0.6.6b',
        'PlatFormId': 'gsheets',
        'PlatFormVersion': '0.6.6',
        'Accept-Language': 'pt-BR',
        'Content-Type': 'application/json',
        'Access-Time': accessTime
    };

    let body = ""
    if (payload) {
        body = payload;
    }

    options['payload'] = body;

    let message = accessId + ':' + accessTime + ':' + body

    if (challengeId) {
        message += ":" + challengeId
        options['headers']['Access-Challenge-Ids'] = challengeId
    }

    let signature = easySign(message, privateKeyPem);
    options['headers']['Access-Signature'] = signature;

    return UrlFetchApp.fetch(url, options);
}

function fetch(path, method = 'GET', payload = null, query = null, version = "v2", environment = null, privateKeyPem = null, challengeId = null) {

    body = ""
    if (payload) {
        body = JSON.stringify(payload)
    }

    return maskFetch(path, method, body, query, version, environment, privateKeyPem, challengeId)
}


function parseResponse(responseApi) {
    let content = responseApi.getContentText();
    let status = responseApi.getResponseCode();
    let response = new Response(status, content);
    let json = JSON.parse(response.content);
    return [json, status];
}


function fetchBuffer(path, method = 'GET', payload = null, query = null, version = 'v2') {
    let user = new getDefaultUser();
    let hostname = getHostname(user.environment.toLowerCase(), version);
    let options = { method: method };
    let url = hostname + path;

    if (query) {
        let queryString = '';
        let separator = '?';
        for (let key in query) {
            if (query[key]) {
                queryString += separator + key + '=' + query[key];
                separator = '&';
            }
        }
        url += queryString;
    }

    paths = ["/session", "/boleto-payment"]

    if (paths.includes(path) && method != "GET") {
        var accessId = KeyGen.generateMemberAccessId(user.workspaceId, user.email)
    } else {
        var accessId = user.accessId;
    }

    let accessTime = Math.round((new Date()).getTime() / 1000).toString();
    options['headers'] = {
        'Access-Id': accessId,
        'User-Agent': 'App-StarkBank-GSheets-v0.6.6b',
        'User-Agent-Override': 'App-StarkBank-GSheets-v0.6.6b',
        'Accept-Language': 'pt-BR',
        'Content-Type': 'application/json',
        'Access-Time': accessTime
    };

    let body = JSON.stringify(payload);
    if (!payload) {
        body = "";
    }

    options['payload'] = body;

    if (!privateKeyPem) {
        var privateKeyPem = user.privateKey;
    }

    let message = accessId + ':' + accessTime + ':' + body;
    let signature = easySign(message, privateKeyPem);
    options['headers']['Access-Signature'] = signature;

    response = UrlFetchApp.fetch(url, options);

    let content = response.getAs("application/pdf");
    let status = response.getResponseCode();

    if (status != 200) {
        Browser.msgBox(parseResponse(response)[0]["errors"][0]["message"])
        return new Error()
    } else {
        return [content, status]
    }
}

function fetchMath() {
    let url = "https://us-central1-api-ms-auth-sbx.cloudfunctions.net/ellipticCurveMath";
    let payload = {
        "Gx": "55066263022277343669578718895168534326250603453777594175500187360389116729240",
        "Gy": "32670510020758816978083085130507043184471273380659243275938904335757337482424",
        "A": "0",
        "P": "115792089237316195423570985008687907853269984665640564039457584007908834671663",
        "N": "115792089237316195423570985008687907852837564279074904382605163141518161494337"
    };
    let options = {
        method: 'post',
        payload: JSON.stringify(payload),
        headers: { 'Content-Type': 'Application/json' }
    };
    let response = UrlFetchApp.fetch(url, options);
    let content = response.getContentText();
    let status = response.getResponseCode();
    switch (status) {
        case 200:
            return new Response(status, content);
        case 400:
        case 404:
        case 500:
            throw JSON.stringify(JSON.parse(content)["error"]);
        default:
            throw e;
    }
    return new Response(status, content);
}
