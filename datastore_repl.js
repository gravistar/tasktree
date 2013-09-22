#!/usr/bin/env node

/**
 * This just parses the JSON result of the a curl request and adds the fields
 * needed to make it useable by client.
 */

// 3rd party
var _ = require("./src/lib/underscore.js");
var Dropbox = require("./src/lib/datastore.js");

// mine
var __ = require("./src/helper/underscore_util.js");
var DatastoreUtil = require("./src/helper/datastore_util.js")

var repl = require("repl");

var argv = process.argv;
var inputStream = process.stdin;
// argv[0] = node 
// argv[1] = filename
var curl_res_raw = '', app_key = argv[2], app_secret = argv[3];

process.stdin.resume();

inputStream.on('data',function(chunk){
    curl_res_raw += chunk;
});

inputStream.on('end',function() {
    var curl_res = JSON.parse(curl_res_raw);
    delete curl_res["token_type"];
    curl_res["token"] = curl_res["access_token"];
    delete curl_res["access_token"];
    curl_res["key"] = app_key;
    curl_res["secret"] = app_secret;
    console.log(curl_res);

    // make a db client
    var client = new Dropbox.Client(curl_res);

    // log in
    client.authenticate({interactive:false}, function(error){
        if (error){
            console.log("auth error: " + error);
        }
    });

    if (client.isAuthenticated()){
        client.getDatastoreManager().openDefaultDatastore(function (error, datastore){
            if (error){
                console.log("Error opening datstore: " + error);
            }

            var context = repl.start(
                {
                       prompt: "node via stdin> ",
                       input: process.stderr,
                       output: process.stdout
                 }
            ).context;
            context._ = _;
            context.__ = __;
            context.dsu = DatastoreUtil.DatastoreUtil;
            context.datastore = datastore;
        });
    }
});


