var assert = require('assert');

var Reader = require('../');

[24, 28, 32].forEach(function(recordSize){

  describe(recordSize + '-bit record size', function(){

    [4, 6, 'mixed'].forEach(function(ipVersion){

      describe('IP version: ' + ipVersion, function(){

        var f = ipVersion === 'mixed' ? 'mixed' : 'ipv'+ipVersion;

        var fileName = 'test/data/MaxMind-DB-test-'+f+'-'+recordSize+'.mmdb';
        var reader = new Reader(fileName);

        checkMetadata(reader, ipVersion, recordSize);

        if(ipVersion !== 6){
          checkIPv4(reader, fileName);
        }

        if(ipVersion !== 4){
          checkIPv6(reader, fileName);
        }

      });
    });

  });
});

function checkMetadata(reader, ipVersion, recordSize){
  it('has all the correct metadata', function(){
    var md = reader.metadata;

    assert.strictEqual(md.binary_format_major_version, 2);
    assert.strictEqual(md.binary_format_minor_version, 0);
    // TODO build_epoch
    assert.strictEqual('Test', md.database_type);
    assert.deepEqual(md.description, { en: 'Test Database', zh: 'Test Database Chinese' });
    assert.strictEqual(md.ip_version, ipVersion === 'mixed' ? 6 : ipVersion);
    assert.deepEqual(md.languages, [ 'en', 'zh' ]);
    assert(md.node_count > 36);
    assert.strictEqual(md.record_size, recordSize);
  });
}


function checkIPv4(reader, fileName){
  for(var i = 0; i <= 5; i++){
    var addr = '1.1.1.' + Math.pow(2, i);
    it('finds expected record for ' + addr, function(){
      var valueAddress = addr;
      if(reader.metadata.ip_version === 6) valueAddress = '::' + valueAddress;
      assert.deepEqual(reader.lookup(addr), { ip: valueAddress });
    });
  }

  var pairs = {
    '1.1.1.3': '1.1.1.2',
    '1.1.1.5': '1.1.1.4',
    '1.1.1.7': '1.1.1.4',
    '1.1.1.9': '1.1.1.8',
    '1.1.1.15': '1.1.1.8',
    '1.1.1.17': '1.1.1.16',
    '1.1.1.31': '1.1.1.16'
  };

  Object.keys(pairs).forEach(function(keyAddress){
    var valueAddress = pairs[keyAddress];

    if(reader.metadata.ip_version === 6) valueAddress = '::' + valueAddress;

    it('finds expected record for ' + keyAddress, function(){
      assert.deepEqual(reader.lookup(keyAddress), { ip: valueAddress });
    });
  });

  [ '1.1.1.33', '255.254.253.123' ].forEach(function(addr){
    it('expects null for ' + addr, function(){
      assert.equal(reader.lookup(addr), null);
    });
  });
}

function checkIPv6(reader, fileName){
  var subnets = ['::1:ffff:ffff', '::2:0:0', '::2:0:40', '::2:0:50', '::2:0:58'];

  subnets.forEach(function(addr){
    it('finds expected record for ' + addr, function(){
      assert.deepEqual(reader.lookup(addr), { ip: addr });
    });
  });

  var pairs = {
    '::2:0:1': '::2:0:0',
    '::2:0:33': '::2:0:0',
    '::2:0:39': '::2:0:0',
    '::2:0:41': '::2:0:40',
    '::2:0:49': '::2:0:40',
    '::2:0:52': '::2:0:50',
    '::2:0:57': '::2:0:50',
    '::2:0:59': '::2:0:58'
  };

  Object.keys(pairs).forEach(function(keyAddress){
    var valueAddress = pairs[keyAddress];

    it('finds expected record for ' + keyAddress, function(){
      assert.deepEqual(reader.lookup(keyAddress), { ip: valueAddress });
    });
  });
  //
  [ '1.1.1.33', '255.254.253.123', '89fa::' ].forEach(function(addr){
    it('expects null for ' + addr, function(){
      assert.equal(reader.lookup(addr), null);
    });
  });
}


describe('Decoder', function(){
  var reader = new Reader('test/data/MaxMind-DB-test-decoder.mmdb');

  describe('Types', function(){
    var record = reader.lookup('1.1.1.0');

    it('decodes properly', function(){
      assert(record);
    });

    it('decodes booleans', function(){
      assert.strictEqual(record.boolean, true);
    });

    it('decodes bytes', function(){
      assert(record.bytes instanceof Buffer);
      assert.strictEqual(record.bytes.toString('hex'), '0000002a');
    });

    it('decodes utf8 strings', function(){
      assert.strictEqual(record.utf8_string, 'unicode! ☯ - ♫');
    });

    it('decodes arrays', function(){
      assert.deepEqual(record.array, [1, 2, 3]);
    });

    it('decodes maps', function(){
      assert.deepEqual(record.map, {
        mapX: {
          arrayX: [7, 8, 9],
          utf8_stringX: 'hello'
        }
      });
    });

    it('decodes doubles', function(){
      assert.strictEqual(record.double, 42.123456);
    });

    it('decodes floats', function(){
      assert(Math.abs(record.float - 1.1) < 0.000001);
    });

    it('decodes signed 32-bit ints', function(){
      assert.strictEqual(-268435456, record.int32);
    });

    it('decodes unsigned 16-bit ints', function(){
      assert.strictEqual(100, record.uint16);
    });

    it('decodes unsigned 32-bit ints', function(){
      assert.strictEqual(268435456, record.uint32);
    });

    // TODO uint64
    // TODO uint128
  });



  describe('Zeroes', function(){
    var record = reader.lookup('::0');

    it('decodes properly', function(){
      assert(record);
    });

    it('decodes booleans', function(){
      assert.strictEqual(record.boolean, false);
    });

    it('decodes bytes', function(){
      assert(record.bytes instanceof Buffer);
      assert.strictEqual(record.bytes.length, 0);
    });

    it('decodes utf8 strings', function(){
      assert.strictEqual(record.utf8_string, '');
    });

    it('decodes arrays', function(){
      assert.deepEqual(record.array, []);
    });

    it('decodes maps', function(){
      assert.deepEqual(record.map, {});
    });

    it('decodes doubles', function(){
      assert.strictEqual(record.double, 0);
    });

    it('decodes floats', function(){
      assert(Math.abs(record.float) < 0.000001);
    });

    it('decodes signed 32-bit ints', function(){
      assert.strictEqual(0, record.int32);
    });

    it('decodes unsigned 16-bit ints', function(){
      assert.strictEqual(0, record.uint16);
    });

    it('decodes unsigned 32-bit ints', function(){
      assert.strictEqual(0, record.uint32);
    });

    // TODO uint64
    // TODO uint128
  });
});
