/* eslint-env mocha */

/* global gc */

if (typeof gc === 'undefined') {
  throw new Error('Memory test should be run with --expose-gc');
}

console.log('Running memory test...');

var assert = require('assert');

var Reader = require('../');

var fs = require('fs');
var file = 'test/data/GeoIP2-Precision-ISP-Test.mmdb';
var fileSize = fs.statSync(file).size;

var readers = [];

var start = process.memoryUsage();

console.log('Initial RSS: %s', start.rss);

var num = 5000;

// TEST DESTROY
console.log('\nTesting cleanup...');

// Do a few loops of loading lots of stuff into mem and chucking it away

var i, j, mem;

for (j = 0; j < 10; j += 1) {

  readers = [];

  gc();

  for (i = 0; i < num; i++) {
    readers.push(new Reader(file));
  }

  gc();

  mem = process.memoryUsage();

  console.log('Pass %s RSS: %s', j, mem.rss);

  // We've loaded ${num} copies of the file into mem, they should be there
  // 0.75 in case initial RSS was a bit high.
  assert(mem.rss - start.rss > num * fileSize * 0.75);

  // Dispose + gc + reload shouldn't increase the mem too much
  assert(mem.rss - start.rss < num * fileSize * 1.5);
}

// If we actually get to this point without crashing, it must have worked
console.log('Good!\n');

readers = [];

gc();

// TEST RELOAD
console.log('\nTesting reloading...');

for (i = 0; i < num; i++) {
  readers.push(new Reader(file));
}


for (j = 0; j < 10; j += 1) {

  readers.forEach(function(r) {
    r.reloadSync(file);
    assert.strictEqual(r.lookup('1.128.0.0').isp, 'Telstra Internet');
  });

  gc();

  mem = process.memoryUsage();

  console.log('Pass %s RSS: %s', j, mem.rss);

  // We've loaded ${num} copies of the file into mem, they should be there
  // 0.75 in case initial RSS was a bit high.
  assert(mem.rss - start.rss > num * fileSize * 0.75);

  // Dispose + gc + reload shouldn't increase the mem too much
  assert(mem.rss - start.rss < num * fileSize * 1.75);
}

console.log('Good!');
