// Script to upload benchmark json to firestore collection, which will be used to assign and query images in UI.

const admin = require("firebase-admin");
const serviceAccount = require("./apart-location-inference-f196f-firebase-adminsdk-y5t42-efe95c8dc4.json");
const data = require("./coordinates.json");
const fs = require("fs");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

const uploadData = async () => {
  const batch = firestore.batch();
  data.forEach((doc) => {
    const docRef = firestore.collection("images").doc();
    batch.set(docRef, doc);
  });

  await batch.commit();
  console.log("Data uploaded successfully.");
};

uploadData().catch((error) => console.error("Error uploading data:", error));
