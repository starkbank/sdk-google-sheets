
function Response(status, content) {
  this.status = status;
  this.content = content;
}

function getHostname(environment, version = "v1"){
  return {
    'production': 'https://api.starkbank.com/' + version,
    'sandbox': 'https://sandbox.api.starkbank.com/' + version
  }[environment.toLowerCase()];
}



function fetch(path, method='GET', payload=null, query=null, version='v1', environment=null, privateKeyPem=null) {
  let user = new getDefaultUser();
  if (!user.accessToken && (path != "/auth/access-token")) {
    throw JSON.stringify({"message": "Erro de autenticação! Por favor, faça login novamente."});
  }
  if (!environment)
    environment = environment || user.environment.toLowerCase();
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
  options['headers'] = {
    'Access-Token': user.accessToken,
    'User-Agent': 'GoogleSheets-SDK-0.1.0',
    'Accept-Language': 'pt-BR',
    'Content-Type': 'application/json'
  };
  if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options['payload'] = JSON.stringify(payload);
    if(privateKeyPem != null)
    {
      let signature = ecdsags.easySign(options['payload'], privateKeyPem);
      options['headers']['Digital-Signature'] = signature;
    }
  }


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
}

function fetchBuffer (path, method = 'GET', payload = null, query = null, version = 'v1') {
  let user = new getDefaultUser();
  let hostname = getHostname(user.environment.toLowerCase(), version);
  
  let options = {
    method: method,
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
  Logger.log(url);
  options['headers'] = {
    'Access-Token': user.accessToken,
    'User-Agent': 'GoogleSheets-SDK-0.1.0',
    'Content-Type': 'application/json'
  };
  let response = UrlFetchApp.fetch(url, options);
  let content = response.getAs("application/pdf");
  console.log(content);
  let status = response.getResponseCode();
  switch (status) {
    case 200:
      return new Response(status, content);
    case 400:
    case 404:
    case 500:
      throw new Error(JSON.parse(content)["error"]["message"]);
    default:
      throw e;
  }
  return new Response(status, content);
}

function fetchMath(){
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
    headers: {'Content-Type': 'Application/json'}
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