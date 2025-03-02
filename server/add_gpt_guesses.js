const admin = require("firebase-admin");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

// Initialize Firebase admin with your service account
const serviceAccount = require("./apart-location-inference-f196f-firebase-adminsdk-y5t42-239265f4de.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

// Parse CSV files
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

// Function to update the images collection
const updateImagesCollection = async (imageGuessesData) => {
  console.log("Updating images collection...");

  // Create a map of filenames to guess data for faster lookup
  const filenameToGuessMap = new Map();
  imageGuessesData.forEach((guess) => {
    filenameToGuessMap.set(guess.image_name, guess);
  });

  // Get all documents from the images collection
  const imagesSnapshot = await firestore.collection("images").get();

  let updatedCount = 0;
  let skippedCount = 0;

  // Process all documents in batches for better performance
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

    const guessData = filenameToGuessMap.get(filename);
    if (!guessData) {
      console.log(`No guess data found for filename: ${filename}, skipping.`);
      skippedCount++;
      continue;
    }

    // Create the GPT guess object
    const gptGuess = {
      model_response: guessData.model_response,
      predicted_city: guessData.predicted_city,
      predicted_country: guessData.predicted_country,
      predicted_lat: parseFloat(guessData.predicted_lat),
      predicted_lng: parseFloat(guessData.predicted_long),
      distance: parseFloat(guessData.distance),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add update operation to batch
    batch.update(doc.ref, { gptGuess });
    operationCount++;
    updatedCount++;

    // If batch size reached, commit and reset
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
    `Images update complete. Updated: ${updatedCount}, Skipped: ${skippedCount}`
  );
};

// Function to update the photospheres collection
const updatePhotospheresCollection = async (photosphereGuessesData) => {
  console.log("Updating photospheres collection...");

  // Create a map of filenames to guess data for faster lookup
  const filenameToGuessMap = new Map();
  photosphereGuessesData.forEach((guess) => {
    filenameToGuessMap.set(guess.filename, guess);
  });

  // Get all documents from the photospheres collection
  const photospheresSnapshot = await firestore.collection("photospheres").get();

  let updatedCount = 0;
  let skippedCount = 0;

  // Process all documents in batches for better performance
  const batchSize = 500;
  let batch = firestore.batch();
  let operationCount = 0;

  for (const doc of photospheresSnapshot.docs) {
    const psData = doc.data();
    const filename = psData.filename;

    if (!filename) {
      console.log(
        `Document ${doc.id} does not have a filename field, skipping.`
      );
      skippedCount++;
      continue;
    }

    const guessData = filenameToGuessMap.get(filename);
    if (!guessData) {
      console.log(`No guess data found for filename: ${filename}, skipping.`);
      skippedCount++;
      continue;
    }

    // Use the 5th guess as you mentioned
    const gptGuess = {
      model_response: guessData.guess_5_response,
      predicted_city: guessData.guess_5_city_name,
      predicted_country: guessData.guess_5_country,
      predicted_lat: parseFloat(guessData.guess_5_lat),
      predicted_lng: parseFloat(guessData.guess_5_lng),
      heading: parseFloat(guessData.guess_5_heading),
      pitch: parseFloat(guessData.guess_5_pitch),
      distance: parseFloat(guessData.guess_5_distance),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add update operation to batch
    batch.update(doc.ref, { gptGuess });
    operationCount++;
    updatedCount++;

    // If batch size reached, commit and reset
    if (operationCount >= batchSize) {
      await batch.commit();
      batch = firestore.batch();
      operationCount = 0;
      console.log(`Processed ${updatedCount} photospheres so far.`);
    }
  }

  // Commit any remaining operations
  if (operationCount > 0) {
    await batch.commit();
  }

  console.log(
    `Photospheres update complete. Updated: ${updatedCount}, Skipped: ${skippedCount}`
  );
};

// Main function to run the script
const main = async () => {
  try {
    // Parse CSV files
    const imageGuessesData = await parseCSV("gpt-4o-full-bench.csv");
    console.log(`Loaded ${imageGuessesData.length} image guess entries.`);

    const photosphereGuessesData = await parseCSV("gpt4o_looking_around.csv");
    console.log(
      `Loaded ${photosphereGuessesData.length} photosphere guess entries.`
    );

    // Update collections
    await updateImagesCollection(imageGuessesData);
    await updatePhotospheresCollection(photosphereGuessesData);

    console.log("Database update complete!");
  } catch (error) {
    console.error("Error updating database:", error);
  } finally {
    // Terminate the Firebase app
    await admin.app().delete();
  }
};

// Run the script
main();
