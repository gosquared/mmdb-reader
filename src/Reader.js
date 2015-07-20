var fs = require('fs');
var IpDecoder = require('./IpDecoder');
var LRU = require('./LRUCache');
var bigInteger = require('big-integer');


// Few helper functions for combining bytes into numbers.
// V8 will inline these so perf is same as if we wrote them out in full

function concat2(a, b){
  return (a << 8) | b;
}

function concat3(a, b, c){
  return (a << 16) | (b << 8) | c;
}

function concat4(a, b, c, d){
  return (a << 24) | (b << 16) | (c << 8) | d;
}


// Main reader constructor
function Reader(buf, filePath){

  // Allow instantiating without `new`
  if(!(this instanceof Reader)){
    return new Reader(buf);
  }

  // Allow passing either a path to a file or a raw buffer
  if(typeof buf === 'string'){
    filePath = buf;
    buf = fs.readFileSync(buf);
  }

  // LRU cache that'll hold objects we read from the data section.
  // 5000 seems to be roughly the sweet spot between mem vs hit-rate
  this._pointerCache = new LRU(5000);

  this._buf = buf;

  // Stash the file path for if we want to reload it later
  this.filePath = filePath;

  this.setup();
}

// .open() method for asynchronously reading file
Reader.open = function(file, cb){
  fs.readFile(file, function(err, buf){
    if(err){
      return cb(err);
    }
    var r;
    try{
      r = new Reader(buf, file);
    }catch(e){
      return cb(e);
    }
    cb(err, r);
  });
};

// .openSync() reads files synchronously. Behaves exactly
// the same as constructor, so just reuse that
Reader.openSync = Reader;


// .setup() takes the buffer and extracts metadata and sets up
// everything necessary to actually start reading data
Reader.prototype.setup = function(){

  // metadata is somewhere at the end of the file, so we have to scan for it
  var metaPosition = this.findMetaPosition();

  // Pointers in the metadata section are relative to the start of
  // the section, so set a fake start-of-data-section so we can actually
  // read out the metadata if it has any pointers in it
  this.dataStart = metaPosition;

  this.metadata = this.readData(metaPosition).value;

  // Set up all the constants and methods depending on exactly
  // how the data is stored in the db file
  this.setRecordSize(this.metadata.record_size);
  this.recordSize = this.metadata.record_size;
  this.nodeSize = this.recordSize / 4;
  this.numNodes = this.metadata.node_count;
  this.dataStart = this.numNodes * this.nodeSize + 16;

  // Singleton instance of IP decoder that we'll use for
  // reading IP strings into arrays of bytes
  this.ip = new IpDecoder();

  // IPv4 addresses all start from the same point, so let's
  // find that point ahead-of-time to save repeated work
  this.findIPv4StartPointer();
};

// .reload() either takes a string or a buffer and reloads the data
// if it's a string it'll use that as a file path and load it async
// if it's a buffer it'll set that as our buffer and start using it
// if not specified it'll try and use the file we last used
Reader.prototype.reload = function(file, cb){
  var self = this;

  // Allow file to be not specified, use the last file if available
  if(typeof file === 'function' || typeof file === 'undefined'){
    cb = file;
    file = this.filePath;
  }

  // Callback is optional
  if(!cb){
    cb = function(){};
  }

  if(!file){
    setImmediate(function(){
      cb(new Error('No file to load'));
    });
    return;
  }

  if(typeof file === 'string'){
    fs.readFile(file, function(err, buf){
      if(err){
        return cb(err);
      }
      try{
        self.reload(buf);
      }catch(e){
        return cb(e);
      }
      cb(null);
    });
    return;
  }

  // Reset our data, load the new buffer
  this._buf = file;
  this._pointerCache.reset();
  this.setup();
};

// .reloadSync() takes an optional filepath and reloads
// that file and starts using it
Reader.prototype.reloadSync = function(file){
  if(!file){
    file = this.filePath;
  }
  if(!file){
    throw new Error('No file to load');
  }
  this.reload(fs.readFileSync(file));
};



// Low-level functions for reading data directly out of the buffer in different formats

// Returns the byte at `ptr`
Reader.prototype._read = function(ptr){
  return this._buf[ptr];
};

// Returns `len` bytes starting from `ptr`
Reader.prototype._readBuffer = function(ptr, len){
  return this._buf.slice(ptr, ptr + len);
};

// Reads an *unsigned* 32-bit int at `ptr`
Reader.prototype._read32 = function(ptr){
  return this._buf.readUInt32BE(ptr);
};

// Reads a `len`-byte-long UTF-8 string from `ptr`
Reader.prototype._readUTF8 = function(ptr, len){
  return this._buf.toString('utf8', ptr, ptr + len);
};

// Reads a 32-bit big-endian double at `ptr`
Reader.prototype._readDouble = function(ptr){
  return this._buf.readDoubleBE(ptr);
};

// Reads a 32-bit big-endian float at `ptr`
Reader.prototype._readFloat = function(ptr){
  return this._buf.readFloatBE(ptr);
};



// Scans the database backwards to find the position of the metadata section
Reader.prototype.findMetaPosition = function(){

  // 0xabcdef MaxMind.com
  var metaMarker = 'abcdef4d61784d696e642e636f6d';
  var buf = this._buf;

  // Start at the end, read backwards until we find the section
  for(var metaPosition = buf.length; metaPosition; metaPosition--) {
    if(buf.toString('hex', metaPosition - metaMarker.length / 2, metaPosition) === metaMarker){
      break;
    }
  }

  // If we reached the beginning of the file, something went wrong
  if(metaPosition === 0){
    throw new Error('Bad DB');
  }

  return metaPosition;
};



// Data-reading functions for pulling various objects out of the data section


// Read whatever is stored at `ptr`
// Return value is `{ value: theThing, ptr: position of next item }`
Reader.prototype.readData = function(ptr){

  // control tells us what type of thing we're reading and how big it is
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

  // Throw if we don't recognise the data type
  default:
    throw new Error('Unknown type identifier: ' + control.type);
  }
};

// Same as .readData() but reads through the LRU cache for performance
Reader.prototype.cachedRead = function(ptr){
  var cached = this._pointerCache.get(ptr);
  if(cached){
    return cached;
  }
  var d = this.readData(ptr);
  this._pointerCache.set(ptr, d);
  return d;
};

// Reads the control byte and grbs object type and size
Reader.prototype.readDataType = function(ptr){
  var cbyte = this._read(ptr++);

  // First three bits indicate the object type
  var type = cbyte >> 5;

  // If they're 0, this is an extended type, stored in the next byte
  if(type === 0){
    type = this._read(ptr++) + 7;
  }

  // Trailing five bits are the size data
  var sizeMarker = cbyte & 0x1f; // 00011111

  // Pointers behave slightly differently from the others
  // so we won't do the extended size reading
  if(type === 1){
    return { type: type, size: sizeMarker, ptr: ptr };
  }

  // size < 29 -> actual size
  if(sizeMarker < 29){
    return { type: type, size: sizeMarker, ptr: ptr };
  }

  // size = 29 -> size is 29 + one byte
  if(sizeMarker === 29){
    return { type: type, size: 29 + this._read(ptr++), ptr: ptr };
  }

  // size = 30 -> size is 285 + next two bytes
  if(sizeMarker === 30){
    return { type: type, size: 285 + concat2(this._read(ptr++), this._read(ptr++)), ptr: ptr };
  }

  // size = 31 -> size is 65821 + next three bytes
  if(sizeMarker === 31){
    return { type: type, size: 65821 + concat3(this._read(ptr++), this._read(ptr++), this._read(ptr++)), ptr: ptr };
  }

  // Size shouldn't be > 31 because of & 0x1f;
};


// Reads a pointer to data elsewhere. Resolves the data and reads that
Reader.prototype.readPointer = function(control){
  var size = control.size;
  var ptr = control.ptr;

  // First two bits of size tell us how big the size actually is
  var ptrSize = size >> 3;

  // Remaining three bits store some size data
  var baseSize = size & 0x7;

  var addr = 0;

  // Different cases for size marker for different size addresses
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
    // 32-bit needs to be read as unsigned so use _read32 helper
    addr = this._read32(ptr);
    ptr += 4;
  }

  // Read the data stored at addr
  var d = this.cachedRead(addr + this.dataStart);

  // Return data read along with position after this pointer
  return { value: d.value, ptr: ptr };
};

// Reads a utf-8 string
Reader.prototype.readString = function(control){
  var length = control.size;
  var ptr = control.ptr;

  var str = this._readUTF8(ptr, length);
  ptr += length;

  return { value: str, ptr: ptr };
};

// Reads a 32-bit big-endian double
Reader.prototype.readDouble = function(control){
  var ptr = control.ptr;
  var val = this._readDouble(ptr);

  // Size will always be 8, regardless of what control bit says
  ptr += 8;

  return { value: val, ptr: ptr };
};

// Read arbitrary bytes as a buffer
Reader.prototype.readBytes = function(control){
  var ptr = control.ptr;
  var length = control.size;

  var val = this._readBuffer(ptr, length);
  ptr += length;

  return { value: val, ptr: ptr };
};

// Read unsigned 16-bit int
Reader.prototype.readUInt16 = function(control){
  var size = control.size;
  var ptr = control.ptr;

  // Size = 0 -> value is 0, no bytes stored
  if(size === 0){
    return { value: 0, ptr: ptr };
  }
  if(size === 1){
    return { value: this._read(ptr++), ptr: ptr };
  }

  var val = concat2(this._read(ptr++), this._read(ptr++));

  return { value: val, ptr: ptr };
};

// Read unsigned 32-bit int
Reader.prototype.readUInt32 = function(control){
  var size = control.size;
  var ptr = control.ptr;
  var val = 0;

  // If isze is 4 then use _read32 helper to make sure it's read unsigned
  if(size === 4){
    val = this._read32(ptr);
  }else{
    // Otherwise read out the bits sequentially
    for(var i = 0; i < size; i++){
      val |= this._read(ptr + size - i - 1) << (i * 8);
    }
  }

  ptr += size;

  return { value: val, ptr: ptr };
};

// Read key-value map
Reader.prototype.readMap = function(control){
  // Size tells us how many keys to expect, not byte size
  var mapLength = control.size;

  var ptr = control.ptr;

  // Object in which we'll store the key-val pairs
  var obj = {};

  for(var i = 0; i < mapLength; i++){
    // Read key. Should always be a utf-8 string or a pointer to one
    var k = this.readData(ptr);
    var key = k.value;
    ptr = k.ptr;

    // Value can be whatever it likes
    var v = this.readData(ptr);
    var value = v.value;
    ptr = v.ptr;

    // Store key -> value
    obj[key] = value;
  }

  return { value: obj, ptr: ptr };
};

// Read signed 32-bit int
Reader.prototype.readInt32 = function(control){
  var size = control.size;
  var ptr = control.ptr;
  var val = 0;

  // JavaScript's ints are 32-bit signed so no need to worry about
  // the 4-byte case as with uint32
  for(var i = 0; i < size; i++){
    val |= this._read(ptr + size - i - 1) << (i * 8);
  }

  ptr += size;

  return { value: val, ptr: ptr };
};

// Read a 64-bit int. Uses big-integer and returns a string value
Reader.prototype.readUInt64 = function(control){
  var size = control.size;
  var ptr = control.ptr;

  var num = bigInteger(0);

  for(var i = 0; i < size; i++){
    num = num.add(bigInteger(this._read(ptr + size - i - 1)).shiftLeft(i * 8));
  }

  ptr += size;

  return { value: num.toString(), ptr: ptr };
};

// Read a 128-bit int. Exactly the same as uint64
Reader.prototype.readUInt128 = function(control){
  var size = control.size;
  var ptr = control.ptr;

  var num = bigInteger(0);

  for(var i = 0; i < size; i++){
    num = num.add(bigInteger(this._read(ptr + size - i - 1)).shiftLeft(i * 8));
  }

  ptr += size;

  return { value: num.toString(), ptr: ptr };
};

// Read an array of objects
Reader.prototype.readArray = function(control){

  // As with map, size tells us the number of items, not byte length
  var size = control.size;
  var ptr = control.ptr;

  // Return value
  var out = [];

  // Loop through and read out all the items. Easy.
  for(var i = 0; i < size; i++){
    var v = this.readData(ptr);
    out[i] = v.value;
    ptr = v.ptr;
  }

  return { value: out, ptr: ptr };
};

// Reads a boolean
Reader.prototype.readBoolean = function(control){
  // Value is stored in size data, either 1 or 0.
  return { value: control.size > 0, ptr: control.ptr };
};

// Reads a 32-bit float value
Reader.prototype.readFloat = function(control){
  var ptr = control.ptr;

  var val = this._readFloat(ptr);

  // Size is always 4 bytes regardless of what control bit says
  ptr += 4;

  return { value: val, ptr: ptr };
};


// Tree data reading functions

// .setRecordSize() chooses which reader function to use when navigating the tree
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
  default:
    throw new Error('Unknown record size');
  }
};


// 24-bit records are timple three consecutive bytes
Reader.prototype.readLeft24 = function(idx){
  return concat3(this._read(idx++), this._read(idx++), this._read(idx++));
};
Reader.prototype.readRight24 = function(idx){
  idx += 3;
  return concat3(this._read(idx++), this._read(idx++), this._read(idx++));
};

// 28-bit records store the mist significant 4 bits of each record in the middle byte of each node
Reader.prototype.readLeft28 = function(idx){
  return concat4(
    this._read(idx + 3) >> 4,
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

// 32-bit records store as uint32s
Reader.prototype.readLeft32 = function(idx){
  return this._read32(idx);
};
Reader.prototype.readRight32 = function(idx){
  return this._read32(idx + 4);
};



// IPv4 addresses all start at the same place. This function finds that
// place ahead of time to save duplicated work.
Reader.prototype.findIPv4StartPointer = function(){
  var ptr = 0;

  if(this.metadata.ip_version === 6){
    for(var i = 0; i < 96; i++){
      var record = this.readLeft(ptr);

      // If the DB doesn't have an ipv4 search tree, we need to account for that.
      if(record === this.numNodes){
        this.ipv4StartPointer = null;
        return;
      }
      if(record > this.numNodes){
        this.ipv4StartPointer = -1;
        this.ipv4Data = this.cachedRead((record - this.numNodes) + this.dataStart - 16).value;
        return;
      }

      ptr = record * this.recordSize / 4;
    }
  }
  this.ipv4StartPointer = ptr;
};


// Main lookup function. Takes an IP address, returns a record or null
Reader.prototype.lookup = function(ip){

  // Our IP decoder will translate the IP string to bits
  this.ip.set(ip);

  var numBits = 128;
  var ptr = 0;

  // If we're IPv4, we've done some work already.
  if(this.ip.ipVersion === 4){
    numBits = 32;
    ptr = this.ipv4StartPointer;
    if(ptr === null){
      return null;
    }
    if(ptr === -1){
      return this.ipv4Data;
    }
  }

  for(var i = 0; i < numBits; i++){
    var bit = this.ip.bitAt(i);

    var record;

    // Tree stores left/right record if bit is 0 or 1
    if(bit === 0){
      record = this.readLeft(ptr);
    }else{
      record = this.readRight(ptr);
    }

    if(record < this.numNodes){
      ptr = record * this.nodeSize;
      continue;
    }

    // Not found
    if(record === this.numNodes){
      return null;
    }

    // Found! Return the data
    return this.cachedRead((record - this.numNodes) + this.dataStart - 16).value;
  }
};

module.exports = Reader;
