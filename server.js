// For validate post method input
const Joi = require("joi");
const path = require('path');
const cors = require('cors')
const express = require("express");
const mongoose = require("mongoose");
const Schema = require('mongoose').Schema;
const app = express();
const fs = require('fs');
const { METHODS } = require("http");



// PORT for production
const port = process.env.PORT || 8080;

// DB Config
mongo_ip = "localhost";
mongo_port = "27018"
DB_NAME = "TableView"
MONGO_URI = `${mongo_ip}:${mongo_port}`
const db_URI = `mongodb://${MONGO_URI}/${DB_NAME}`;

// Connect to Mongo
mongoose
  .connect(db_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }) // Adding new mongo url parser
  .then(() => console.log('MongoDB Connected...'))
  .catch(err => console.log(err));

//Define schemas for the following models
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
  { collection: 'dbSNP153_Annotation' });

var Disease2SNPSchema = new Schema({
},
  { collection: 'Disease2SNP' });


var GeneSchema = new Schema({
},
  { collection: 'gene' });

var PromoterSchema = new Schema({

},
  { collection: 'Promoter' });


// Create models for the different table, models server as a middle layer operatable instance between db and js  
let dbSNP153_Annotation = mongoose.model('dbSNP153_Annotation', AnnotationSchema);

let Disease2SNP = mongoose.model('Disease2SNP', Disease2SNPSchema);

let Gene = mongoose.model('gene', GeneSchema);

let Promoter = mongoose.model('Promoter', PromoterSchema);

// get bin id list from a promoter range
const getBinIDs = (chr, start, end, resolution) => {
  let ret = []
  let s = parseInt(start / resolution) * resolution
  let e = parseInt(start / resolution) * resolution + resolution
  while (s != e) {
    ret.push(`${chr}:${s}-${s + resolution}`)
    s += resolution
  }
  return ret
}


// CORS-enabled for all origins, needed for public availability
app.use(cors())

// a send file example, not used in the API, but kept for future reference
app.get("/api/tfprinting/", (req, res) => {

  res.sendFile(
    path.join(__dirname + '/tf_footprinting_template.html')
  )
})




// fetch SNP data from the snp table, this is the old version, since we will change to using the promoter table, this will be deprecated
app.get("/api/snp/:rsid", (req, res) => {
  // console.log(req.params.rsid)
  dbSNP153_Annotation.find({ "RSID": req.params.rsid }, (err, snp) => {
    if (err) return handleError(err);
    res.send(snp);
  })
});




// fetch disease data from disease collection, which is basically gwas catalog info, then, use the snp list to get all snps
// using async - await is much clearer than previous callback format, this can be used as a template for future API dev
// this will also needed to be updated since we have a new snp data fetching mechanism using promoter table 
app.get("/api/disease/:disease", async (req, res, next) => {
  try {
    // get data from disease table
    const disease = await Disease2SNP.findOne({ "trait": req.params.disease })

    // this is basically the old version of SNP data fetching. Need to be updated in the future.
    const snps = await dbSNP153_Annotation.find({ "RSID": { "$in": disease.toJSON().SNPs } })

    // send data to whoever calls this API
    res.send(snps)
  } catch (error) {
    next(error);
  }
});

// fetch data by the gene, cell type info is needed in the req
app.get("/api/gene/:gene", async (req, res, next) => {
  // console.log(req.params.rsid)
  try {
    // get gene data from Baikang's gene table for the summary card info. i.e. full name, alias....
    const gene = await Gene.findOne({ "gene_symbol": req.params.gene })

    // get promtoer info from Ming-Ju's promoter table by gene name.
    const promoters = await Promoter.find({ "Gene": req.params.gene })

    // package both info as a single json obj and send to the frontend.
    let response = { gene: gene, promoters: promoters }

    res.send(response)
  } catch (error) {
    next(error);
  }
});

// fetch data by using coordinates, cell type info is needed in the req
app.get("/api/range/:coordinates", async (req, res, next) => {


  let coordinates = req.params.coordinates
  // parse the coordinates 
  // parseInt needs to be removed and have all chr onverted to str, note: this is some inconsistancy between the datatype between different table, i.e. chr is a numeric dt in a table, but a char in another table 
  let chr = parseInt(coordinates.split(":")[0]);
  let tmp = coordinates.split(":")[1];
  let start = parseInt(tmp.split("-")[0])
  let end = parseInt(tmp.split("-")[1])

  // use the parsed info to craete the query 
  let myquery = { "$and": [{ "Start": { "$gt": start } }, { "Start": { "$lt": end } }, { "Chr": chr }] }

  try {
    

    const snps = await dbSNP153_Annotation.find(myquery)
    
    // create the content, which will be store in the file sent from API call 
    let content = "RSID,Chr,Start,End,Ref,Alt\n"
    for (let snp of snps) {
      let entry = JSON.parse(JSON.stringify(snp))
      for (let key of ["RSID", "Chr", "Start", "End", "Ref", "Alt"]) {
        content += entry[key] + ","
      }
      content += "\n"
      
    }
    // console.log(content)

    fs.writeFile(`SNPs_chr${chr}:${start}-${end}.csv`, content, function (err) {
      if (err) throw err;
      console.log('File is created successfully.');
      // This is the behaviour let user directly download the csv file by calling api
      res.download(`./SNPs_chr${chr}:${start}-${end}.csv`);
    });
  } catch (error) {
    next(error);
  }
});


// Unfinished new snp data fetch METHODS, need to pass back the promoters and snp info in a whole obj, cell type info is needed in the req
app.get("/api/snp2promoter/:rsid", async (req, res) => {
  try {
    const snps = await dbSNP153_Annotation.find({ "RSID": req.params.rsid})
    
    // get one of the sighic data, given the snp rsid is fixed, the interacting bin info should be the same
    let SigHiC_NHCFV = snps[0].toJSON()["SigHiC_NHCFV"]

    // parse to get reg bin and promoter bin info
    let reg_bin_Re = RegExp('RegulatoryBin:(.*?);')
    let reg = reg_bin_Re.exec(SigHiC_NHCFV)[1]
    
    let prom_bin_Re = RegExp('PromoterBin:(.*?)$')
    let prom_bin = prom_bin_Re.exec(SigHiC_NHCFV)[1]
    let proms = prom_bin.split(",")

    // get promoter info from the promoter table from Ming-Ju 
    const promoters = await Promoter.find({ "$and": [{ "HiC_Distal_bin": reg}, { "HiC_Promoter_bin": { "$in": proms }}]})

    res.send(promoters)


    // res.send(snps)
  } catch (error) {
    
    console.log(error);
  }
});

// Enble the application listen to port, which is 8080, by default(defined above)
app.listen(port, () => { console.log(`running on port ${port}`) })

