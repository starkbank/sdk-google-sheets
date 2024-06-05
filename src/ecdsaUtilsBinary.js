let BinaryAscii = {};

BinaryAscii.hexFromBinary = function (str) {
  let arr = [];
  for (let i = 0, l = str.length; i < l; i ++) {
    let hex = Number(str.charCodeAt(i)).toString(16);
    if (hex.length == 1) {
      arr.push('0');
    }
    arr.push(hex);
  }
  return arr.join('');
}


BinaryAscii.binaryFromHex = function(hex){
    let hexString = hex.toString();
    let str = '';
    for (let i = 0; (i < hexString.length); i += 2)
        str += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
    return str;
}


BinaryAscii.numberFromString = function (string) {
    return BinaryAscii.numberFromHex(BinaryAscii.hexFromBinary(string.toString()));
}


BinaryAscii.numberFromHex = function (string) {
    return BigInt("0x" + string)
}


BinaryAscii.stringFromNumber = function (number, length) {
    let result = number.toString(16);

    while (result.length < 2 * length) {
        result = "0" + result;
    }

    return BinaryAscii.binaryFromHex(result);
}
