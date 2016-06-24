var test = require('tape')
var hstring = require('../')
var memdb = require('memdb')
var concat = require('concat-stream')

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
  t.plan(9)
  
  var str = hstring(memdb())

  str.insert(null, 'H', function (err, op) {
    t.notOk(err)
    str.insert(op.pos, 'e', function (err, op2) {
      t.notOk(err)
      str.insert(op2.pos, 'y', function (err, op3) {
        t.notOk(err)
        str.insert(op2.pos, 'j', function (err, op4) {
          t.notOk(err)
          str.createStringStream().pipe(concat(function (elems) {
            t.equal(elems.length, 4)
            t.equal(elems[0].chr, 'H')
            t.equal(elems[1].chr, 'e')
            t.equal(elems[2].chr, 'j')
            t.equal(elems[3].chr, 'y')
          }))
        })
      })
    })
  })
})
