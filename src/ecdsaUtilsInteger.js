let Integer = {};

Integer.modulo = function(x, n) {
    let mod = x % BigInt(n);

    if (mod < BigInt(0)) {
        mod = mod + BigInt(n);
    }

    return mod;
}


Integer.secureRandomNumber = function() {
    let url = "https://us-central1-api-ms-auth-sbx.cloudfunctions.net/ellipticCurveMath";
    let payload = {
      "Gx": "55066263022277343669578718895168534326250603453777594175500187360389116729240",
      "Gy": "32670510020758816978083085130507043184471273380659243275938904335757337482424",
      "A": "0",
      "P": "115792089237316195423570985008687907853269984665640564039457584007908834671663",
      "N": "115792089237316195423570985008687907852837564279074904382605163141518161494337"
    };
    let options = {
      'method': 'post',
      'payload': JSON.stringify(payload),
      'headers': {'Content-Type': 'Application/json'}
    };
    let response;
    let content;
    let status;
    try {
      response = UrlFetchApp.fetch(url, options);
      content = response.getContentText();
      status = response.getResponseCode();
    } catch (e) {
      if (!e.response) {
        throw e;
      }
      content = e.response.body;
      status = e.response.statusCode;
      switch (status) {
        case 400:
        case 404:
          throw new error.InputErrors(content, status);
        case 500:
          throw new error.InternalServerError(content, status);
        default:
          throw e;
      }
    }
    let mathJson = JSON.parse(content);
    let randNum = BigInt(mathJson['randNum']);
    return randNum;
};