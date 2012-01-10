var express = require('express');
var settings = require('./settings');
var views = require('./views');
var app = express.createServer();

console.log(settings.LOCAL_CONCEPT_PATH);

app.get(settings.LOCAL_CONCEPT_PATH+'*', views.concept);
app.get('/records/:recordId/generic_data/', views.generic_data);

app.listen(settings.PORT);
