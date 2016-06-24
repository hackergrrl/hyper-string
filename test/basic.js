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

test('get full string', function (t) {
  t.plan(6)
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

  var expected = ['H', 'e', 'y', 'l', 'l', 'o']

  str.createStringStream()
    .pipe(through.obj(function (elem, enc, next) {
      t.equal(elem.chr, expected.shift())
      next()
    }))
})
