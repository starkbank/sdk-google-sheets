Curve = {};

Curve.CurveFp = function(A, B, P, N, Gx, Gy, name, oid){
  this.A = A;
  this.B = B;
  this.P = P;
  this.N = N;
  this.G = new Point(Gx, Gy);
  this.name = name;
  this._oid = oid;
  
  this.contains = function (p) {
    return Integer.modulo(((p.y ** BigInt(2)) - ((p.x ** BigInt(3)) + (this.A * p.x) + this.B)), this.P) == BigInt(0);
  };
  
  this.length = function () {
    return Math.floor((1 + this.N.toString(16).length) / 2);
  };
  
  this.oid = function() {
    return this._oid.slice();
  }
};

Curve.secp256k1 = new Curve.CurveFp(
    BigInt("0"),
    BigInt("7"),
    BigInt("115792089237316195423570985008687907853269984665640564039457584007908834671663"),
    BigInt("115792089237316195423570985008687907852837564279074904382605163141518161494337"),
    BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),
    BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),
    "secp256k1",
    [1, 3, 132, 0, 10]
);

Curve.supportedCurves = [Curve.secp256k1];

Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array)
        return false;

    // compare lengths - can save a lot of time 
    if (this.length != array.length)
        return false;

    for (var i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;       
        }           
        else if (this[i] != array[i]) { 
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;   
        }           
    }       
    return true;
}
