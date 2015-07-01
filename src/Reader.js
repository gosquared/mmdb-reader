var fs = require('fs');
var IpDecoder = require('./IpDecoder');
var LRU = require('./LRUCache')


function concat2(a, b){
  return (a<<8) | b;
}

function concat3(a, b, c){
  return (a<<16) | (b<<8) | c;
}

function concat4(a, b, c, d){
  return (a<<24) | (b<<16) | (c<<8) | d;
}


function Reader(buf){

  if(!(this instanceof Reader)){
    return new Reader(buf);
  }

  if(typeof buf === 'string'){
    buf = fs.readFileSync(buf);
  }

  this._buf = buf;

  var metaPosition = this.findMetaPosition();
  this.metadata = this.readData(metaPosition).value;

  this.setRecordSize(this.metadata.record_size);
  this.recordSize = this.metadata.record_size;
  this.nodeSize = this.recordSize / 4;
  this.numNodes = this.metadata.node_count;
  this.dataStart = this.numNodes * this.nodeSize + 16;
  this.ip = new IpDecoder();
  this.findIPv4StartPointer();

  this._pointerCache = new LRU(5000); // 5000 seems to be roughly the sweet spot between mem vs hit-rate
}

Reader.open = function(file, cb){
  fs.readFile(file, function(err, buf){
    if(err) return cb(err);
    cb(err, new Reader(buf));
  });
};

Reader.openSync = Reader;


Reader.prototype._read = function(ptr){
  return this._buf[ptr];
};

Reader.prototype._readBuffer = function(ptr, len){
  return this._buf.slice(ptr, ptr + len);
}

Reader.prototype._read32 = function(ptr){
  return this._buf.readUInt32BE(ptr);
}

Reader.prototype._readUTF8 = function(ptr, len){
  return this._buf.toString('utf8', ptr, ptr + len);
};

Reader.prototype._readDouble = function(ptr){
  return this._buf.readDoubleBE(ptr);
};

Reader.prototype._readFloat = function(ptr){
  return this._buf.readFloatBE(ptr);
}

Reader.prototype.findMetaPosition = function(){
  var metaMarker = 'abcdef4d61784d696e642e636f6d';
  var buf = this._buf;

  for(var metaPosition = buf.length; ; metaPosition--) {
    if(buf.toString('hex', metaPosition - metaMarker.length / 2, metaPosition) === metaMarker) break;
  }

  return metaPosition;
};

Reader.prototype.readData = function(ptr){
  var control = this.readDataType(ptr);
  ptr = control.ptr;

  switch(control.type){
  case 1: // pointer
    return this.readPointer(control);
  case 2: // string
    return this.readString(control);
  case 3: // double
    return this.readDouble(control);
  case 4: // bytes
    return this.readBytes(control);
  case 5: // uint16
    return this.readUInt16(control);
  case 6: // uint32
    return this.readUInt32(control);
  case 7: // map
    return this.readMap(control);
  case 8: // int32
    return this.readInt32(control);
  case 9: // uint64
    return this.readUInt64(control);
  case 10: // uint128
    return this.readUInt128(control);
  case 11: // array
    return this.readArray(control);
  case 14: // bool
    return this.readBoolean(control);
  case 15: // float
    return this.readFloat(control);
  default:
    throw "UNIMPLEMENTED " + control.type;
  }
};

Reader.prototype.cachedRead = function(ptr){
  var cached = this._pointerCache.get(ptr);
  if(cached) return cached;
  var d = this.readData(ptr);
  this._pointerCache.set(ptr, d);
  return d;
};

Reader.prototype.readDataType = function(ptr){
  var cbyte = this._read(ptr++);
  var type = cbyte >> 5;

  if(type === 0){
    type = this._read(ptr++) + 7;
  }

  var sizeMarker = cbyte & 0x1f; // 00011111

  if(type === 1){ // pointers are different
    return { type: type, size: sizeMarker, ptr: ptr };
  }

  if(sizeMarker < 29){
    return { type: type, size: sizeMarker, ptr: ptr };
  }
  if(sizeMarker === 29){
    return { type: type, size: 29 + this._read(ptr++), ptr: ptr };
  }
  if(sizeMarker === 30){
    return { type: type, size: 285 + concat2(this._read(ptr++), this._read(ptr++)), ptr: ptr };
  }
  if(sizeMarker === 31){
    return { type: type, size: 65821 + concat3(this._read(ptr++), this._read(ptr++), this._read(ptr++)), ptr: ptr };
  }
};

Reader.prototype.readPointer = function(control){
  var size = control.size;
  var ptr = control.ptr;
  var ptrSize = size >> 3;
  var baseSize = size & 0x7;

  var addr = 0;

  if(ptrSize === 0){
    addr = concat2(baseSize, this._read(ptr++));
  }
  if(ptrSize === 1){
    addr = concat3(baseSize, this._read(ptr++), this._read(ptr++)) + 2048;
  }
  if(ptrSize === 2){
    addr = concat4(baseSize, this._read(ptr++), this._read(ptr++), this._read(ptr++)) + 526336;
  }
  if(ptrSize === 3){
    addr = concat4(this._read(ptr++), this._read(ptr++), this._read(ptr++), this._read(ptr++));
  }

  var d = this.cachedRead(addr + this.dataStart);
  return { value: d.value, ptr: ptr };
};

Reader.prototype.readString = function(control){
  var length = control.size;
  var ptr = control.ptr;

  var str = this._readUTF8(ptr, length);
  ptr += length;

  return { value: str, ptr: ptr };
};

Reader.prototype.readDouble = function(control){
  var ptr = control.ptr;
  var val = this._readDouble(ptr);
  ptr += 8;

  return { value: val, ptr: ptr };
};

Reader.prototype.readBytes = function(control){
  var ptr = control.ptr;
  var length = control.size;

  var val = this._readBuffer(ptr, length);
  ptr += length;

  return { value: val, ptr: ptr };
}

Reader.prototype.readUInt16 = function(control){
  var size = control.size;
  var ptr = control.ptr;

  if(size === 0){
    return { value: 0, ptr: ptr };
  }
  if(size === 1){
    return { value: this._read(ptr++), ptr: ptr };
  }

  var val = concat2(this._read(ptr++), this._read(ptr++));

  return { value: val, ptr: ptr };
};

Reader.prototype.readUInt32 = function(control){
  var size = control.size;
  var ptr = control.ptr;
  var val = 0;

  if(size === 4){ // js will read as signed below otherwise
    val = this._read32(ptr);
  }else{
    for(var i = 0; i < size; i++){
      val |= this._read(ptr + size - i - 1) << (i * 8);
    }
  }

  ptr += size;

  return { value: val, ptr: ptr };
};

Reader.prototype.readMap = function(control){
  var mapLength = control.size;

  var ptr = control.ptr;

  var obj = {};

  for(var i = 0; i < mapLength; i++){
    var k = this.readData(ptr);
    var key = k.value;
    ptr = k.ptr;

    var v = this.readData(ptr);
    var value = v.value;
    ptr = v.ptr;
    obj[key] = value;
  }

  return { value: obj, ptr: ptr };
};

Reader.prototype.readInt32 = function(control){
  var size = control.size;
  var ptr = control.ptr;
  var val = 0;

  for(var i = 0; i < size; i++){
    val |= this._read(ptr + size - i - 1) << (i * 8);
  }

  ptr += size;

  return { value: val, ptr: ptr };
}

Reader.prototype.readUInt64 = function(control){
  var size = control.size;
  var hi = 0;
  var lo = 0;
  var ptr = control.ptr;

  for(var i = 0; i < size; i++){
    if(i < 4){
      lo |= this._read(ptr + size - i - 1) << (i * 8);
    }else{
      hi |= this._read(ptr + size - i - 1) << (i * 8 - 32);
    }
  }

  ptr += size;

  return { value: { hi: hi, lo: lo, t: 64 }, ptr: ptr };
};

Reader.prototype.readUInt128 = function(control){
  var size = control.size;
  var cpts = [ 0, 0, 0, 0 ];
  var ptr = control.ptr;

  for(var i = 0; i < size; i++){
    cpts[0|i/32] |= this._read(ptr + size - (i % 32) - 1) << (i * 8);
  }

  ptr += size;

  return { value: { c: cpts, t: 128 }, ptr: ptr };
};

Reader.prototype.readArray = function(control){
  var size = control.size;
  var ptr = control.ptr;

  var out = [];

  for(var i = 0; i < size; i++){
    var v = this.readData(ptr);
    out[i] = v.value;
    ptr = v.ptr;
  }

  return { value: out, ptr: ptr };
};

Reader.prototype.readBoolean = function(control){
  return { value: control.size > 0, ptr: control.ptr };
};

Reader.prototype.readFloat = function(control){
  var ptr = control.ptr;

  var val = this._readFloat(ptr);
  ptr += 4;

  return { value: val, ptr: ptr };
}

Reader.prototype.setRecordSize = function(size){
  switch(size){
  case 24:
    this.readLeft = this.readLeft24;
    this.readRight = this.readRight24;
    break;
  case 28:
    this.readLeft = this.readLeft28;
    this.readRight = this.readRight28;
    break;
  case 32:
    this.readLeft = this.readLeft32;
    this.readRight = this.readRight32;
    break;
  }
};

Reader.prototype.readLeft24 = function(idx){
  return concat3(this._read(idx++), this._read(idx++), this._read(idx++));
};

Reader.prototype.readRight24 = function(idx){
  idx += 3;
  return concat3(this._read(idx++), this._read(idx++), this._read(idx++));
};

Reader.prototype.readLeft28 = function(idx){
  return concat4(
    this._read(idx+3) >> 4,
    this._read(idx++),
    this._read(idx++),
    this._read(idx++)
  );
};

Reader.prototype.readRight28 = function(idx){
  idx += 3;
  return concat4(
    this._read(idx++) & 0x0f,
    this._read(idx++),
    this._read(idx++),
    this._read(idx++)
  );
};

Reader.prototype.readLeft32 = function(idx){
  return this._read32(idx);
};

Reader.prototype.readRight32 = function(idx){
  return this._read32(idx + 4);
};

Reader.prototype.findIPv4StartPointer = function(){
  var ptr = 0;

  if(this.metadata.ip_version === 6){
    for(var i = 0; i < 96; i++){
      var record = this.readLeft(ptr);
      ptr = record * this.recordSize / 4;
    }
  }
  this.ipv4StartPointer = ptr;
};

Reader.prototype.lookup = function(ip){
  this.ip.set(ip);

  var numBits = 128;
  var ptr = 0;

  if(this.ip.ipVersion === 4){
    numBits = 32;
    ptr = this.ipv4StartPointer;
  }

  for(var i = 0; i < numBits; i++){
    var bit = this.ip.bitAt(i);

    var record;

    if(bit === 0){
      record = this.readLeft(ptr);
    }else{
      record = this.readRight(ptr);
    }

    if(record < this.numNodes){
      ptr = record * this.nodeSize;
      continue;
    }

    if(record === this.numNodes){
      return null;
    }

    return this.cachedRead((record - this.numNodes) + this.dataStart - 16).value;
  }
};

module.exports = Reader;
