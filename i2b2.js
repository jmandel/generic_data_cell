var db = require('./oracle_connection');
var Promise = require('node-promise').Promise;
var all = require('node-promise').all;
var settings = require('./settings');

exports.path_to_uri = function(path) {
  path = path.replace(/^\\/g, '');
  path = path.replace(/\\$/g, '');
  path = path.replace(/\\/g, '__SEP');
  path = encodeURIComponent(path);
  path = path.replace(/__SEP/g,'/');

  return  settings.HOST_NAME + 
	  settings.LOCAL_CONCEPT_PATH  +
	  "root/"+
	  path;
};

exports.path_from_uri = function(uri) {
  console.log("path from url: " + uri);
  uri = uri.replace(settings.HOST_NAME, '');
  uri = uri.replace(settings.LOCAL_CONCEPT_PATH, '');
  uri = uri.replace(/^\/?root/, '');
  uri = uri.replace(/^\//g, '');
  uri = uri.replace(/\/$/g, '');
  uri = '/'+decodeURIComponent(uri) + (uri?  '/': '');
  console.log("pfron");
  console.log(uri);
  return uri.replace(/\//g, '\\');
};

exports.code_to_uri = function(p) {
  return  settings.HOST_NAME + 
	  settings.LOCAL_CODE_PATH
	    .replace(':dimensionId', encodeURIComponent(p.dimension))
	    .replace(':codeId', encodeURIComponent(p.code));
};


exports.get_generic_data = function(p) {
  var promise = new Promise();

  var q = "select f.concept_cd, c.concept_path, f.patient_num,\
	   f.encounter_num, f.start_date, f.end_date, f.modifier_cd, f.instance_num,\
	   f.valtype_cd, f.tval_char, f.nval_num, f.valueflag_cd, f.units_cd,  \
	   c.name_char as code_label, \
	   o.c_name as modifier_label \
           From observation_Fact f join concept_dimension c \
                    on c.concept_cd = f.concept_cd \
		left outer join i2b2metadata.i2b2 o on o.c_basecode = f.modifier_cd \
           where patient_num="+p.recordId;
  console.log(p);  
  if (p.startDate) { 
    q += " and start_date >= to_date('"+p.startDate+"', 'YYYY-MM-DD') ";
  }

  if (p.endDate) {
    q += " and start_date <= to_date('"+p.endDate+"', 'YYYY-MM-DD') ";
  }

  if (p.root) {
    q += " and c.concept_path like '"+p.root+"%' ";
  }
  if (p.single) {
    if (p.single.PATIENT_NUM !== p.recordId) {
      throw "Generic data doens't bleong to patient: " + JSON.stringify(p);
    }

    q += " and f.encounter_num = '"+p.single.ENCOUNTER_NUM+"' ";
    q += " and f.concept_cd = '"+p.single.CONCEPT_CD+"' ";
    q += " and f.instance_num = '"+p.single.INSTANCE_NUM+"' ";

  }

  console.log(q);
  db.query().execute(q, function(err, rows, cols) {
    if (err) console.log(err);
    promise.resolve(rows); 
  });

  return promise;
}

exports.get_concept = function(ipath) {
  var promise = new Promise(),
      parentPaths = [],  
      i, p;

    console.log(ipath); 
    parentPaths = [];
    ipath.split('\\').forEach(function(p) {

      if (!p) return;
      var toHere = parentPaths.length ?  
		     parentPaths[parentPaths.length - 1] : '\\';

      parentPaths.push(toHere + p + '\\');
    });

    // TODO: sanitize SQL input :-)
    parentPaths = parentPaths.splice(1);
    for (i = 0; i < parentPaths.length; i++) {
      parentPaths[i] = "c_fullname = '"+parentPaths[i]+"'";
    }

    var nextLevel =  parentPaths.length + 1;
    var q = "select c_hlevel as depth, \
		    c_fullname as path, \
		    c_name as label, \
		    c_basecode as code, \
		    LOWER(C_FACTTABLECOLUMN) as dimension \
	    from i2b2metadata.i2b2 where \
		    c_fullname='"+ipath+"'"+
		   ( (parentPaths.length > 0) ? 
		        (" or " +  parentPaths.join(' or ')) : 
		         "" 
		   ) + " or ( c_hlevel="+nextLevel+" and \
			c_fullname like '"+ipath+"%') \
	    order by c_hlevel";

    console.log(q);
    db.query().execute(q, function(err, rows, cols) {
      if (err) console.log(err);
      console.log(rows);
	promise.resolve(rows); 
    });

    return promise;
};

exports.get_concepts_for_code = function(dimension, code) {
  var promise = new Promise();

    var q = "select c_hlevel as depth, \
		    c_fullname as path, \
		    c_name as label, \
		    c_basecode as code \
	    from i2b2metadata.i2b2 where \
	    lower(c_facttablecolumn)='"+dimension+"'  and \
	    c_basecode = '"+code+"'";
  console.log(q);
    db.query().execute(q, function(err, rows, cols) {
      if (err) console.log(err);
      promise.resolve(rows);
    });

    return promise;
};
