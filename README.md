# mmdb-reader

[![Travis](https://api.travis-ci.org/gosquared/mmdb-reader.svg)](https://travis-ci.org/gosquared/mmdb-reader)
[![Dependencies](https://david-dm.org/gosquared/mmdb-reader.svg)](https://david-dm.org/gosquared/mmdb-reader)
[![Join the chat at https://gitter.im/gosquared/mmdb-reader](https://img.shields.io/badge/gitter-join%20chat-blue.svg)](https://gitter.im/gosquared/mmdb-reader)

[![NPM](https://nodei.co/npm/mmdb-reader.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/mmdb-reader)

Pure-JS reader for MaxMind DB (.mmdb) files, for looking up data indexed by IP address.

Inspired by [node-maxmind-db](https://github.com/PaddeK/node-maxmind-db), but faster.

## Installation

```sh
npm install mmdb-reader
```

## Usage

```js
var MMDBReader = require('mmdb-reader');

// Load synchronously
var reader = new MMDBReader('path/to/data.mmdb');

reader.lookup('8.8.8.8'); // { city: { ... }, continent: { ... } }

```

### Async Loading

```js
var MMDBReader = require('mmdb-reader');

MMDBReader.open('path/to/data.mmdb', function(err, reader){

  if(err){
    // something went wrong. Handle it somehow
  }

  reader.lookup('8.8.8.8'); // { city: { ... }, continent: { ... } }

});
```


## Assumptions

mmdb-reader loads the entire database file into memory as a single node `Buffer`. It also uses an in-memory cache when reading complex data structures out of this buffer in the interests of performance. So very roughly speaking, you should assume this module will consume `size_of_mmdb_file * 1.25` of memory.

The default behaviour is to load the database file synchronously. This assumes that CPU and I/O are less important to you when your process is starting than when it's booted and you need to look up IPs quickly. If you want to load the file asynchronously then obviously you don't have a `reader` until it's finished.
