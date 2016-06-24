# hyper-string

> string data structure powered by a hyperlog of operations

**STATUS**: very mad science-y work-in-progres

**TODO**: write some background / context on this. talk about the implications
of representing a textual string as an append-only log of operations, with a
materialized view as a DAG of character sequences.

## Usage

Let's start writing "Hello", but have a fork where some other user wants to
change it to "Hey" after seeing "He".

```js
var hstring = require('hyper-string')
var memdb = require('memdb')
var through = require('through2')

var str = hstring(memdb())

str.insert(null, 'H', function (err, op) {
  str.insert(op.pos, 'e', function (err, op2) {
    str.insert(op2.pos, 'l', function (err, op3) {
      str.insert(op3.pos, 'l', function (err, op4) {
        str.insert(op4.pos, 'o')
        str.insert(op2.pos, 'y')  // two inserts at 'op2.pos'!
      })
    })
  })
})

str.createStringStream()
  .pipe(through.obj(function (elem, enc, next) {
    process.stdin.write(elem.chr)
    next()
  }))
```

This will output

```
heyllo
```

## API

```js
var hstring = require('hyper-string')
```

### var str = hstring(db, opts={})

Creates a new hyper-string, backed by the
[LevelUP](https://github.com/Level/levelup) instance `db`.

### str.insert(pos, chr, cb)

Inserts a single character `chr` after position `pos`, where `pos` is the unique
ID of another character previously inserted. If `pos` is `null`, the character
is inserted at the beginning of the string.

Remember, since the string is represented by a directed acyclic graph, it
can have many different "beginnings".

The callback `cb` is called with the signature `function (err, op)`, where `op`
is an INSERTION operation object of the form

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

### str.createStringStream()

Returns a Readable object stream of characters, in the order they would be
displayed for a human to read. Each object is of the form

```js
{
  chr: 'H',
  pos: '...'
}
```

Printing the full contents of the string to standard out can be done with a
simple `through2` stream:

```js
str.createStringStream()
  .pipe(through2.obj(function (elem, enc, next) {
    process.stdin.write(elem.chr)
    next()
  }))
```

### str.createReadStream()

**TODO**: exposes the raw hyperlog read stream right now, but it ought to just
pump out operation objects instead of exposing hyperlog innards


## Install

With [npm](https://npmjs.org/) installed, run

```
$ npm install hyper-string
```

## Acknowledgments

**TODO**: mention a bunch of the papers and other projects

## License

ISC

