/* eslint-env mocha */

var assert = require('assert');

var fs = require('fs');

var Reader = require('../');

describe('Constructor', function() {

  it('allows new', function() {
    var r = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');
    assert(r);
    assert(r instanceof Reader);
    assert(r._buf);
  });

  it('allows not-new', function() {
    var r = Reader('test/data/MaxMind-DB-test-decoder.mmdb'); // eslint-disable-line new-cap
    assert(r);
    assert(r instanceof Reader);
    assert(r._buf);
  });

  it('allows new with a buffer', function() {
    var r = new Reader(fs.readFileSync('test/data/MaxMind-DB-test-decoder.mmdb'));
    assert(r);
    assert(r instanceof Reader);
    assert(r._buf);
  });

  it('allows not-new with a buffer', function() {
    var r = Reader(fs.readFileSync('test/data/MaxMind-DB-test-decoder.mmdb')); // eslint-disable-line new-cap
    assert(r);
    assert(r instanceof Reader);
    assert(r._buf);
  });

});

describe('Opening', function() {

  describe('#openSync()', function() {
    it('opens with a string', function() {
      var r = Reader.openSync('test/data/MaxMind-DB-test-decoder.mmdb');
      assert(r);
      assert(r instanceof Reader);
      assert(r._buf);
    });

    it('opens with a buffer', function() {
      var r = Reader.openSync(fs.readFileSync('test/data/MaxMind-DB-test-decoder.mmdb'));
      assert(r);
      assert(r instanceof Reader);
      assert(r._buf);
    });
  });

  describe('#open()', function() {
    it('opens with a string', function(done) {
      Reader.open('test/data/MaxMind-DB-test-decoder.mmdb', function(err, r) {
        assert(!err);
        assert(r);
        assert(r instanceof Reader);
        assert(r._buf);
        done();
      });
    });
  });

});

describe('Bad DBs', function() {

  it('throws up when loading a nonexistent file (sync)', function() {
    assert.throws(function() {
      Reader('does/not/exist'); // eslint-disable-line new-cap
    });
  });

  it('throws up when loading a nonexistent file (async)', function(done) {
    Reader.open('does/not/exist', function(err) {
      assert(err);
      done();
    });
  });

  it('doesn\'t get confused by a bad db file', function() {
    assert.throws(function() {
      Reader('test/data/empty.mmdb'); // eslint-disable-line new-cap
    });
  });

  it('doesn\'t get confused by a bad db file (async)', function(done) {
    Reader.open('test/data/empty.mmdb', function(err) {
      assert(err);
      done();
    });
  });

  it('throws up when reloading a bad file (sync)', function() {
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    assert.throws(function() {
      reader.reloadSync('test/data/empty.mmdb');
    });
  });

  it('throws up when reloading a bad file (async)', function(done) {
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    reader.reload('test/data/empty.mmdb', function(err) {
      assert(err);
      done();
    });
  });

});


describe('Reload', function() {
  it('can reload (sync)', function() {
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    reader.reloadSync('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
  });


  it('can reload (async)', function(done) {
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    reader.reload('test/data/MaxMind-DB-test-decoder.mmdb', function(err) {
      assert(!err);
      assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
      done();
    });
  });

  it('can reload without a callback', function() {
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    reader.reload();
  });

  it('can reload same file (sync)', function() {
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    reader.reloadSync();

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
  });


  it('can reload same file (async)', function(done) {
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    reader.reload(function(err) {
      assert(!err);
      assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
      done();
    });
  });


  it('can reload with a different file', function() {
    var reader = new Reader('test/data/MaxMind-DB-test-ipv4-24.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0'), null);

    reader.reloadSync('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
  });

  it('carries on if the file doesn\'t exist', function(done) {
    var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

    assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);

    reader.reload('non/existent/file', function(err) {
      assert(err);
      assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
      done();
    });
  });

  it('throws up if reloading without a file (sync)', function() {
    var reader = new Reader(fs.readFileSync('test/data/MaxMind-DB-test-decoder.mmdb'));

    assert.throws(function() {
      reader.reloadSync();
      assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
    });
  });

  it('throws up if reloading without a file (async)', function(done) {
    var reader = new Reader(fs.readFileSync('test/data/MaxMind-DB-test-decoder.mmdb'));

    reader.reload(function(err) {
      assert(err);
      assert.strictEqual(reader.lookup('1.1.1.0').boolean, true);
      done();
    });
  });
});
