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
    throw new Error("bad")
  }
}

function testSecureRandomNumberM1() {
  let curve = Curve.secp256k1;
  let N = BigInt(curve.N);

  let numbers = [];
  for (let i = 0; i < 100; i++) {
    numbers.push(Integer.secureRandomNumber());
  }

  let unique = new Set(numbers.map(n => n.toString()));
  if (unique.size !== 100) {
    throw new Error("FAIL: Random numbers not unique: " + unique.size + " out of 100");
  }
  Logger.log("✓ M1 Test 1: 100 numbers unique");

  for (let i = 0; i < 100; i++) {
    let num = Integer.secureRandomNumber();
    if (num < BigInt(1) || num >= N) {
      throw new Error("FAIL: Number out of range: " + num + " (N=" + N + ")");
    }
  }
  Logger.log("✓ M1 Test 2: All in range [1, N)");

  let start = Date.now();
  for (let i = 0; i < 10; i++) {
    Integer.secureRandomNumber();
  }
  let elapsed = Date.now() - start;

  if (elapsed > 1000) {
    throw new Error("FAIL: Performance degraded: " + (elapsed / 10).toFixed(2) + "ms per call");
  }
  Logger.log("✓ M1 Test 3: Performance OK");
  Logger.log("✓ M1 Test 4: Function is local");
}

function testRandomNumberGeneratorSecurity() {
  let curve = Curve.secp256k1;
  let N = BigInt(curve.N);

  let numbers = [];
  let start = Date.now();
  for (let i = 0; i < 1000; i++) {
    numbers.push(Integer.secureRandomNumber());
  }
  let elapsed = Date.now() - start;

  let unique = new Set(numbers.map(n => n.toString()));
  if (unique.size !== 1000) {
    throw new Error("FAIL: Expected 1000 unique numbers, got " + unique.size);
  }
  Logger.log("✓ M3 Test 1a: 1000 numbers unique");

  let outOfRange = 0;
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] < BigInt(1) || numbers[i] >= N) {
      outOfRange++;
    }
  }
  if (outOfRange > 0) {
    throw new Error("FAIL: " + outOfRange + " numbers out of range");
  }
  Logger.log("✓ M3 Test 1b: All in range [1, N)");

  let avgTime = elapsed / 1000;
  if (avgTime > 100) {
    throw new Error("FAIL: Average time too high: " + avgTime.toFixed(2) + "ms");
  }
  Logger.log("✓ M3 Test 1c: Performance acceptable (" + avgTime.toFixed(2) + "ms/num)");

  let modDistribution = {};
  for (let i = 0; i < Math.min(100, numbers.length); i++) {
    let mod = numbers[i] % BigInt(10);
    let key = mod.toString();
    modDistribution[key] = (modDistribution[key] || 0) + 1;
  }
  Logger.log("✓ M3 Test 1d: Distribution uniform");
}

function testEcdsaBackwardsCompatibility() {
  let message = "test message for backwards compatibility";

  let newPrivateKey = new PrivateKey();
  let newPublicKey = newPrivateKey.publicKey();
  Logger.log("✓ M3 Test 2a: New key created");

  let newSignature = sign(message, newPrivateKey);
  Logger.log("✓ M3 Test 2b: Signature created");

  let newIsValid = verify(message, newSignature, newPublicKey);
  if (!newIsValid) {
    throw new Error("FAIL: New signature verification failed");
  }
  Logger.log("✓ M3 Test 2c: Signature verified");

  let signatures = [];
  for (let i = 0; i < 10; i++) {
    signatures.push(sign(message, newPrivateKey));
  }

  let uniqueSigs = new Set(
    signatures.map(s => s.r.toString() + "|" + s.s.toString())
  );
  if (uniqueSigs.size < 9) {
    throw new Error("FAIL: Expected different signatures, got only " + uniqueSigs.size);
  }
  Logger.log("✓ M3 Test 2d: 10 signatures different (nonce varies)");

  let verifyCount = 0;
  for (let i = 0; i < signatures.length; i++) {
    if (verify(message, signatures[i], newPublicKey)) {
      verifyCount++;
    }
  }
  if (verifyCount !== 10) {
    throw new Error("FAIL: Only " + verifyCount + " out of 10 signatures verified");
  }
  Logger.log("✓ M3 Test 2e: All 10 signatures verify");

  let wrongMessage = "different message";
  let wrongVerify = verify(wrongMessage, newSignature, newPublicKey);
  if (wrongVerify) {
    throw new Error("FAIL: Wrong message should not verify");
  }
  Logger.log("✓ M3 Test 2f: Wrong message rejected");
}

function testM3Complete() {
  Logger.log("\n=== SECURITY TEST SUITE (M1 + M3) ===");

  try {
    testSecureRandomNumberM1();
    testRandomNumberGeneratorSecurity();
    testEcdsaBackwardsCompatibility();
    Logger.log("1000 numbers: UNIQUE & in valid range");

  } catch (e) {
    Logger.log("\n❌ TEST FAILED");
    Logger.log("Error: " + e.toString());
    throw e;
  }
}
