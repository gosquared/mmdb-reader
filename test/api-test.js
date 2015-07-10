/*eslint-env mocha */

var assert = require('assert');

var Reader = require('../');


describe('Bad DBs', function(){

  it('doesn\'t get confused by a bad db file', function(){
    assert.throws(function(){
      new Reader('test/data/empty.mmdb');
    });
  });

  it('doesn\'t get confused by a bad db file (async)', function(done){
    Reader.open('test/data/empty.mmdb', function(err, reader){
      assert(err);
      done();
    });
  });

  it('throws up when reloading a bad file (sync)', function(){
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    assert.throws(function(){
      reader.reloadSync('test/data/empty.mmdb');
    });
  });

  it('throws up when reloading a bad file (async)', function(done){
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    reader.reload('test/data/empty.mmdb', function(err){
      assert(err);
      done();
    });
  });

});


describe('Reload', function(){
  it('can reload (sync)', function(){
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    reader.reloadSync('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
  });


  it('can reload (async)', function(done){
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    reader.reload('test/data/MaxMind-DB-test-decoder.mmdb', function(err){
      assert(!err);
      assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
      done();
    });
  });


  it('can reload with a different file', function(){
    var reader = new Reader('test/data/MaxMind-DB-test-ipv4-24.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0'), null);

    reader.reloadSync('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
  });

  it('carries on if the file doesn\'t exist', function(done){
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    reader.reload('non/existent/file', function(err){
      assert(err);
      assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
      done();
    });
  });
});
