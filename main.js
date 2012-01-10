var express = require('express');
var settings = require('./settings');
var views = require('./views');
var app = express.createServer();

console.log(settings.LOCAL_CONCEPT_PATH);

app.get(settings.LOCAL_CONCEPT_PATH+'*', views.concept);
app.get(settings.GENERIC_DATA_ALL, views.generic_data_all);
app.get(settings.GENERIC_DATA_PATH, views.generic_data_single);

app.listen(settings.PORT);
