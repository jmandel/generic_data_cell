var i2b2 = require('./i2b2');
var settings = require('./settings');
var store = settings.store;
var rdf = store.rdf;
var crypto = require('crypto');
var all = require('node-promise').all;
var Promise = require('node-promise').Promise;

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

var fillOutFact = function(graph, root, fact) {

  if (fact.MODIFIER_CD !== '@') {
     var modUri = NamedNode(i2b2.code_to_uri({dimension: 'modifier_cd', code: fact.MODIFIER_CD}));

     graph.add(Triple(
       modUri, 
       NamedNode("skos:prefLabel"), 
       Literal(fact.MODIFIER_LABEL)));

    add_code_with_external_mappings(graph, root, NamedNode('sp:modifierCode'), 
				      { dimension: 'modifier_cd', 
					code: fact.MODIFIER_CD});
  }

  if (fact.VALTYPE_CD !== '@' && fact.VALTYPE_CD !== '') {
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

  if (fact.VALUEFLAG_CD!== '') {
    graph.add(Triple(
      root, 
      NamedNode("sp:flagValue"), 
      Literal(fact.VALUEFLAG_CD)));
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
 
  var codeUri = NamedNode(i2b2.code_to_uri({dimension: 'concept_cd', code: fact.CONCEPT_CD}));
  add_code_with_external_mappings(g, ofact, NamedNode('sp:code'), {dimension: 'concept_cd', code: fact.CONCEPT_CD});

  g.add(Triple(
    codeUri, 
    NamedNode("skos:prefLabel"), 
    Literal(fact.CODE_LABEL)));

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

  g.add(Triple(
    ofact, 
    NamedNode("sp:endDate"), 
    Literal(new Date(fact.END_DATE).toISOString())
  ));

  fillOutFact(g,  ofact, fact);

  for (var i = 0; i < fact.modifiers.length; i++) {
    console.log("a blank fact modifier");
    var m = Blank();
    g.add(Triple(ofact, NamedNode("sp:modifiedBy"), m));
    fillOutFact(g, m, fact.modifiers[i]);
  };
};

var reconcileFacts = function(g, rows) {
  var facts = {};

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];

    var fact_id = encodeId(r);

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

var encodeId = function(p) {

  var b = { c: p.CONCEPT_CD,
            p: p.PATIENT_NUM,
	    e: p.ENCOUNTER_NUM,
	    i: p.INSTANCE_NUM
  };

  console.log("ENCODING AS:  " + JSON.stringify(b));
  return new Buffer(JSON.stringify(b)).toString('base64');
};


var decodeId = function(id) {
    var parts = JSON.parse(new Buffer(id, 'base64')
      .toString('utf8'));
  
      console.log(parts);
    return {
      CONCEPT_CD: parts.c,
      PATIENT_NUM: parts.p,
      ENCOUNTER_NUM: parts.e,
      INSTANCE_NUM: parts.i
    }

}
exports.generic_data_single = function(req, res) {
  var params = {};

  params.recordId = parseInt(req.params.recordId);
  params.single = decodeId(req.params.genericDataId);

    i2b2.get_generic_data(params).then(function(rows) {
      var g = parseGenericDataResult(rows);
      res.header('Content-Type', 'text/plain');
      res.write(g.toNT());
      res.end();
    });

};

exports.generic_data_all = function(req, res) {
  var params = {};

  params.recordId = req.params.recordId;

  if (req.param('below', null)) {
    params.root = i2b2.path_from_uri(req.param('below'));
  }

  console.log(req.query);

  params.startDate = req.param('after', null);
  params.endDate = req.param('before', null);

  console.log("Generic data for " + req.params.record_id);
    i2b2.get_generic_data(params).then(function(rows) {
      var g = parseGenericDataResult(rows);
      res.header('Content-Type', 'text/plain');
      res.send(g.toNT());
    });
};


add_code_with_external_mappings = function(g, subject, predicate, code) {
  console.log("EXT MAP " + code);

  var codeUri = NamedNode(i2b2.code_to_uri(code));

  g.add(Triple(
    subject, 
    predicate,
    codeUri));

  settings.vocab_mappings.forEach(function(mapper) {
    var r = mapper(code.code);
    if (r) {
      console.log("Adding");
      g.add(Triple(
	codeUri,
	NamedNode("skos:exactMatch"),
	NamedNode(r)
      ));
    }
  });
};

get_concept = function(p) {
  var promise = new Promise();
  var ipath = p.path;
  var g = p.graph;
  console.log(p); 
  i2b2.get_concept(ipath).then(function(rows) {

    var uri =  prevUri = null;

    // walk down the hierarchy asserting each node
    // as its own URI with label and links:
    //     narrower --> parent
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
	add_code_with_external_mappings(g, uri, NamedNode('skos:closeMatch'), {dimension: r.DIMENSION, code: r.CODE});
      }

      if (i > 0) {
	g.add(Triple(prevUri, NamedNode("skos:narrower"), uri));
      } 

    }

    promise.resolve(g);
  });

  return promise;
};

exports.code = function(req, res) {

  var dimension = req.params.dimensionId;
  var code = req.params.codeId;

  i2b2.get_concepts_for_code(dimension, code).then(function(rows) {
  console.log(rows);
    var conceptPromises = [];
    var g = Graph();

    rows.forEach(function(r) {
      conceptPromises.push(get_concept({ path: r.PATH, graph: g}));
    });

    all(conceptPromises).then(function() {
      res.header('Content-Type', 'text/plain');
      res.send(g.toNT());
    });

  });
};

exports.concept = function(req, res) {
  var p = {
    path: i2b2.path_from_uri(req.path),
    graph: Graph()
  };
  console.log("Single concept: ");
  get_concept(p).then(function() {
    res.header('Content-Type', 'text/plain');
    res.send(p.graph.toNT());
    res.end();
  });

};
