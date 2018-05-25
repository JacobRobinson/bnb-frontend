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
const jwtDecoder  = require('jwt-decode');
const cookieParser= require('cookie-parser');

// Seperated Routes for each Resource
const usersRoutes = require("./routes/users");

// Load the logger first so all (static) HTTP requests are logged to STDOUT
// 'dev' = Concise output colored by response status for development use.
//         The :status token will be colored red for server error codes, yellow for client error codes, cyan for redirection codes, and uncolored for all other codes.
app.use(morgan('dev'));

// Log knex SQL queries to STDOUT as well
app.use(knexLogger(knex));

// Need to parse cookies
app.use(cookieParser());

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
  // log the user in
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
  // send the auth request
  request(authRequest).then( authResponse => {
    let accessToken = authResponse.accessToken;
    res.cookie('accessToken', accessToken);
    res.cookie('uid', jwtDecoder(accessToken).userId);
    // get all listings
    let listingsRequest = {
      method: 'GET',
      uri: 'http://localhost:3030/properties',
      headers: {
        Authorization: 'Bearer ' + accessToken
      }
    }
    //send the listings request
    return request(listingsRequest);
  }).then( listingsResponse => {
    res.render('listings', {
      listings: JSON.parse(listingsResponse)
    });
  }).catch( err => {
    console.error('AUTH ERROR');
    res.redirect('/');
  });
});

app.get("/listings", (req, res) => {
  let listingsRequest = {
    method: 'GET',
    uri: 'http://localhost:3030/properties',
    headers: {
      Authorization: 'Bearer ' + req.cookies.accessToken
    }
  }
  //send the listings request
  request(listingsRequest).then( listingsResponse => {
    res.render('listings', { listings: JSON.parse(listingsResponse) });
  }).catch( err => {
    console.error('AUTH ERROR');
    res.redirect('/');
  });
});


// Go to add
app.get("/add", (req, res) => {
  res.render("add");
});

// Add a property
app.post("/add", (req, res) => {
  let addListingsRequest = {
    method: 'POST',
    uri: 'http://localhost:3030/properties',
    headers: {
      Authorization: 'Bearer ' + req.cookies.accessToken
    },
    body: {
      name: req.body.name,
      address: req.body.address,
      type: req.body.type,
      capacity: req.body.capacity,
      beds: req.body.beds,
      price: req.body.price,
      image_url: req.body.imageUrl,
      owner: req.cookies.uid
    },
    json: true
  }
  request(addListingsRequest).then( addListingsResponse => {
    res.redirect('/listings');
  }).catch( err => {
    console.error(err);
    console.log('ADD LISTING ERROR');
    res.redirect('/add');
  });
});

app.listen(PORT, () => {
  console.log("Example app listening on port " + PORT);
});
