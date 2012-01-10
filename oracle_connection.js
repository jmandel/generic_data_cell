var oracle = require('db-oracle');

var i2b2 = new oracle.Database({
    hostname: '192.168.1.126',
    user: 'i2b2demodata',
    password: 'demouser'
});

i2b2.connect(function(error) {
    if (error) {
      return console.log("CONNECTION ERROR: " + error);
    }
    var q = "select f.concept_cd, c.concept_path, f.patient_num, f.encounter_num, f.start_date, f.modifier_cd, f.instance_num, f.valtype_cd, f.tval_char, f.nval_num, f.valueflag_cd  From observation_Fact f join concept_dimension c on c.concept_cd = f.concept_cd where f.concept_cd like 'LOINC%' and rownum<2";
    i2b2.query().execute(q, function(err, rows){
      console.log(err);
      console.log(rows);
    });
});

module.exports = i2b2;
