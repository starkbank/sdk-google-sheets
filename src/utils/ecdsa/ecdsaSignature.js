var Signature = function(r, s) {
  this.r = r;
  this.s = s;
  
  this.toDer = function() {
    return Der.encodeSequence(Der.encodeInteger(this.r), Der.encodeInteger(this.s));
  }
  
  this.toBase64 = function() {
    return Base64.encode(this.toDer());
  }
}

Signature.fromDer = function(string) {
  let result = Der.removeSequence(string);
  let rs = result[0];
  let empty = result[1];
  if (empty) {
    throw new Error("trailing junk after DER signature: " + BinaryAscii.hexFromBinary(empty));
  }
  
  result = Der.removeInteger(rs);
  let r = result[0];
  let rest = result[1];
  
  result = Der.removeInteger(rest);
  let s = result[0];
  empty = result[1];
  
  if (empty) {
    throw new Error("trailing junk after DER numbers: " + BinaryAscii.hexFromBinary(empty));
  }
  
  return new Signature(r, s)
}

Signature.fromBase64 = function(string) {
  let derString = Base64.decode(string);
  return Signature.fromDer(derString);
}
