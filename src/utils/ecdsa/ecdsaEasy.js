function easySign(message, privateKeyPem) {
  let privateKey = PrivateKey.fromPem(privateKeyPem)
  let signature = sign(message, privateKey);
  return signature.toBase64()
}

function easyVerify(message, signature, publicKeyPem) {
  let publicKey = PublicKey.fromPem(publicKeyPem)
  let signatureObject = Signature.fromBase64(signature);
  return verify(message, signatureObject, publicKey);
}

function easyMake() {
  let privateKey = new PrivateKey();
  let publicKey = privateKey.publicKey();
  return [privateKey.toPem(), publicKey.toPem()]
}
