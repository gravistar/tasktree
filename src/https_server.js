var express = require('express');
var https = require('https');
var fs = require('fs');

var options = {
    cert: fs.readFileSync('/home/ubuntu/cert-HVVSRHBS3HEANANVBBISZY75WZ3OQM2X.pem'),
    key: fs.readFileSync('/home/ubuntu/pk-HVVSRHBS3HEANANVBBISZY75WZ3OQM2X.pem')
};
var port = 444;
var app = express();

var handle = function(req, res) {
    console.log('Received request: ' + req.url);
    for (var prop in req.query) {
        console.log(prop + ': ' + req.query[prop]);
    }
    res.sendfile('src/index.html');
};
app.use(express.static(__dirname + '/src'));
app.get('/', handle);

https.createServer(options, app).listen(port);
console.log('Server listening on port: ' + port);
