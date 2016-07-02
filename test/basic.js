var test = require('tape')
var hstring = require('../')
var memdb = require('memdb')
var concat = require('concat-stream')
var through = require('through2')

test('insertions', function (t) {
  t.plan(12)

  var str = hstring(memdb())

  str.insert(null, 'H', function (err, op) {
    t.notOk(err)
    t.equal(op.chr, 'H')
    str.insert(op.pos, 'e', function (err, op2) {
      t.notOk(err)
      t.equal(op2.chr, 'e')
      str.insert(op2.pos, 'y', function (err, op3) {
        t.notOk(err)
        t.equal(op3.chr, 'y')

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

test('deletions', function (t) {
})

test('text + chars', function (t) {
  t.plan(4)

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
