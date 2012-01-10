var rdfstore = require('rdfstore');
var store = rdfstore.create();
store.rdf.setPrefix("i2b2", "http://smarti2b2.org/terms/");
store.rdf.setPrefix("skos", "http://www.w3.org/2004/02/skos/core#");

exports.LOCAL_CONCEPT_PATH = '/local_concepts/root/';
exports.HOST_NAME = 'http://localhost:3000';
exports.RECORD_PATH = '/records/{record_id}';
exports.ENCOUNTER_PATH = '/records/{record_id}/encounters/{encounter_id}';
exports.GENERIC_DATA_PATH = '/records/{record_id}/generic_data/{generic_data_id}';

exports.store = store;
