/* eslint-disable handle-callback-err */

var test = require('tape')
var hstring = require('../')
var memdb = require('memdb')
var concat = require('concat-stream')

test('insertions', function (t) {
  t.plan(12)

  var str = hstring(memdb())

  str.insert(null, 'H', function (err, ops) {
    t.notOk(err)
    t.equal(ops[0].chr, 'H')
    str.insert(ops[0].pos, 'e', function (err, ops2) {
      t.notOk(err)
      t.equal(ops2[0].chr, 'e')
      str.insert(ops2[0].pos, 'y', function (err, ops3) {
        t.notOk(err)
        t.equal(ops3[0].chr, 'y')

        str.createReadStream().pipe(concat(function (ops) {
          t.equal(ops.length, 3)
          t.equal(ops[0].value.chr, 'H')
          t.equal(ops[1].value.chr, 'e')
          t.equal(ops[1].value.prev, ops[0].key)
          t.equal(ops[2].value.chr, 'y')
          t.equal(ops[2].value.prev, ops[1].key)
        }))
      })
    })
  })
})

test('text + chars', function (t) {
  t.plan(4)

  var str = hstring(memdb())

  str.insert(null, 'H', function (err, ops) {
    str.insert(ops[0].pos, 'e', function (err, ops2) {
      str.insert(ops2[0].pos, 'l', function (err, ops3) {
        str.insert(ops3[0].pos, 'l', function (err, ops4) {
          str.insert(ops4[0].pos, 'o')
          str.insert(ops2[0].pos, 'y')  // two inserts at 'op2[0].pos'!
        })
      })
    })
  })

  // text
  str.text(function (err, text) {
    var expected = 'Heyllo'
    t.equals(err, null)
    t.equals(text, expected)
  })

  // chars
  str.chars(function (err, chars) {
    var expected = [
      {
        chr: 'H',
        pos: '43ba8b3fec78c2c3da893fc67792bc45f330ae8083b5e54f1fd16ba9df4fa9c4'
      },
      {
        chr: 'e',
        pos: '136ac665c69975abd46101cea25d76431f7f7ae6378bafd2d2801be05ebaaf94'
      },
      {
        chr: 'y',
        pos: '78f039133526f543089160ae7145d980b79737d224b61ee98e252fb0cc61ba79'
      },
      {
        chr: 'l',
        pos: '745e47b23097e54f034c84932a5721bceb16d54e3eb74d15faee110b8b809b1e'
      },
      {
        chr: 'l',
        pos: '54bfc709d7d3190b8f27a0023da0a87ba1f15950c75a8d59258b955f2261bc54'
      },
      {
        chr: 'o',
        pos: '16ab3a94f5aee62a3031da58c6b9f46c0172e2a0ddffc90b6ebe789c1a879e2b'
      }
    ]
    t.equals(err, null)
    t.deepEquals(chars, expected)
  })
})

test('deletions', function (t) {
  t.plan(3)

  var str = hstring(memdb())

  str.insert(null, 'H', function (err, ops) {
    str.insert(ops[0].pos, 'e', function (err, ops2) {
      str.insert(ops2[0].pos, 'y', function (err, ops3) {
        str.text(function (err, text) {
          t.equals(text, 'Hey')
          str.delete(ops2[0].pos, 1, function (err) {
            str.text(function (err, text) {
              t.equals(text, 'Hy')
              str.delete(ops[0].pos, 1, function (err) {
                str.text(function (err, text) {
                  t.equals(text, 'y')
                })
              })
            })
          })
        })
      })
    })
  })
})

test('insert with same prev twice', function (t) {
  t.plan(1)
  var str = hstring(memdb())

  str.insert(null, 'H', function (err, ops1) {
    str.insert(ops1[0].pos, 'y', function (err, ops2) {
      str.insert(ops1[0].pos, 'e', function (err, ops3) {
        str.text(function (err, text) {
          t.equal(text, 'Hey')
        })
      })
    })
  })
})

test('insert/delete multiple chars', function (t) {
  var str = hstring(memdb())

  str.insert(null, 'Hey', function (err, ops) {
    t.equal(ops.length, 3)

    t.equal(ops[0].prev, null)
    t.equal(ops[0].chr, 'H')
    t.equal(ops[1].prev, ops[0].pos)
    t.equal(ops[1].chr, 'e')
    t.equal(ops[2].prev, ops[1].pos)
    t.equal(ops[2].chr, 'y')

    str.delete(ops[0].pos, 2, function (err, ops2) {
      t.equal(ops2.length, 2)

      t.equal(ops2[0].at, ops[0].pos)
      t.equal(ops2[1].at, ops[1].pos)

      str.text(function (err, text) {
        t.equal(text, 'y')
        t.end()
      })
    })
  })
})

test('insert: invalid input errors', function (t) {
  t.plan(1)
  var str = hstring(memdb())

  t.throws(function () {
    str.insert(null, null)
  })
})

test('delete: invalid input errors', function (t) {
  t.plan(3)
  var str = hstring(memdb())

  t.throws(function () {
    str.delete(null)
  })
  t.throws(function () {
    str.delete(null, '1')
  })
  t.throws(function () {
    str.delete(null, -1)
  })
})

test('multiple heads', function (t) {
  t.plan(7)

  var str1 = hstring(memdb())
  var str2 = hstring(memdb())

  str1.insert(null, 'Hello', function (err) {
    t.error(err)
    str2.insert(null, 'Heya', function (err) {
      t.error(err)
      replicate(str1, str2, function (err) {
        t.error(err)
        str1.text(function (err, txt) {
          t.error(err)
          t.equal(txt, 'HeyaHello')
          str2.text(function (err, txt) {
            t.error(err)
            t.equal(txt, 'HeyaHello')
          })
        })
      })
    })
  })
})

function replicate (a, b, cb) {
  var r1 = a.log.replicate()
  var r2 = b.log.replicate()

  r1.once('end', done)
  r2.once('end', done)

  r1.pipe(r2).pipe(r1)

  var pending = 2
  function done (err) {
    if (err) throw err
    if (!--pending) cb()
  }
}
