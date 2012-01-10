var rdfstore = require('rdfstore');
var store = rdfstore.create();

store.rdf.setPrefix("i2b2", "http://smarti2b2.org/terms#");
store.rdf.setPrefix("skos", "http://www.w3.org/2004/02/kos/core#");

exports.LOCAL_CONCEPT_PATH = '/local_concepts/root/';
exports.store = store;
