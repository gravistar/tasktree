#!/bin/bash

## This script helps setup parameters to Dropbox.Client
#  It follows these references:
#  https://www.dropbox.com/developers/blog/45/using-oauth-20-with-the-core-api
#  http://stackoverflow.com/questions/18104535/closing-out-dropbox-datastore-api-in-nodejs

## Hardcoded the app-specific vars. This makes the secret unsafe :(
app_key="nvhuh359xzvfexc"
redirect_uri="http://localhost:3002/"
app_secret="xkay4qxbgd7dglt"
auth_code=""
datastore_repl="datastore_repl.js"

## Need to visit this in browser
auth_url="https://www.dropbox.com/1/oauth2/authorize?client_id=$app_key&response_type=code&redirect_uri=$redirect_uri"
echo "Visit this url: " 
echo $auth_url

## Have to pull the authcode from the browser url
echo "Enter the auth code: "
read auth_code
curl_cmd="curl https://api.dropbox.com/1/oauth2/token -d code=$auth_code -d 
    grant_type=authorization_code -d redirect_uri=$redirect_uri -u $app_key:$app_secret"
echo $curl_cmd
curl_res=$($curl_cmd)
echo "Curl response: " 
echo $curl_res

## The response is JSON, so parse it with node js!
echo "Constructing client input in JSON (finally): "
node $datastore_repl $app_key $app_secret <<< "$curl_res"


