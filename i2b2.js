var db = require('./oracle_connection');
var Promise = require('node-promise').Promise;
var settings = require('./settings');

exports.path_to_uri = function(path) {
  path = path.replace(/^\\i2b2\\/,'').replace(/\\$/, '').replace(/\\/g, '__SEP');
  path = encodeURIComponent(path);
  path = path.replace(/__SEP/g,'/');

  return "http://" + 
	  settings.HOST_NAME + 
	  settings.LOCAL_CONCEPT_PATH  +
	  path;
};

exports.path_from_uri = function(uri) {
  uri = uri.replace(settings.LOCAL_CONCEPT_PATH, '');
  uri = uri.replace(/\/$/, '');
  uri = '/i2b2/'+decodeURIComponent(uri) + (uri?  '/': '');
  console.log("pfron");
  console.log(uri);
  return uri.replace(/\//g, '\\');
};

exports.get_generic_data = function(p) {
  var promise = new Promise();

  var q = "select f.concept_cd, c.concept_path, f.patient_num,\
	   f.encounter_num, f.start_date, f.modifier_cd, f.instance_num,\
	   f.valtype_cd, f.tval_char, f.nval_num, f.valueflag_cd, f.units_cd  \
           From observation_Fact f join concept_dimension c \
                    on c.concept_cd = f.concept_cd \
           where patient_num='"+p.recordId+"'";
  
  if (p.startDate) { 
    q += " and start_date >= to_date('"+p.startDate+"') ";
  }

  if (p.endDate) {
    q += " and start_date <= to_date('"+p.endDate+"') ";
  }

  if (p.root) {
    q += " and c.concept_path like '"+p.root+"%' ";
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
		    c_basecode as code \
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
	promise.resolve(rows); 
    });

    return promise;
};
