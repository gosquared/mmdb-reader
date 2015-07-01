function IpDecoder(){
  this.buf = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];

  if(typeof Uint8Array !== 'undefined'){
    this.buf = new Uint8Array(this.buf);
  }

  this.ipVersion = 4;
}

IpDecoder.prototype.set = function(ip){
  if(/^\d+\./.test(ip)){
    this.set4(ip);
  }else{
    this.set6(ip);
  }
};

IpDecoder.prototype.set4 = function(ip){
  var bits = ip.split('.');
  for(var i = 0; i < 4; i += 1){
    this.buf[i] = parseInt(bits[i], 10);
  }
  this.ipVersion = 4;
};

IpDecoder.prototype.set6 = function(ip){
  var bits = ip.split(':');
  if(bits.length < 8){
    ip = ip.replace('::', Array(11 - bits.length).join(':'));
    bits = ip.split(':');
  }
  var j = 0;
  for(var i = 0; i < bits.length; i += 1){
    var x = bits[i] ? parseInt(bits[i], 16) : 0;
    this.buf[j++] = x >> 8;
    this.buf[j++] = x & 0xff;
  }
  this.ipVersion = 6;
};

IpDecoder.prototype.bitAt = function(idx){
  var bufIdx = idx >> 3;
  var bitIdx = 7 ^ (idx & 7);
  return (this.buf[bufIdx] >>> bitIdx) & 1;
};

module.exports = IpDecoder;
