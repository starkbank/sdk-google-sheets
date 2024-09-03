KeyGen = {}

function encodeToBase64(input) {
    var blob = Utilities.newBlob(input)
    var encoded = Utilities.base64Encode(blob.getBytes());
    return encoded
}

function hashData(data) {
    var hashedValue = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data, Utilities.Charset.UTF_8);

    return hashedValue.reduce(function (str, byte) {
        return str + ('0' + (byte < 0 ? byte + 256 : byte).toString(16)).slice(-2);
    }, '');
}

KeyGen.hashPassword = function (password, email, environment) {
    const encodedPass = encodeToBase64(password)
    const encodedEmail = email.toLowerCase()
    var encodedSalt = ""

    if (environment == "production") {
        encodedSalt = "1fcb2ff0-e78b-4292-ae7d-80e41161025c"
    }
    if (environment == "sandbox") {
        encodedSalt = "7186ead6-55ff-42ac-87d2-f2ccdf7a2b5d"
    }
    if (environment == "development") {
        encodedSalt = "31cf81be-341f-43fa-bd75-391e0b1a3d3a"
    }

    const sha256Pass = hashData(encodedPass)
    const sha256Salt = hashData(sha256Pass + ":" + encodedSalt)
    const sha256Final = hashData(sha256Salt + ":" + encodedEmail)

    return sha256Final
}

KeyGen.cleanEmail = function (email) {
    const values = email.trim().split("@")
    if (values.length == 2) {
        const name = values[0].split("+")[0]
        const domain = values[1]
        return `${name}@${domain}`.toLowerCase()
    }
    return ""
}

KeyGen.convertToBigInt = function (hash) {
    var bigInt = BigInt("0x" + hash);

    return bigInt;
}

KeyGen.generateNewRandomKey = function () {
    var privateKey = new PrivateKey()
    return privateKey
}

KeyGen.generateKeyFromPassword = function (password, email, environment) {

    const formattedEmail = this.cleanEmail(email)
    const hash = this.hashPassword(password, formattedEmail, environment)
    const secret = this.convertToBigInt(hash)
    var privateKey = new PrivateKey(Curve.secp256k1, secret)

    return privateKey
}

KeyGen.generateSessionAccessId = function (session) {
    return "session/" + session
}

KeyGen.generateMemberAccessId = function (workspaceId, email) {
    return "workspace/" + workspaceId + "/email/" + email
}
