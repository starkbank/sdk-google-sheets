var PublicKey = function(point, curve){
  this.point = point;
  this.curve = curve;
  
  this.toString = function(encoded=false) {
    let xString = BinaryAscii.stringFromNumber(this.point.x, this.curve.length());
    let yString = BinaryAscii.stringFromNumber(this.point.y, this.curve.length());
    if (encoded) {
      return "\x00\x04" + xString + yString;
    }
    return xString + yString;
  };
  
  this.toDer = function() {
    let encodeEcAndOid = Der.encodeSequence(Der.encodeOid([1, 2, 840, 10045, 2, 1]), Der.encodeOid(this.curve.oid()));
    
    return Der.encodeSequence(encodeEcAndOid, Der.encodeBitstring(this.toString(true)))
  };
  
  this.toPem = function() {
    return Der.toPem(this.toDer(), "PUBLIC KEY")
  };
};

  
PublicKey.fromPem = function(string) {
  return this.fromDer(Der.fromPem(string));
};

PublicKey.fromString = function(string, curve=EcdsaCurve.secp256k1, validatePoint=true) {
  let baseLen = curve.length();
  
  let xs = string.slice(null, baseLen);
  let ys = string.slice(baseLen);
  
  let p = new Point(BinaryAscii.numberFromString(xs), BinaryAscii.numberFromString(ys));
  
  if (validatePoint & !curve.contains(p)) {
    throw new Error("point (" + p.x + "," + p.y + ") is not valid for curve " + curve.name);
  }
  
  return new PublicKey(p, curve);
};

PublicKey.fromDer = function(string) {
  let result = Der.removeSequence(string);
  let s1 = result[0];
  let empty = result[1];
  if (empty) {
    throw new Error("trailing junk after DER public key: " + BinaryAscii.hexFromBinary(empty));
  };
  
  result = Der.removeSequence(s1);
  let s2 = result[0];
  let pointBitString = result[1];
  
  result = Der.removeObject(s2);
  let rest = result[1];
  
  result = Der.removeObject(rest);
  let oidCurve = result[0];
  empty = result[1];
  if (empty) {
    throw new Error("trailing junk after DER public key objects: " + BinaryAscii.hexFromBinary(empty));
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
  
  result = Der.removeBitString(pointBitString);
  let pointStr = result[0];
  empty = result[1];
  if (empty) {
    throw new Error("trailing junk after public key point-string: " + BinaryAscii.hexFromBinary(empty));
  };
  
  return this.fromString(pointStr.slice(2), curve);
};
