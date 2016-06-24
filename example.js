var hstring = require('./index')

var str = hstring()

str.insert(null, 'H', function (err, at) {
    str.insert(at, 'e', function (err, at2) {
	str.insert(at2, 'y', function (err, at3) {
	    str.insert(at, 'i', function (err, at4) {
		// str.createStringStream().pipe(process.stdout)
		// str.createReadStream()
	    })
	})
    })
})
