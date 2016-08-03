# hyper-string

> conflict-free p2p string data structure powered by a hyperlog of operations

**STATUS**: very mad science-y work-in-progres

**TODO**: write some background / context on this. talk about the implications
of representing a textual string as an append-only log of operations, with a
materialized view as a DAG of character sequences.

## Usage

Let's start writing "Helo", but have a fork where some other user wants to
fix the spelling error by inserting another "l".

```js
var hstring = require('hyper-string')
var memdb = require('memdb')
var through = require('through2')

var str = hstring(memdb())

str.insert(null, 'Helo', function (err, ops) {
  // ops is an array of four insert ops
  str.insert(ops[2].pos, 'l')
})

str.createReadStream()
  .pipe(through.obj(function (elem, enc, next) {
    process.stdin.write(elem.chr)
    next()
  }))
```

This will output

```
Hello
```

## API

```js
var hstring = require('hyper-string')
```

### var str = hstring(db, opts={})

Creates a new hyper-string, backed by the
[LevelUP](https://github.com/Level/levelup) instance `db`.

### str.insert(pos, string, [cb])

Inserts all characters of `string` after position `pos`, where `pos` is the unique
ID of another character previously inserted. If `pos` is `null`, the given string
is inserted at the beginning of the hyper-string.

Remember, since the hyper-string is represented by a directed acyclic graph, it
can have many different "beginnings".

The callback `cb` is called with the signature `function (err, ops)`, where `ops`
is an array of INSERTION operation objects of the form:

```js
{
  op: 'insert',
  chr: 'H',
  pos: '...'
  prev: '...' || null
}
```

where `pos` is the unique ID representing this inserted character's location,
`chr` is the inserted character, and `prev` is either the preceding character's
ID, or `null` (this character is a document root).

### str.delete(pos, [count], [cb])

Deletes `count` (default 1) characters, starting at position `pos`. `cb` is called with the signature
`function (err, ops)`, where `ops` is an array of DELETE operation objects of the form:

```js
{
  op: 'delete',
  pos: ...
}
```

### str.text(cb)

Asynchronously returns a string, in the order they would be displayed for a
human to read.

### str.chars(cb)

Asynchronously returns all characters in the string, in the order they would be
displayed for a human to read. Each object is of the form

```js
{
  chr: 'P',
  pos: '...'
}
```


## Install

With [npm](https://npmjs.org/) installed, run

```
$ npm install hyper-string
```

## Acknowledgments

**TODO**: mention a bunch of the papers and other projects

## License

ISC
