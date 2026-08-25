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
