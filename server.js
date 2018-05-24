"use strict";

require('dotenv').config();

const PORT        = process.env.PORT || 8080;
const ENV         = process.env.ENV || "development";
const express     = require("express");
const bodyParser  = require("body-parser");
const sass        = require("node-sass-middleware");
const app         = express();

const knexConfig  = require("./knexfile");
const knex        = require("knex")(knexConfig[ENV]);
const morgan      = require('morgan');
const knexLogger  = require('knex-logger');
const request     = require('request-promise');

// Seperated Routes for each Resource
const usersRoutes = require("./routes/users");

// Load the logger first so all (static) HTTP requests are logged to STDOUT
// 'dev' = Concise output colored by response status for development use.
//         The :status token will be colored red for server error codes, yellow for client error codes, cyan for redirection codes, and uncolored for all other codes.
app.use(morgan('dev'));

// Log knex SQL queries to STDOUT as well
app.use(knexLogger(knex));

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/styles", sass({
  src: __dirname + "/styles",
  dest: __dirname + "/public/styles",
  debug: true,
  outputStyle: 'expanded'
}));
app.use(express.static("public"));

// Mount all resource routes
app.use("/api/users", usersRoutes(knex));

// Home page
app.get("/", (req, res) => {
  res.render("index");
});

app.post("/listings", (req, res) => {
  // log the user in. make room for an access token
  let authRequest = {
    method: 'POST',
    uri: 'http://localhost:3030/authentication',
    body: {
      strategy: 'local',
      email: req.body.email,
      password: req.body.password
    },
    json: true
  }
  let accessToken;
  request(authRequest).then( authResponse => {
    accessToken = authResponse.accessToken;
  }).catch( err => {
    console.error('AUTH ERROR');
    res.redirect('/');
  });

  // get all listings
  let listingsRequest = {
    method: 'GET',
    uri: 'http://localhost:3030/properties',
    headers: {
      Authorization: 'Bearer ' + accessToken
    }
  }
  request(listingsRequest).then( listingsResponse => {
    console.log(listingsResponse);
    res.render('listings', {
      listings: JSON.parse(listingsResponse)
    });
  }).catch( err => {
    console.error('LISTINGS ERROR');
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log("Example app listening on port " + PORT);
});
