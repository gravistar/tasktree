var express = require('express');
var https = require('https');
var fs = require('fs');

var options = {
    cert: fs.readFileSync('/home/ubuntu/cert-TM7TXVXP26KYSFJUMVV4SARAHATDN6R5.pem'),
    key: fs.readFileSync('/home/ubuntu/pk-TM7TXVXP26KYSFJUMVV4SARAHATDN6R5.pem')
};
var port = 443;
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
