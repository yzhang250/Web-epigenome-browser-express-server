// For validate post method input
const Joi = require("joi");
const path = require('path');
const cors = require('cors')
const express = require("express");
const mongoose = require("mongoose");
const Schema = require('mongoose').Schema;
const app = express();
const fs = require('fs');



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


// CORS-enabled for all origins
app.use(cors())

app.get("/api/tfprinting/", (req, res) => {

  res.sendFile(
    path.join(__dirname + '/tf_footprinting_template.html')
  )
})

app.get("/api/snp2promoter/:rsid", async (req, res) => {
  try {
    const snps = await dbSNP153_Annotation.find({ "RSID": req.params.rsid})
    
    let SigHiC_NHCFV = snps[0].toJSON()["SigHiC_NHCFV"]
    let reg_bin_Re = RegExp('RegulatoryBin:(.*?);')
    let reg = reg_bin_Re.exec(SigHiC_NHCFV)[1]
    
    let prom_bin_Re = RegExp('PromoterBin:(.*?)$')
    let prom_bin = prom_bin_Re.exec(SigHiC_NHCFV)[1]
    let proms = prom_bin.split(",")

    const promoters = await Promoter.find({ "$and": [{ "HiC_Distal_bin": reg}, { "HiC_Promoter_bin": { "$in": proms }}]})

    res.send(promoters)


    // res.send(snps)
  } catch (error) {
    //console.error(error);
    //res.json({success: false, error: error.message});
    console.log(error);
  }
});



app.get("/api/snp/:rsid", (req, res) => {
  // console.log(req.params.rsid)
  dbSNP153_Annotation.find({ "RSID": req.params.rsid }, (err, snp) => {
    if (err) return handleError(err);
    res.send(snp);
  })
});



// collection.find({"RSID": { "$in": [ "rs554551566", "rs1414996067" ] }})
// fetch disease data
app.get("/api/disease/:disease", async (req, res, next) => {
  // console.log(req.params.rsid)
  try {
    const disease = await Disease2SNP.findOne({ "trait": req.params.disease })

    const snps = await dbSNP153_Annotation.find({ "RSID": { "$in": disease.toJSON().SNPs } })
    res.send(snps)
  } catch (error) {
    //console.error(error);
    //res.json({success: false, error: error.message});
    next(error);
  }
});

// fetch data re the gene and cell line
app.get("/api/gene/:gene", async (req, res, next) => {
  // console.log(req.params.rsid)
  try {
    // let entries = []
    // const gene = await Gene2SNP.findOne({ "gene": req.params.gene })

    // const snps_promoter = await dbSNP153_Annotation.find({ "RSID": { "$in": gene.toJSON().promoter_snps } })
    // const snps_distal = await dbSNP153_Annotation.find({
    //   "RSID": {
    //     "$in": gene.toJSON().distal_snps
    //     // .slice(0, 10)  
    //   }
    // })
    // const snps = snps_promoter.concat(snps_distal)

    const gene = await Gene.findOne({ "gene_symbol": req.params.gene })
    const promoters = await Promoter.find({ "Gene": req.params.gene })

    let response = { gene: gene, promoters: promoters }

    res.send(response)
  } catch (error) {
    //console.error(error);
    //res.json({success: false, error: error.message});
    next(error);
  }
});

// fetch data re the gene and cell line
app.get("/api/range/:coordinates", async (req, res, next) => {
  // console.log(req.params.rsid)
  let coordinates = req.params.coordinates
  // parseInt needs to be removed and have all chr onverted to str  
  let chr = parseInt(coordinates.split(":")[0]);
  let tmp = coordinates.split(":")[1];
  let start = parseInt(tmp.split("-")[0])
  let end = parseInt(tmp.split("-")[1])

  let myquery = { "$and": [{ "Start": { "$gt": start } }, { "Start": { "$lt": end } }, { "Chr": chr }] }

  try {
    // let entries = []

    const snps = await dbSNP153_Annotation.find(myquery)
    // const snps_distal = await dbSNP153_Annotation.find({ "RSID": { "$in": gene.toJSON().distal_snps
    // .slice(0, 10)  
    // } })

    let content = "RSID,Chr,Start,End,Ref,Alt\n"
    for (let snp of snps) {
      let entry = JSON.parse(JSON.stringify(snp))
      for (let key of ["RSID", "Chr", "Start", "End", "Ref", "Alt"]) {
        content += entry[key] + ","
      }
      content += "\n"
      // rsids.push(["RSID"])
    }
    console.log(content)

    fs.writeFile(`SNPs_chr${chr}:${start}-${end}.csv`, content, function (err) {
      if (err) throw err;
      console.log('File is created successfully.');
      // res.send(snps)
      res.download(`./SNPs_chr${chr}:${start}-${end}.csv`);
    });
  } catch (error) {
    //console.error(error);
    //res.json({success: false, error: error.message});
    next(error);
  }
});



app.listen(port, () => { console.log(`running on port ${port}`) })