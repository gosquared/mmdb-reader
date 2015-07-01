var assert = require('assert');

var Reader = require('../');

describe('Anonymous IP', function(){
  var reader = new Reader('test/data/GeoIP2-Anonymous-IP-Test.mmdb');

  it('works', function(){

    var result = reader.lookup('1.2.0.1');

    assert(result);

    assert(result.is_anonymous);
    assert(result.is_anonymous_vpn);

    assert(!result.is_hosting_provider);
    assert(!result.is_public_proxy);
    assert(!result.is_tor_exit_node);
  });
});

describe('Connection Type', function(){
  var reader = new Reader('test/data/GeoIP2-Connection-Type-Test.mmdb');

  it('works', function(){
    var result = reader.lookup('1.0.1.0');

    assert(result);

    assert.strictEqual(result.connection_type, 'Cable/DSL');
  });
});

describe('Domain', function(){
  var reader = new Reader('test/data/GeoIP2-Domain-Test.mmdb');

  it('works', function(){
    var result = reader.lookup('1.2.0.0');

    assert(result);

    assert.strictEqual(result.domain, 'maxmind.com');
  });
});

describe('ISP', function(){
  var reader = new Reader('test/data/GeoIP2-ISP-Test.mmdb');

  it('works', function(){
    var result = reader.lookup('1.128.0.0');

    assert(result);

    assert.strictEqual(result.autonomous_system_number, 1221);
    assert.strictEqual(result.autonomous_system_organization, 'Telstra Pty Ltd');
    assert.strictEqual(result.isp, 'Telstra Internet');
    assert.strictEqual(result.organization, 'Telstra Internet');
  });
});

// TODO metadata database_type

describe('Country', function(){
  var reader = new Reader('test/data/GeoIP2-Country-Test.mmdb');

  it('works', function(){
    var result = reader.lookup('81.2.69.160');

    assert(result);

    assert.strictEqual(result.country.iso_code, 'GB');
  });
});

describe('City', function(){
  var reader = new Reader('test/data/GeoIP2-City-Test.mmdb');

  it('works', function(){
    var result = reader.lookup('81.2.69.160');

    assert(result);

    assert.strictEqual(result.city.names.en, 'London');
  });
});
