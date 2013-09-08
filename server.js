/**
 * Summary:
 *      Serves the page on localhost.
 */

var express = require('express');
var app = express();
var port = 3002;

// so resources in page can all be referenced locally
app.use(express.static(__dirname + '/src'));

// handler for the request
var handle = function(req, res) {
    res.sendfile('src/index.html');
}

app.get('/', handle);

app.listen(port);
console.log('Server listening on port: ' + port);

