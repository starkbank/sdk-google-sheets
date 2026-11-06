
function Response(status, content) {
  this.status = status;
  this.content = content;
}

// Values that become part of a request path or of a query string come from cells and from the API:
// they must not be able to change the route or to add parameters. Both keep every character that
// ids, e-mails, phone numbers (with "+"), dates and lists are made of, so those requests are the same
// as before; anything else is percent-encoded.
function pathSegment(value) {
  let text = String(value);
  // "." and ".." (also when percent-encoded) are read as "this folder" and "the parent folder"
  // when a URL is resolved; no id or key is made of them, so they become something else.
  if (text == "." || text == "..") {
    return "%2E%2E%2E";
  }

  return text.replace(/[^A-Za-z0-9@+._:-]/gu, percentEncodeCharacter);
}

function queryValue(value) {
  return String(value).replace(/[^A-Za-z0-9\-_.~:,@\/*!'()]/gu, percentEncodeCharacter);
}

function percentEncodeCharacter(character) {
  try {
    return encodeURIComponent(character);
  } catch (error) {
    // A lone surrogate cannot be encoded: the replacement character is used instead.
    return "%EF%BF%BD";
  }
}

function getHostname(environment, version = "v2"){
  return {
    'production': 'https://api.starkbank.com/' + version,
    'sandbox': 'https://sandbox.api.starkbank.com/' + version,
    'development': 'https://development.api.starkbank.com/' + version
  }[environment.toLowerCase()];
}

// Requests sent together by fetchAllWithSession_: enough to save time, few enough to stay small.
const parallelRequestCount = 10;

function maskFetch(path, method='GET', payload=null, query=null, version="v2", environment=null, privateKeyPem=null, challengeId=null, sessionAccessId=null) {

    let user = new getDefaultUser();
    if (!user.privateKey && !privateKeyPem) {
        throw JSON.stringify({"message": "Erro de autenticação! Por favor, faça login novamente."});
    }
    if (!environment) {
        environment = environment || user.environment.toLowerCase();
    }
    let hostname = getHostname(environment, version);
    let url = hostname + path;
    
    if (query) {
        let queryString = '';
        let separator = '?';
        for (let key in query) {
            if (query[key]) {
                queryString += separator + key + '=' + queryValue(query[key]);
                separator = '&';
            }
        }
        url += queryString;
    }

    if (sessionAccessId) {
      var accessId = sessionAccessId
    } else if (privateKeyPem) {
      var accessId = KeyGen.generateMemberAccessId(user.workspaceId, user.email)
    } else {
      var accessId = user.accessId;
    }

    if (!privateKeyPem) {
      var privateKeyPem = user.privateKey;
    }

    let body = ""
    if (payload) {
        body = payload;
    }

    return UrlFetchApp.fetch(url, signedOptions_(method, body, accessId, privateKeyPem, challengeId, 'application/json'));
}

// Method, payload, headers and signature of a request. muteHttpExceptions keeps an error answer as an
// answer (without it, fetchAll throws for the whole batch).
function signedOptions_(method, body, accessId, privateKeyPem, challengeId, contentType) {
    let accessTime = Math.round((new Date()).getTime() / 1000).toString();
    let options = {
        method: method,
        muteHttpExceptions: true,
        payload: body,
        headers: {
            'Access-Id': accessId,
            'User-Agent': 'App-StarkBank-GSheets-v0.8.2b',
            'User-Agent-Override': 'App-StarkBank-GSheets-v0.8.2b',
            'PlatFormId' : 'gsheets',
            'PlatFormVersion' : '0.8.2',
            'Accept-Language': 'pt-BR',
            'Content-Type': contentType,
            'Access-Time': accessTime
        },
    };

    let message = accessId + ':' + accessTime + ':' + body

    if (challengeId) {
      message += ":" + challengeId
      options['headers']['Access-Challenge-Ids'] = challengeId
    }

    options['headers']['Access-Signature'] = easySign(message, privateKeyPem);
    return options;
}

// GET requests signed with the session of the user, sent together: the answers come in the order of
// the paths. Callers send at most parallelRequestCount paths at a time.
function fetchAllWithSession_(paths, contentType) {
  if (paths.length == 0) {
    return [];
  }
  let user = new getDefaultUser();
  if (!user.privateKey) {
    throw JSON.stringify({"message": "Erro de autenticação! Por favor, faça login novamente."});
  }
  let hostname = getHostname(user.environment.toLowerCase(), "v2");
  let requests = paths.map(path => assign({url: hostname + path}, signedOptions_('GET', "", user.accessId, user.privateKey, null, contentType)));
  return UrlFetchApp.fetchAll(requests);
}

function fetch(path, method='GET', payload=null, query=null, version="v2", environment=null, privateKeyPem=null, challengeId=null) {

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


function fetchBuffer(path, method='GET', payload=null, query=null, version="v2", environment=null, privateKeyPem=null, challengeId=null) {
  let user = new getDefaultUser();
  if (!user.privateKey && !privateKeyPem) {
      throw JSON.stringify({"message": "Erro de autenticação! Por favor, faça login novamente."});
  }
  if (!environment) {
      environment = environment || user.environment.toLowerCase();
  }
  let hostname = getHostname(environment, version);
  let url = hostname + path;
  
  if (query) {
      let queryString = '';
      let separator = '?';
      for (let key in query) {
          if (query[key]) {
              queryString += separator + key + '=' + queryValue(query[key]);
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

  let body = ""
  if (payload) {
      body = payload;
  }

  return pdfFromResponse_(UrlFetchApp.fetch(url, signedOptions_(method, body, accessId, privateKeyPem, challengeId, 'application/pdf')));
}

// [the PDF, 200], or [the code of the API error, status].
function pdfFromResponse_(response) {
  let status = response.getResponseCode();
  if (status != 200) {
    return [parseResponse(response)[0]["errors"][0]["code"], status]
  }
  return [response.getAs("application/pdf"), status]
}