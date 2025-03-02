const admin = require("firebase-admin");
const fs = require("fs");
const csv = require("csv-parser");

// Initialize Firebase admin with your service account
const serviceAccount = require("./apart-location-inference-f196f-firebase-adminsdk-y5t42-239265f4de.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

// Category names in order they appear in the CSV
const categoryNames = [
  "Road and infrastructure",
  "Urban layout and elements",
  "Signage",
  "Architecture",
  "Traffic and vehicles",
  "Vegetation",
  "Environment and climate",
  "Lighting and shadows",
  "Recognizable landmarks",
  "Language",
  "Other cultural elements",
  "Other",
];

// Parse CSV file
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
};

// Main function to update gptGuess with categories
const updateGPTGuessCategories = async () => {
  try {
    console.log("Reading category data from CSV...");
    const categoryData = await parseCSV("gpt4o_categories.csv");
    console.log(`Loaded ${categoryData.length} category entries.`);

    // Create a map of filenames to category data for faster lookup
    const filenameToCategories = new Map();
    categoryData.forEach((entry) => {
      // Extract the category values (1 or 0) and create an array of category names that are marked as 1
      const selectedCategories = categoryNames.filter((name, index) => {
        // The index in categoryNames + 3 gives us the position in the CSV row
        // (after image_name, model_response, and distance columns)
        return entry[name] === "1";
      });

      filenameToCategories.set(entry.image_name, selectedCategories);
    });

    // Get all documents from the images collection
    const imagesSnapshot = await firestore.collection("images").get();

    console.log("Updating image documents with categories...");

    let updatedCount = 0;
    let skippedCount = 0;

    // Process in batches for better performance
    const batchSize = 500;
    let batch = firestore.batch();
    let operationCount = 0;

    for (const doc of imagesSnapshot.docs) {
      const imageData = doc.data();
      const filename = imageData.filename;

      if (!filename) {
        console.log(
          `Document ${doc.id} does not have a filename field, skipping.`
        );
        skippedCount++;
        continue;
      }

      // Skip if the document doesn't have a gptGuess field
      if (!imageData.gptGuess) {
        console.log(
          `Document ${doc.id} (${filename}) does not have a gptGuess field, skipping.`
        );
        skippedCount++;
        continue;
      }

      const categories = filenameToCategories.get(filename);
      if (!categories) {
        console.log(
          `No category data found for filename: ${filename}, skipping.`
        );
        skippedCount++;
        continue;
      }

      // Update the existing gptGuess object with categories
      const updatedGuess = {
        ...imageData.gptGuess,
        categories: categories,
      };

      batch.update(doc.ref, { gptGuess: updatedGuess });
      operationCount++;
      updatedCount++;

      // Commit batch if size limit reached
      if (operationCount >= batchSize) {
        await batch.commit();
        batch = firestore.batch();
        operationCount = 0;
        console.log(`Processed ${updatedCount} images so far.`);
      }
    }

    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(
      `Categories update complete. Updated: ${updatedCount}, Skipped: ${skippedCount}`
    );
  } catch (error) {
    console.error("Error updating categories:", error);
  } finally {
    // Terminate the Firebase app
    await admin.app().delete();
  }
};

// Run the script
updateGPTGuessCategories();
