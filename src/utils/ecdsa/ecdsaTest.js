function test() {
  let keys = easyMake();
  let privateKeyPem = keys[0];
  let publicKeyPem = keys[1];
  
  let message = "mas que bela batata!";
  let nessage = "mas que belas batatas!";
  let signature = easySign(message, privateKeyPem);
  
  let right = easyVerify(message, signature, publicKeyPem);
  let wrong = easyVerify(nessage, signature, publicKeyPem);
  
  console.log("right: " + right);
  console.log("wrong: " + wrong);
  
  if (wrong || !right) {
    console.log(privateKeyPem)
    console.log(publicKeyPem)
    console.log(signature)
    throw new Error("bad")
  }
}
