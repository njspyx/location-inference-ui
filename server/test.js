const admin = require("firebase-admin");
const fs = require("fs");

// Initialize Firebase admin with your service account
const serviceAccount = require("./apart-location-inference-f196f-firebase-adminsdk-y5t42-239265f4de.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

// Delete all users and their guesses
const deleteAllUsers = async () => {
  console.log("Deleting all user documents...");

  try {
    const usersSnapshot = await firestore.collection("users").get();

    if (usersSnapshot.empty) {
      console.log("No users found to delete.");
      return;
    }

    // For each user document
    const deletionPromises = usersSnapshot.docs.map(async (userDoc) => {
      const userRef = userDoc.ref;

      // First get and delete all guesses subcollections
      const guessesSnapshot = await userRef.collection("guesses").get();

      if (!guessesSnapshot.empty) {
        const batchSize = 500;
        let batch = firestore.batch();
        let operationCount = 0;

        guessesSnapshot.docs.forEach((guessDoc) => {
          batch.delete(guessDoc.ref);
          operationCount++;

          if (operationCount >= batchSize) {
            batch.commit();
            batch = firestore.batch();
            operationCount = 0;
          }
        });

        if (operationCount > 0) {
          await batch.commit();
        }

        console.log(
          `Deleted ${guessesSnapshot.size} guesses for user ${userDoc.id}`
        );
      }

      // Now delete the user document
      await userRef.delete();
      console.log(`Deleted user ${userDoc.id}`);
    });

    await Promise.all(deletionPromises);
    console.log(
      `Successfully deleted all ${usersSnapshot.size} users and their guesses.`
    );
  } catch (error) {
    console.error("Error deleting users:", error);
    throw error;
  }
};

// Reset settings documents
const resetSettings = async () => {
  console.log("Resetting settings documents...");

  try {
    // Update the imageAssignment settings - remove nextImageIndex
    await firestore.collection("settings").doc("imageAssignment").update({
      nextImageIndex: admin.firestore.FieldValue.delete(),
    });

    // Update the photosphereAssignment settings - remove nextImageIndex
    await firestore.collection("settings").doc("photosphereAssignment").update({
      nextImageIndex: admin.firestore.FieldValue.delete(),
    });

    console.log("Settings documents have been reset.");
  } catch (error) {
    console.error("Error resetting settings:", error);
    throw error;
  }
};

// Count total images and photospheres
const countTotalItems = async () => {
  console.log("Counting total images and photospheres...");

  try {
    const [imagesSnapshot, photospheresSnapshot] = await Promise.all([
      firestore.collection("images").get(),
      firestore.collection("photospheres").get(),
    ]);

    const totalImages = imagesSnapshot.size;
    const totalPhotospheres = photospheresSnapshot.size;

    console.log(`Total images: ${totalImages}`);
    console.log(`Total photospheres: ${totalPhotospheres}`);

    // Update the settings documents with the counts
    await firestore.collection("settings").doc("imageAssignment").set(
      {
        totalNumberOfImages: totalImages,
      },
      { merge: true }
    );

    await firestore.collection("settings").doc("photosphereAssignment").set(
      {
        totalNumberOfImages: totalPhotospheres,
      },
      { merge: true }
    );

    console.log("Settings updated with total counts.");

    return { totalImages, totalPhotospheres };
  } catch (error) {
    console.error("Error counting items:", error);
    throw error;
  }
};

// Main function to run the script
const main = async () => {
  try {
    // Step 1: Delete all users
    await deleteAllUsers();

    // Step 2: Reset settings
    await resetSettings();

    // Step 3: Count and update totals
    const { totalImages, totalPhotospheres } = await countTotalItems();

    console.log("Database reset complete!");
    console.log(
      "Your system is now ready for sequential image/photosphere delivery."
    );
    console.log(
      `New users will be given images sequentially from 0 to ${totalImages - 1}`
    );
    console.log(
      `and photospheres sequentially from p_0 to p_${totalPhotospheres - 1}.`
    );
  } catch (error) {
    console.error("Error resetting database:", error);
  } finally {
    // Terminate the Firebase app
    await admin.app().delete();
  }
};

// Run the script
main();
