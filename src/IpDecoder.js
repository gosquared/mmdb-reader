function IpDecoder(){
  this.buf = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];

  // If we have Uint8Array (iojs) then use that for speeeeeeed
  if(typeof Uint8Array !== 'undefined'){
    this.buf = new Uint8Array(this.buf);
  }

  // Set ipVersion to something, mostly so v8 knows the property is there
  this.ipVersion = 4;
}

// Set an IP string and store it in the buffer. This method
// assumes you've already validated the IP and it's sane
IpDecoder.prototype.set = function(ip){

  // Super-naive regex test for IPv4. TODO: check IPv6-mapped IPv4
  if(/^\d+\./.test(ip)){
    this.set4(ip);
  }else{
    this.set6(ip);
  }
};

// Set an IPv4 into the buffer
IpDecoder.prototype.set4 = function(ip){
  var bits = ip.split('.');

  // Store everything in the first 4 entries of this.buf
  // IPv4 is four octets, base 10
  for(var i = 0; i < 4; i += 1){
    this.buf[i] = parseInt(bits[i], 10);
  }
  this.ipVersion = 4;
};

// Set an IPv6 into the buffer
IpDecoder.prototype.set6 = function(ip){
  var bits = ip.split(':');

  // IPv6 allows collapsing empty parts. So if we have less than we
  // expected, chuck extra colons in there to fill the gaps
  if(bits.length < 8){
    ip = ip.replace('::', Array(11 - bits.length).join(':'));
    bits = ip.split(':');
  }

  // j = index marker in buffer
  var j = 0;

  // Go through bits. IPv6 has 8 components, each 16 bits encoded as hex.
  // Each componoent maps to two octets in the buffer
  for(var i = 0; i < bits.length; i += 1){
    var x = bits[i] ? parseInt(bits[i], 16) : 0;
    this.buf[j++] = x >> 8;
    this.buf[j++] = x & 0xff;
  }
  this.ipVersion = 6;
};

// Grabs the bit at the idx'th offset in the buffer
IpDecoder.prototype.bitAt = function(idx){

  // 8 bits per octet in the buffer (>>3 is slightly faster than Math.floor(idx/8))
  var bufIdx = idx >> 3;

  // Offset within the octet (basicallg equivalent to 8  - (idx % 8))
  var bitIdx = 7 ^ (idx & 7);

  // Shift the offset rightwards by bitIdx bits and & it to grab the bit
  return (this.buf[bufIdx] >>> bitIdx) & 1;
};

module.exports = IpDecoder;
