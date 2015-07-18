// LRU cache. Based on https://github.com/isaacs/node-lru-cache
// but with absolutely everything we don't need removed for perf
// Also, only runs cleanup if over-filled by >10% so there aren't
// too many expensive ops going on all the time


// Entry constructor. V8 likes class-like things
function Entry(key, value, lu){
  this.key = key;
  this.value = value;
  this.lu = lu;
}

function LRUCache(limit){
  this._limit = limit;
  this.reset();
}

// Reset everything, empty cache, everything set to zero
LRUCache.prototype.reset = function(){
  this._cache = {};
  this._list = {};
  this._lru = 0;
  this._mru = 0;
  this._waiting = 0;
  this._count = 0;
};

LRUCache.prototype.get = function(key){
  var entry = this._cache[key];

  // If we have the entry, mark it as recently used
  if(entry !== undefined){
    this.bump(entry);
    return entry.value;
  }
  return undefined;
};

// Mark an entry as being used.
LRUCache.prototype.bump = function(entry){
  this.shiftLU(entry.lu);
  entry.lu = this._mru++;
  this._list[entry.lu] = entry;
};

// Get rid of an entry at its last-used index, and move our
// least-recently-used pointer along if necessary
LRUCache.prototype.shiftLU = function(lu){
  delete this._list[lu];
  while(this._lru < this._mru && !this._list[this._lru]){
    this._lru++;
  }
};

// Set key -> values. Simples
LRUCache.prototype.set = function(key, value){

  // Create the new entry for this key.
  // We assume the key doesn't already exist because we can in our case
  var entry = new Entry(key, value, this._mru++);
  this._count++;

  this._list[entry.lu] = this._cache[key] = entry;

  // If we're overfull, trigger a trim
  if(this._count > this._limit){
    if(++this._waiting > this._limit / 10){
      this.trim();
    }
  }
};

// Clean up the list until we're back within our limit
LRUCache.prototype.trim = function(){
  while(this._lru < this._mru && this._count > this._limit){
    this.del(this._list[this._lru]);
  }
  this._waiting = 0;
};

// Delete a specific entry
LRUCache.prototype.del = function(entry){
  this._count--;
  delete this._cache[entry.key];
  this.shiftLU(entry.lu);
};

module.exports = LRUCache;
