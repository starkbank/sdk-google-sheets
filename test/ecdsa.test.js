const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sourceFiles = [
  "ecdsaPoint.js",
  "ecdsaUtilsInteger.js",
  "ecdsaCurve.js",
  "ecdsaMath.js",
  "ecdsaUtilsBinary.js",
  "ecdsaUtilsBase.js",
  "ecdsaUtilsDer.js",
  "ecdsaPublicKey.js",
  "ecdsaPrivateKey.js",
  "ecdsaSignature.js",
  "ecdsa.js",
  "ecdsaEasy.js",
];

function signedBytes(buffer) {
  return Array.from(buffer, byte => byte > 127 ? byte - 256 : byte);
}

function assertSignedByteArray(bytes) {
  assert.ok(Array.isArray(bytes));
  assert.ok(bytes.every(byte => Number.isInteger(byte) && byte >= -128 && byte <= 127));
}

const digestCharsets = [];
const context = vm.createContext({
  console,
  Utilities: {
    Charset: {UTF_8: "UTF_8"},
    DigestAlgorithm: {SHA_256: "SHA_256"},
    MacAlgorithm: {HMAC_SHA_256: "HMAC_SHA_256"},
    getUuid: crypto.randomUUID,
    computeDigest(algorithm, value, charset) {
      assert.equal(algorithm, "SHA_256");
      digestCharsets.push(charset);
      return signedBytes(crypto.createHash("sha256").update(value).digest());
    },
    computeHmacSignature(algorithm, value, key) {
      assert.equal(algorithm, "HMAC_SHA_256");
      assertSignedByteArray(value);
      assertSignedByteArray(key);
      return signedBytes(
        crypto.createHmac("sha256", Buffer.from(key)).update(Buffer.from(value)).digest()
      );
    },
    base64Encode(value) {
      let bytes = typeof value === "string" ? Buffer.from(value, "binary") : Buffer.from(value);
      return bytes.toString("base64");
    },
    base64Decode(value) {
      return signedBytes(Buffer.from(value, "base64"));
    },
  },
});

for (const file of sourceFiles) {
  const filename = path.join(root, "src", file);
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, {filename});
}

function run(expression) {
  return vm.runInContext(expression, context);
}

const applicationSources = fs.readdirSync(path.join(root, "src"))
  .filter(file => file.endsWith(".js"))
  .map(file => fs.readFileSync(path.join(root, "src", file), "utf8"))
  .join("\n");
assert.doesNotMatch(applicationSources, /ellipticCurveMath|cloudfunctions\.net/);

const curveOrder = run("Curve.secp256k1.N");
const randomNumbers = run("Array.from({length: 1000}, () => Integer.secureRandomNumber())");
assert.equal(new Set(randomNumbers.map(String)).size, randomNumbers.length);
assert.ok(randomNumbers.every(number => number >= 1n && number < curveOrder));

const infinity = run(`(() => {
  const curve = Curve.secp256k1;
  const negG = new Point(curve.G.x, Integer.modulo(-curve.G.y, curve.P));
  return EcdsaMath.add(curve.G, negG, curve.A, curve.P);
})()`);
assert.equal(infinity.x, 0n);
assert.equal(infinity.y, 0n);

const vectorMessageHash = crypto.createHash("sha256").update("Satoshi Nakamoto").digest("hex");
const vectorNonce = run(
  `Integer.secureRandomNonce(BigInt(1), "${vectorMessageHash}", Curve.secp256k1).toString(16)`
);
assert.equal(vectorNonce, "8f8a276c19f4149656b280621e358cce24f5f52542772691ee69063b74f15d15");

const keys = run("easyMake()");
const privateKeyPem = keys[0];
const publicKeyPem = keys[1];
context.testPrivateKeyPem = privateKeyPem;
context.testPublicKeyPem = publicKeyPem;
context.testMessage = "SDK Google Sheets ECDSA interoperability";

const signatures = run(`Array.from(
  {length: 10},
  () => easySign(testMessage, testPrivateKeyPem)
)`);
assert.equal(new Set(signatures).size, 1);
const differentMessageSignature = run("easySign(testMessage + '?', testPrivateKeyPem)");
assert.notEqual(differentMessageSignature, signatures[0]);
assert.ok(signatures.every(signature => crypto.verify(
  "sha256",
  Buffer.from(context.testMessage),
  publicKeyPem,
  Buffer.from(signature, "base64")
)));

context.nodeSignature = crypto.sign(
  "sha256",
  Buffer.from(context.testMessage),
  privateKeyPem
).toString("base64");
assert.equal(run("easyVerify(testMessage, nodeSignature, testPublicKeyPem)"), true);
assert.equal(run("easyVerify(testMessage + '!', nodeSignature, testPublicKeyPem)"), false);

assert.ok(digestCharsets.length > 0);
assert.ok(digestCharsets.every(charset => charset === "UTF_8"));

run(`
  Utilities.computeDigest = function() {
    return Array(32).fill(0);
  };
`);
assert.throws(
  () => run("Integer.secureRandomNumber()"),
  /Unable to generate a secure random number/
);

console.log("ECDSA security and interoperability tests passed");
