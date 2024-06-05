function sign(message, privateKey) {
    let numberMessage = BinaryAscii.numberFromHex(hash(message));
    let curve = privateKey.curve;
    let randNum = Integer.secureRandomNumber();
    let randSignPoint = EcdsaMath.multiply(curve.G, randNum, curve.N, curve.A, curve.P);
    let r = Integer.modulo(randSignPoint.x, curve.N);
    let sum = (numberMessage + (BigInt(r) * (privateKey.secret)));
    let s = Integer.modulo(sum * EcdsaMath.inv(randNum, curve.N), curve.N);
    return new Signature(r, s);
};


function verify(message, signature, publicKey) {
    let numberMessage = BinaryAscii.numberFromHex(hash(message));
    let curve = publicKey.curve;
    let sigR = signature.r;
    let sigS = signature.s;
    let inv = EcdsaMath.inv(sigS, curve.N);
    let u1 = EcdsaMath.multiply(curve.G, Integer.modulo((numberMessage * (inv)), curve.N), curve.N, curve.A, curve.P);
    let u2 = EcdsaMath.multiply(publicKey.point, Integer.modulo((sigR * (inv)), curve.N), curve.N, curve.A, curve.P);
    let add = EcdsaMath.add(u1, u2, curve.A, curve.P);
    return sigR == add.x;
};


function hash(message){
  let signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, message);
  return signature.map(function(byte) {
    var v = (byte < 0) ? 256 + byte : byte;
    return ("0" + v.toString(16)).slice(-2);
  }).join("");
};
