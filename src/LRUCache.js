function LRUCache(limit){
  this._cache = {};
  this._list = {};
  this._lru = 0;
  this._mru = 0;
  this._waiting = 0;
  this._count = 0;
  this._limit = limit;
}

LRUCache.prototype.get = function(key){
  var entry = this._cache[key];
  if(entry !== undefined){
    this.bump(entry);
    return entry.value;
  }
  return undefined;
};

LRUCache.prototype.bump = function(entry){
  this.shiftLU(entry.lu);
  entry.lu = this._mru++;
  this._list[entry.lu] = entry;
};

LRUCache.prototype.shiftLU = function(lu){
  delete this._list[lu];
  while(this._lru < this._mru && !this._list[this._lru]) this._lru++;
};

LRUCache.prototype.set = function(key, value){

  var entry = new Entry(key, value, this._mru++);
  this._count++;

  this._list[entry.lu] = this._cache[key] = entry;

  if(this._count > this._limit){
    if(this._waiting++ > this._limit / 10){
      this.trim();
    }
  }
};

LRUCache.prototype.trim = function(){
  while(this._lru < this._mru && this._count > this._limit){
    this.del(this._list[this._lru]);
  }
  this._waiting = 0;
};

LRUCache.prototype.del = function(entry){
  this._count--;
  delete this._cache[entry.key];
  this.shiftLU(entry.lu);
};

function Entry(key, value, lu){
  this.key = key;
  this.value = value;
  this.lu = lu;
}

module.exports = LRUCache;
