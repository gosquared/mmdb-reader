/*eslint-env mocha */

var assert = require('assert');

var LRU = require('../src/LRUCache');

describe('LRU', function(){

  it('does basic things right', function(){
    var lru = new LRU(3);
    lru.set('key', 'value');

    assert.strictEqual(lru.get('key'), 'value');
    assert.strictEqual(lru.get('foo'), undefined);
    assert.strictEqual(lru.get(12345), undefined);
  });

  it('evicts stuff', function(){
    var lru = new LRU(5);
    for(var i = 0; i < 10; i += 1){
      lru.set(i, i);
    }

    assert.strictEqual(lru.get(0), undefined);
    assert.strictEqual(lru.get(1), undefined);
    assert.strictEqual(lru.get(2), undefined);
    assert.strictEqual(lru.get(3), undefined);
    assert.strictEqual(lru.get(4), undefined);

    assert.strictEqual(lru.get(5), 5);
    assert.strictEqual(lru.get(6), 6);
    assert.strictEqual(lru.get(7), 7);
    assert.strictEqual(lru.get(8), 8);
    assert.strictEqual(lru.get(9), 9);
  });

  it('can over-fill by 10% before cleanup', function(){
    var lru = new LRU(100);
    for(var i = 0; i < 110; i += 1){
      lru.set(i, i);
    }

    for(var j = 0; j < 110; j += 1){
      assert.strictEqual(lru.get(j), j);
    }
  });

  it('cleans up when more than 110% full', function(){
    var lru = new LRU(100);
    for(var i = 0; i < 111; i += 1){
      lru.set(i, i);
    }

    assert.strictEqual(lru.get(0), undefined);
    assert.strictEqual(lru.get(1), undefined);
    assert.strictEqual(lru.get(2), undefined);
    assert.strictEqual(lru.get(3), undefined);
    assert.strictEqual(lru.get(4), undefined);
    assert.strictEqual(lru.get(5), undefined);
    assert.strictEqual(lru.get(6), undefined);
    assert.strictEqual(lru.get(7), undefined);
    assert.strictEqual(lru.get(8), undefined);
    assert.strictEqual(lru.get(9), undefined);
    assert.strictEqual(lru.get(10), undefined);

    for(var j = 11; j < 111; j += 1){
      assert.strictEqual(lru.get(j), j);
    }
  });

});
