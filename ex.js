var hstring = require('.')
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

