let Base64 = {};

Base64.encode = function(str){
  var arr=[];
  for(var i=0; i<str.length; i++) {
    arr.push(str.charCodeAt(i))
  }
  return Utilities.base64Encode(arr);
}


Base64.decode = function(str){
  bytes = [];
  let decoded = Utilities.base64Decode(str);
  
  for (let element of decoded){
    if (element < 0){
      element += 256;
    }
    bytes.push(String.fromCharCode(element));
  }
  return bytes.join("");
};
