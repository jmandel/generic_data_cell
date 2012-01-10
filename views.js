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

  if (fact.VALTYPE_CD !== '') {
    graph.add(Triple(
      root, 
      NamedNode("i2b2:valType"), 
      Literal(fact.VALTYPE_CD)));
  }
 
  if (fact.VALTYPE_CD !== '') {
    graph.add(Triple(
      root, 
      NamedNode("i2b2:valType"), 
      Literal(fact.VALTYPE_CD)));
  }
  if (fact.VALTYPE_CD === 'T' && fact.TVAL_CHAR) {
    graph.add(Triple(
      root, 
      NamedNode("sp:value"), 
      Literal(fact.TVAL_CHAR)));
  }

  if (fact.VALTYPE_CD === 'N' && fact.NVAL_NUM) {
    graph.add(Triple(
      root, 
      NamedNode("sp:value"), 
      Literal(fact.NVAL_NUM)));


      if (fact.UNITS_CD !== '@') {
	graph.add(Triple(
	  root, 
	  NamedNode("sp:units"), 
	  Literal(fact.UNITS_CD)));
      }
  }

};

var parseGenericDataResult = function(rows) {
      var i, g = Graph();

      var facts = {};
      for (i = 0; i < rows.length; i++) {
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

      for (var fact_id in facts) {
	var fact = facts[fact_id];
//	console.log(fact);
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
		    settings.RECORD_PATH.replace(':recordId', r.PATIENT_NUM))
	));
      
	g.add(Triple(
	  ofact, 
	  NamedNode("sp:atEncounter"), 
	  NamedNode(settings.HOST_NAME + 
		    settings.ENCOUNTER_PATH
		    .replace(':recordId', fact.PATIENT_NUM)
		    .replace(':encounterId', r.ENCOUNTER_NUM))
	));

	g.add(Triple(
	  ofact, 
	  NamedNode("sp:startDate"), 
	  Literal(new Date(r.START_DATE).toISOString())
	));

  	addValue(g,  ofact, fact);
      console.log("omds: " + fact.modifiers.length);
      for (var i = 0; i < fact.modifiers.length; i++) {
	console.log("a blank fact modifier");
	var m = Blank();
	g.add(Triple(ofact, NamedNode("sp:modifiedBy"), m));
	addValue(g, m, fact.modifiers[i]);
      };


      }

      return g;
}

exports.generic_data_single = function(req, res) {
  var params = {};

  params.recordId = req.params.recordId;

  if (req.param('root', null)) {
    params.root = i2b2.path_from_uri(req.param('root'));
  }

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
	console.log("uri: " + uri);
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
