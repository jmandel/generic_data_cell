var i2b2 = require('./i2b2');
var settings = require('./settings');
var store = settings.store;
var rdf = store.rdf;
var crypto = require('crypto');

function bind(fn, scope) {
  return function () {
    return fn.apply(scope, arguments);
  }
}

var Graph = bind(rdf.createGraph, rdf);
var Literal = bind(rdf.createLiteral, rdf);
var NamedNode = bind(rdf.createNamedNode, rdf);
var Blank = bind(rdf.createBlankNode, rdf);
var Triple = bind(rdf.createTriple, rdf);

var md5 = function(s) {
  var r = crypto.createHash('md5');
  r.update(s);
  return r.digest('hex');
};

var addValue = function(graph, root, fact) {

  if (fact.MODIFIER_CD !== '@') {
    graph.add(Triple(
      root, 
      NamedNode("sp:modifierCode"), 
      NamedNode(fact.MODIFIER_CD)));
  }

  if (fact.VALTYPE_CD !== '@' and fact.VALTYPE_CD !== '') {
    graph.add(Triple(
      root, 
      NamedNode("sp:valType"), 
      Literal(fact.VALTYPE_CD)));
  }
 
  if (fact.TVAL_CHAR !== '') {
    graph.add(Triple(
      root, 
      NamedNode("sp:textValue"), 
      Literal(fact.TVAL_CHAR)));
  }

  if (fact.VALTYPE_CD === 'N' && fact.NVAL_NUM) {

    graph.add(Triple(
      root, 
      NamedNode("sp:numericValue"), 
      Literal(fact.NVAL_NUM)));

      if (fact.UNITS_CD !== '@') {
	graph.add(Triple(
	  root, 
	  NamedNode("sp:units"), 
	  Literal(fact.UNITS_CD)));
      }
  }
};


var parseOneFact = function(g, fact_id, fact) {

  var ofact = NamedNode(settings.HOST_NAME + 
			settings.GENERIC_DATA_PATH
			  .replace(':genericDataId', fact_id)
			  .replace(':recordId', fact.PATIENT_NUM));
  
  g.add(Triple(
    ofact, 
    NamedNode("sp:code"), 
    NamedNode(fact.CONCEPT_CD) 
  ));

  g.add(Triple(
    ofact, 
    NamedNode("rdf:type"), 
    NamedNode("sp:GenericDataItem") 
  ));

  g.add(Triple(
    ofact, 
    NamedNode("sp:forPatient"), 
    NamedNode(settings.HOST_NAME + 
	      settings.RECORD_PATH.replace(':recordId', fact.PATIENT_NUM))
  ));

  g.add(Triple(
    ofact, 
    NamedNode("sp:atEncounter"), 
    NamedNode(settings.HOST_NAME + 
	      settings.ENCOUNTER_PATH
    .replace(':recordId', fact.PATIENT_NUM)
    .replace(':encounterId', fact.ENCOUNTER_NUM))
  ));

  g.add(Triple(
    ofact, 
    NamedNode("sp:startDate"), 
    Literal(new Date(fact.START_DATE).toISOString())
  ));

  addValue(g,  ofact, fact);

  for (var i = 0; i < fact.modifiers.length; i++) {
    console.log("a blank fact modifier");
    var m = Blank();
    g.add(Triple(ofact, NamedNode("sp:modifiedBy"), m));
    addValue(g, m, fact.modifiers[i]);
  };
};

var reconcileFacts = function(g, rows) {
  var facts = {};

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];

    var fact_id = md5(r.CONCEPT_CD +'.' +
		      r.PATIENT_NUM +'.'+ 
		      r.ENCOUNTER_NUM + '.'+ 
		      r.INSTANCE_NUM);

    var fact = facts[fact_id] || (facts[fact_id] = {modifiers: []});

    if (r.MODIFIER_CD !== '@') {
      // a modifier, not a base fact
      var modifiers = fact.modifiers;
      fact ={}
      modifiers.push(fact);
    }

    for (var v in r) {
      fact[v] = r[v];
    }
  }

  for (var fact_id in facts) {
    if (facts[fact_id].PATIENT_NUM === undefined) {
      var tmp  = facts[fact_id].modifiers;
      facts[fact_id] = tmp[0];
      facts[fact_id].modifiers = tmp;
    }
  }

  return facts;
};


var parseGenericDataResult = function(rows) {
      var g = Graph();

      var facts = reconcileFacts(g, rows);
      for (var fact_id in facts) {
	parseOneFact(g, fact_id, facts[fact_id]);
      }

      return g;
}

exports.generic_data_single = function(req, res) {
  var params = {};

  params.recordId = req.params.recordId;

    i2b2.get_generic_data(params).then(function(rows) {
      var g = parseGenericDataResult(rows);
      res.contentType('text/plain');
      res.send(g.toNT());
    });

};

exports.generic_data_all = function(req, res) {
  var params = {};

  params.recordId = req.params.recordId;

  if (req.param('root', null)) {
    params.root = i2b2.path_from_uri(req.param('root'));
  }

  console.log(req.query);

  params.startDate = req.param('startDate', null);
  params.endDate = req.param('endDate', null);

  console.log("Generic data for " + req.params.record_id);
    i2b2.get_generic_data(params).then(function(rows) {
      var g = parseGenericDataResult(rows);
      res.contentType('text/plain');
      res.send(g.toNT());
    });
};

exports.concept = function(req, res) {

    var ipath = i2b2.path_from_uri(req.path);

    i2b2.get_concept(ipath).then(function(rows) {

      var g = Graph();
      var uri =  prevUri = null;

      for (var i =0; i < rows.length; i++ ) {
	var r = rows[i];

	if (i > 0 && parseInt(rows[i-1].DEPTH) <  parseInt(r.DEPTH)) {
	  prevUri = uri;
	}

	uri = NamedNode( i2b2.path_to_uri(r.PATH) );
	g.add(Triple(
		    uri,
		    NamedNode("skos:prefLabel"), 
		    Literal(r.LABEL)));

	if (r.CODE !== '') {
	  g.add(Triple(
	    uri, 
	    NamedNode("skos:closeMatch"), 
	    Literal(r.CODE)));
	}

	if (i > 0) {
	  g.add(Triple(uri, NamedNode("skos:broader"), prevUri));
	  g.add(Triple(prevUri, NamedNode("skos:narrower"), uri));
	} 

      }
      res.contentType('text/plain');
      res.send(g.toNT());
      res.end();
    });
};
