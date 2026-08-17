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

    while (true) {
        let entropy = Utilities.getUuid() + Utilities.getUuid() +
                      Utilities.getUuid() + Date.now();

        let hash = Utilities.computeDigest(
            Utilities.DigestAlgorithm.SHA_256,
            entropy
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
};