EcdsaMath = {};

EcdsaMath.multiply = function (p, n, N, A, P) {
    return EcdsaMath.fromJacobian(EcdsaMath.jacobianMultiply(EcdsaMath.toJacobian(p), n, N, A, P), P);
};


EcdsaMath.add = function (p, q, A, P) {
    return EcdsaMath.fromJacobian(EcdsaMath.jacobianAdd(EcdsaMath.toJacobian(p), EcdsaMath.toJacobian(q), A, P), P);
};


EcdsaMath.inv = function (x, n) {
    if (x == BigInt(0)) {
        return BigInt(0);
    };

    let lm = BigInt(1);
    let hm = BigInt(0);

    let low = Integer.modulo(x, n);
    let high = n;
    let r, nm, newLow;

    while (low > (1)) {
        r = high / (low);

        nm = hm - (lm * (r));
        newLow = high - (low * (r));

        high = low;
        hm = lm;
        low = newLow;
        lm = nm;
    };

    return Integer.modulo(lm, n);
};


EcdsaMath.toJacobian = function (p) {
    return new Point(p.x, p.y, BigInt(1));
};


EcdsaMath.fromJacobian = function (p, P) {
    z = EcdsaMath.inv(p.z, P);

    let jacobianPoint = new Point(
        Integer.modulo(p.x * (z ** BigInt(2)), P),
        Integer.modulo(p.y * (z ** BigInt(3)), P)
    );

    return jacobianPoint;
};


EcdsaMath.jacobianDouble = function (p, A, P) {
    if (!p.y) {
        return new Point(BigInt(0), BigInt(0), BigInt(0));
    };
    let ysq = Integer.modulo((p.y ** BigInt(2)), P);
    let S = Integer.modulo((p.x * (ysq) * BigInt(4)), P);
    let M = Integer.modulo((((p.x ** BigInt(2)) * BigInt(3)) + (A * (p.z ** BigInt(4)))), P);
    let nx = Integer.modulo(((M ** BigInt(2)) - (S * BigInt(2))), P);
    let ny = Integer.modulo((M * (S - (nx)) - ((ysq ** BigInt(2)) * BigInt(8))), P);
    let nz = Integer.modulo((p.y * (p.z) * BigInt(2)), P);

    return new Point(nx, ny, nz);
};


EcdsaMath.jacobianAdd = function (p, q, A, P) {
    if (!p.y) {
        return q;
    };
    if (!q.y) {
        return p;
    };

    U1 = Integer.modulo(p.x * (q.z ** BigInt(2)), P);
    U2 = Integer.modulo(q.x * (p.z ** BigInt(2)), P);
    S1 = Integer.modulo(p.y * (q.z ** BigInt(3)), P);
    S2 = Integer.modulo(q.y * (p.z ** BigInt(3)), P);

    if (U1 == U2) {
        if (S1 != S2) {
            return Point(BigInt(0), BigInt(0), BigInt(1));
        };
        return EcdsaMath.jacobianDouble(p, A, P);
    };

    H = U2 - (U1);
    R = S2 - (S1);
    H2 = Integer.modulo((H * (H)), P);
    H3 = Integer.modulo((H * (H2)), P);
    U1H2 = Integer.modulo((U1 * (H2)), P);
    nx = Integer.modulo(((R ** BigInt(2)) - (H3) - (U1H2 * BigInt(2))), P);
    ny = Integer.modulo((R * (U1H2 - (nx)) - (S1 * (H3))), P);
    nz = Integer.modulo((H * (p.z) * (q.z)), P);

    return new Point(nx, ny, nz);
};


EcdsaMath.jacobianMultiply = function (p, n, N, A, P) {
    if (p.y == BigInt(0) | n == BigInt(0)) {
        return new Point(BigInt(0), BigInt(0), BigInt(1));
    };
    if (n == BigInt(1)) {
        return p;
    };
    if (n < BigInt(0) | n >= (N)) {
        return EcdsaMath.jacobianMultiply(p, Integer.modulo(n, N), N, A, P);
    };
    if (Integer.modulo(n, 2) == BigInt(0)) {
        return EcdsaMath.jacobianDouble(EcdsaMath.jacobianMultiply(p, n/BigInt(2), N, A, P), A, P);  // bigint division floors result automaticaly
    };
    if (Integer.modulo(n, 2) == BigInt(1)) {
        return EcdsaMath.jacobianAdd(EcdsaMath.jacobianDouble(EcdsaMath.jacobianMultiply(p, n/BigInt(2), N, A, P), A, P), p, A, P);  // bigint division floors result automaticaly
    };

    throw new Error("logical failure: p: " + p + ", n: " + n + ", N: " + N + ", A: " + A + ", P: " + P);
};
