let Integer = {};

Integer.modulo = function(x, n) {
    let mod = x % BigInt(n);

    if (mod < BigInt(0)) {
        mod = mod + BigInt(n);
    }

    return mod;
}


Integer.secureRandomNumber = function(curve = Curve.secp256k1) {
    let N = BigInt(curve.N);

    // Apps Script does not expose a raw CSPRNG. Keep entropy inside the
    // runtime by hashing three independent values from its UUID generator,
    // documented as java.util.UUID.randomUUID(), which is SecureRandom-backed.
    // Key security rests on that platform guarantee.
    for (let attempt = 0; attempt < 100; attempt++) {
        let entropy = Utilities.getUuid() + Utilities.getUuid() +
                      Utilities.getUuid();

        let hash = Utilities.computeDigest(
            Utilities.DigestAlgorithm.SHA_256,
            entropy,
            Utilities.Charset.UTF_8
        );

        let num = BinaryAscii.numberFromHex(BinaryAscii.hexFromSignedBytes(hash));

        if (num >= BigInt(1) && num < N) {
            return num;
        }
    }

    throw new Error("Unable to generate a secure random number");
};


// RFC 6979 deterministic nonce: k is derived from the private key and the
// message hash via an HMAC-SHA256 ladder, so signing never depends on an RNG.
Integer.secureRandomNonce = function(privateKeySecret, messageHashHex, curve) {
    const N = BigInt(curve.N);

    const x = Integer._bigIntToBytes(privateKeySecret, curve.length());
    const h1 = Integer._hexToSignedBytes(messageHashHex);

    let K = new Array(32).fill(0x00);
    let V = new Array(32).fill(0x01);

    const hmacInput1 = Integer._bytesConcat(
        V,
        [0x00],
        Integer._bytesConcat(x, h1)
    );
    K = Integer._hmacSha256(K, hmacInput1);

    V = Integer._hmacSha256(K, V);

    const hmacInput2 = Integer._bytesConcat(
        V,
        [0x01],
        Integer._bytesConcat(x, h1)
    );
    K = Integer._hmacSha256(K, hmacInput2);

    V = Integer._hmacSha256(K, V);

    let counter = 0;
    const maxLoops = 1000;

    while (counter < maxLoops) {
        V = Integer._hmacSha256(K, V);

        const nonce = Integer._bytesToBigInt(V);

        if (nonce >= BigInt(1) && nonce < N) {
            return nonce;
        }

        K = Integer._hmacSha256(K, Integer._bytesConcat(V, [0x00]));
        V = Integer._hmacSha256(K, V);
        counter++;
    }

    throw new Error("RFC 6979: Failed to generate valid nonce after " + maxLoops + " attempts");
};


Integer._hmacSha256 = function(key, value) {
    // computeHmacSignature has no Blob overload: it only accepts
    // (MacAlgorithm, Byte[], Byte[]) or (MacAlgorithm, String, String).
    return Utilities.computeHmacSignature(
        Utilities.MacAlgorithm.HMAC_SHA_256,
        value,
        key
    );
};


Integer._hexToSignedBytes = function(hexString) {
    const bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
        let value = parseInt(hexString.substr(i, 2), 16);
        // Apps Script Byte[] carries signed Java bytes (-128..127)
        bytes.push(value > 127 ? value - 256 : value);
    }
    return bytes;
};


Integer._bigIntToBytes = function(num, length) {
    let hex = num.toString(16);
    while (hex.length < 2 * length) {
        hex = "0" + hex;
    }
    return Integer._hexToSignedBytes(hex);
};


Integer._bytesToBigInt = function(bytes) {
    let result = BigInt(0);
    for (let i = 0; i < bytes.length; i++) {
        result = (result << BigInt(8)) | BigInt(bytes[i] & 0xFF);
    }
    return result;
};


Integer._bytesConcat = function(...arrays) {
    return [].concat(...arrays);
};
