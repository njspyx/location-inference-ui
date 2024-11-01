// Script to upload benchmark json to firestore collection, which will be used to assign and query images in UI.

const admin = require("firebase-admin");
const serviceAccount = require("./apart-location-inference-f196f-firebase-adminsdk-y5t42-239265f4de.json");
const data = require("./coordinates_20percent.json");
const fs = require("fs");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

const uploadData = async () => {
  const batch = firestore.batch();
  data.forEach((doc, index) => {
    const docRef = firestore.collection("photosphere").doc(index.toString()); // Set doc ID to index as string
    batch.set(docRef, doc);
  });

  await batch.commit();
  console.log("Data uploaded successfully.");

  await firestore.collection("settings").doc("photosphereAssignment").set({
    totalNumberOfImages: data.length,
    nextImageIndex: 0,
  });
};

// delete current images collection
firestore
  .collection("photosphere")
  .get()
  .then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      doc.ref.delete();
    });
  });

// upload new data
uploadData().catch((error) => console.error("Error uploading data:", error));
