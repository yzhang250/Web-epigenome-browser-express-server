// For validate post method input
const Joi = require("joi");

const cors = require('cors')
const express = require("express");
const mongoose = require("mongoose");
const Schema = require('mongoose').Schema;
const app = express();

// PORT for production
const port = process.env.PORT || 8080;

// DB Config
mongo_ip = "localhost";
mongo_port = "27017"
DB_NAME = "TableView"
MONGO_URI = `${mongo_ip}:${mongo_port}`
const db_URI = `mongodb://${MONGO_URI}/${DB_NAME}`;

// Connect to Mongo
mongoose
  .connect(db_URI, {
    useNewUrlParser: true,
  }) // Adding new mongo url parser
  .then(() => console.log('MongoDB Connected...'))
  .catch(err => console.log(err));

//Define a schema
var AnnotationSchema = new Schema({ 
  // _id: Schema.Types.ObjectId, 
  // RSID: String,
  // Chr: Number, 
  // Start: Number, 
  // End: Number, 
  // Ref: String, 
  // Alt: String,
  // Region:String,
  // GeneName_ID_Ensembl: String,
  // AAChange_Ensembl: String,
  // gwasCatalog: String
}, 
{ collection : 'dbSNP153_Annotation' });

var Disease2SNPSchema = new Schema({ 
  // _id: Schema.Types.ObjectId, 
  // RSID: String,
  // Chr: Number, 
  // Start: Number, 
  // End: Number, 
  // Ref: String, 
  // Alt: String,
  // Region:String,
  // GeneName_ID_Ensembl: String,
  // AAChange_Ensembl: String,
  // gwasCatalog: String
}, 
{ collection : 'Disease2SNP' });


let dbSNP153_Annotation = mongoose.model('dbSNP153_Annotation', AnnotationSchema);

let Disease2SNP = mongoose.model('Disease2SNP', Disease2SNPSchema);

// CORS-enabled for all origins
app.use(cors())

app.get("/api/snp/:rsid", (req, res) => {
    // console.log(req.params.rsid)
    dbSNP153_Annotation.find({"RSID": req.params.rsid}, (err, snp) => {
      if (err) return handleError(err);
      res.send(snp);
    })
});

// collection.find({"RSID": { "$in": [ "rs554551566", "rs1414996067" ] }})
// fetch disease data
app.get("/api/disease/:disease", async (req, res, next) => {
  // console.log(req.params.rsid)
  try {
    let entries = []
    const disease = await Disease2SNP.findOne({"trait":req.params.disease})

    const snps = await dbSNP153_Annotation.find({"RSID": { "$in": disease.toJSON().SNPs}})
    res.send(snps)
  } catch (error) {
    //console.error(error);
    //res.json({success: false, error: error.message});
    next(error);
  }
  
  // let snps = disease.toJson().SNPs
  // let test = snps[0]
  // const query2 = dbSNP153_Annotation.find({"RSID": { "$in": snps}})
  // // entries =  await query2.exec()
  // const query2 = dbSNP153_Annotation.find({"RSID": test})
  // entries =  await query2.exec()

  // Disease2SNP.findOne({"trait":req.params.disease}, (err, disease) =>{
  //   if (err) return handleError(err);
  //   let snps = disease.SNPs
  //   dbSNP153_Annotation.find({"RSID": { "$in": snps}}, (err, snp_entries) => {
  //     if (err) return handleError(err);
  //     entries = snp_entries
  //     res.send(entries);
  //   })
  // })  
  
});



app.listen(port, ()=>{console.log(`running on port ${port}`)})