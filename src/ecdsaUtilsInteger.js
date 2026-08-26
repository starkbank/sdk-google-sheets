let Integer = {};

Integer.modulo = function(x, n) {
    let mod = x % BigInt(n);

    if (mod < BigInt(0)) {
        mod = mod + BigInt(n);
    }

    return mod;
}


Integer.secureRandomNumber = function() {
    let curve = Curve.secp256k1;
    let N = BigInt(curve.N);

    // Apps Script does not expose a raw CSPRNG. Keep entropy inside the
    // runtime by hashing three independent values from its UUID generator.
    for (let attempt = 0; attempt < 100; attempt++) {
        let entropy = Utilities.getUuid() + Utilities.getUuid() +
                      Utilities.getUuid();

        let hash = Utilities.computeDigest(
            Utilities.DigestAlgorithm.SHA_256,
            entropy,
            Utilities.Charset.UTF_8
        );

        let hex = hash.map(byte => {
            let v = (byte < 0) ? 256 + byte : byte;
            return ("0" + v.toString(16)).slice(-2);
        }).join("");

        let num = BigInt("0x" + hex);

        if (num >= BigInt(1) && num < N) {
            return num;
        }
    }

    throw new Error("Unable to generate a secure random number");
};


Integer._secp256k1_N = BigInt("115792089237316195423570985008687907852837564279074904382605163141518161494337");

Integer._bytesToBigInt = function(bytes) {
    let result = BigInt(0);
    for (let i = 0; i < bytes.length; i++) {
        result = (result << BigInt(8)) | BigInt(bytes[i] & 0xFF);
    }
    return result;
};

Integer._hmacSha256 = function(key, value) {
    const keyBlob = Utilities.newBlob(key);
    const valueBlob = Utilities.newBlob(value);

    const signature = Utilities.computeHmacSignature(
        Utilities.HmacAlgorithm.HMAC_SHA_256,
        valueBlob,
        keyBlob
    );

    if (typeof signature === 'string') {
        return signature.split('').map(c => c.charCodeAt(0));
    }
    return Array.from(signature);
};

Integer._hexStringToBytes = function(hexString) {
    const bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
        bytes.push(parseInt(hexString.substr(i, 2), 16));
    }
    return bytes;
};

Integer.secureRandomNonce = function(privateKeySecret, messageHashHex) {
    const N = Integer._secp256k1_N;

    const x = Integer._bigIntToBytes(privateKeySecret, 32);
    const h1 = Integer._hexStringToBytes(messageHashHex);

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

Integer._bigIntToBytes = function(num, length) {
    const bytes = [];
    for (let i = length - 1; i >= 0; i--) {
        bytes.push(Number((num >> BigInt(i * 8)) & BigInt(0xFF)));
    }
    return bytes;
};

Integer._bytesConcat = function(...arrays) {
    return [].concat(...arrays);
};
