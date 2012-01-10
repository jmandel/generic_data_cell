var rdfstore = require('rdfstore');
var store = rdfstore.create();
store.rdf.setPrefix("i2b2", "http://smarti2b2.org/terms/");
store.rdf.setPrefix("skos", "http://www.w3.org/2004/02/skos/core#");
store.rdf.setPrefix("sp", "http://smartplatforms.org/terms#");

exports.PORT = 3000;
exports.HOST_NAME = 'http://localhost:' + exports.PORT;

exports.LOCAL_CONCEPT_PATH = '/local_concepts/root/';

exports.RECORD_PATH = '/records/:recordId';
exports.ENCOUNTER_PATH = '/records/:recordId/encounters/:encounterId';

exports.GENERIC_DATA_ALL = '/records/:recordId/generic_data/';
exports.GENERIC_DATA_PATH = exports.GENERIC_DATA_ALL+':genericDataId';

exports.store = store;
