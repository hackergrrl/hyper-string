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

var str = hstring(memdb())

str.insert(null, null, 'Hola', function (err, ops) {
  // ops is an array of four unique IDs
  str.insert(null, ops[0], '¡')
  str.insert(ops[ops.length-1], null, '!')
})

str.text(function (err, text) {
  console.log(text)
})
```

This will output

```
¡Hola!
```

## API

```js
var hstring = require('hyper-string')
```

### var str = hstring(db, opts={})

Creates a new hyper-string, backed by the
[LevelUP](https://github.com/Level/levelup) instance `db`.

### str.insert(beforePos, afterPos, string, [cb])

Inserts all characters of `string` after position `beforePos` and before
position `afterPos`, which are unique IDs of other characters previously
inserted. If 'beforePos` is `null`, the given string is inserted at the
beginning of the hyper-string. If `afterPos` is `null`, it is inserted at the
end.

Remember, since the hyper-string is represented by a directed acyclic graph, it
can have many different "beginnings" and "ends". hyper-string ensures that the
ordering of these are deterministic.

The callback `cb` is called with the signature `function (err)`.

### str.delete(from, to, [cb])

Deletes the characters between positions `from` and `to`, inclusive. `cb` is
called with the signature `function (err)`.

```js
{
  op: 'delete',
  from: ...,
  to: ...
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

Based on the [Logroot CRDT
paper](https://hal.archives-ouvertes.fr/file/index/docid/345911/filename/main.pdf)
by Stephane Weiss, Pascal Urso, and Pascal Molli.

## License

ISC
