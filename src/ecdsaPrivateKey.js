PrivateKey = function(curve=Curve.secp256k1, secret=null) {
  this.curve = curve;
  if (secret) {
    this.secret = secret;
  } else {
    this.secret = Integer.secureRandomNumber();
  }
  
  this.publicKey = function() {
    let curve = this.curve;
    let publicPoint = EcdsaMath.multiply(curve.G, this.secret, curve.N, curve.A, curve.P);
    return new PublicKey(publicPoint, curve);
  };
  
  
  this.toString = function() {
    return BinaryAscii.stringFromNumber(this.secret, this.curve.length());
  };
  
  
  this.toDer = function () {
    let encodedPublicKey = this.publicKey().toString(true);
    
    return Der.encodeSequence(
      Der.encodeInteger(BigInt(1)),
      Der.encodeOctetString(this.toString()),
      Der.encodeConstructed(0, Der.encodeOid(this.curve.oid())),
      Der.encodeConstructed(1, Der.encodeBitstring(encodedPublicKey))
    );
  }
  
  this.toPem = function() {
    return Der.toPem(this.toDer(), "EC PRIVATE KEY");
  };
};


PrivateKey.fromPem = function(string) {
  let privateKeyPem = string.split("-----BEGIN EC PRIVATE KEY-----")[1];
  return this.fromDer(Der.fromPem(privateKeyPem));
};


PrivateKey.fromString = function(string, curve=EcdsaCurve.secp256k1) {
  return new PrivateKey(curve, BinaryAscii.numberFromString(string));
};


PrivateKey.fromDer = function(string) {
  let result = Der.removeSequence(string);
  let t = result[0];
  let empty = result[1];
  if (empty) {
    throw new Error("trailing junk after DER private key: " + BinaryAscii.hexFromBinary(empty));
  };
  
  result = Der.removeInteger(t);
  let one = result[0];
  t = result[1];
  if (one != 1) {
    throw new Error("expected '1' at start of DER private key, got " + one);
  };
  
  result = Der.removeOctetString(t);
  let privateKeyStr = result[0];
  t = result[1];
  
  result = Der.removeConstructed(t);
  let tag = result[0];
  let curveOidStr = result[1];
  t = result[2];
  
  if (tag != 0) {
    throw new Error("expected tag 0 in DER private key, got " + tag);
  };
  
  result = Der.removeObject(curveOidStr);
  let oidCurve = result[0];
  empty = result[1];
  
  if (empty) {
    throw new Error("trailing junk after DER private key curve_oid: " + BinaryAscii.hexFromBinary(empty));
  };
  
  let curve = Curve.secp256k1;
  
  if (!curve._oid.equals(oidCurve)) {
    let supportedCurvesNames = [];
    Curve.supportedCurves.forEach((x) => {supportedCurvesNames.push(x.name)})
    throw new Error(
      "Unknown curve with oid " + oidCurve
      + ". Only the following are available: " + supportedCurvesNames
    );
  };

  if (privateKeyStr.length < curve.length()) {
    privateKeyStr = hexAt.repeat(curve.length() - privateKeyStr.length) + privateKeyStr;
  };
  return this.fromString(privateKeyStr, curve);
};