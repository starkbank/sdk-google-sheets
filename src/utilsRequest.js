
function Response(status, content) {
  this.status = status;
  this.content = content;
}

function getHostname(environment, version = "v2"){
  return {
    'production': 'https://api.starkbank.com/' + version,
    'sandbox': 'https://sandbox.api.starkbank.com/' + version,
    'development': 'https://development.api.starkbank.com/' + version
  }[environment.toLowerCase()];
}

function maskFetch(path, method='GET', payload=null, query=null, version="v2", environment=null, privateKeyPem=null, challengeId=null) {

    let user = new getDefaultUser();
    if (!user.privateKey) {
        throw JSON.stringify({"message": "Erro de autenticação! Por favor, faça login novamente."});
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
        'User-Agent': 'App-StarkBank-GSheets-v0.8.2b',
        'User-Agent-Override': 'App-StarkBank-GSheets-v0.8.2b',        
        'PlatFormId' : 'gsheets',
        'PlatFormVersion' : '0.8.2',
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
  if (!user.privateKey) {
      throw JSON.stringify({"message": "Erro de autenticação! Por favor, faça login novamente."});
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
      'User-Agent': 'App-StarkBank-GSheets-v0.8.2b',
      'User-Agent-Override': 'App-StarkBank-GSheets-v0.8.2b',        
      'PlatFormId' : 'gsheets',
      'PlatFormVersion' : '0.8.2',
      'Accept-Language': 'pt-BR',
      'Content-Type': 'application/pdf',
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

  response = UrlFetchApp.fetch(url, options);
  let status = response.getResponseCode();

  if (status != 200) {
    return [parseResponse(response)[0]["errors"][0]["code"], status]
  } else {
    let content = response.getAs("application/pdf");
    return [content, status]
  }
}