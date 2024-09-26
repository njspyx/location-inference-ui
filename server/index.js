const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const csv = require("csvtojson");
const fs = require("fs");
const path = require("path");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// Serve images
app.use("/imgs_v2", express.static(path.join(__dirname, "imgs_v2")));

// Get image data from coordinates.csv
app.get("/api/images", (req, res) => {
  const csvFilePath = path.join(__dirname, "coordinates.csv");
  csv()
    .fromFile(csvFilePath)
    .then((jsonObj) => {
      res.json(jsonObj);
    })
    .catch((err) => {
      res.status(500).send(err);
    });
});

// Save user results
app.post("/api/submit", (req, res) => {
  const data = req.body;
  const resultsFile = path.join(__dirname, "results.csv");

  // Categories to be used as columns
  const categories = [
    "Climate",
    "Architecture",
    "Street Signs",
    "Language",
    "Landmark",
    "Vegetation",
    "Vehicle",
    "Urban Layout",
    "Cultural Element",
  ];

  // One-hot encode categories
  const categoryData = {};
  categories.forEach((category) => {
    categoryData[category] = data.categories.includes(category) ? 1 : 0;
  });

  const csvWriter = createCsvWriter({
    path: resultsFile,
    header: [
      { id: "filename", title: "Filename" },
      { id: "userLat", title: "User Latitude" },
      { id: "userLng", title: "User Longitude" },
      { id: "distance", title: "Distance" },
      ...categories.map((category) => ({ id: category, title: category })),
    ],
    append: fs.existsSync(resultsFile), // Append if file exists
  });

  const record = {
    filename: data.filename,
    userLat: data.userLat,
    userLng: data.userLng,
    distance: data.distance,
    ...categoryData,
  };

  csvWriter
    .writeRecords([record])
    .then(() => res.json({ success: true }))
    .catch((err) => res.status(500).send(err));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
