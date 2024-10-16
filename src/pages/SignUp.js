import React, { useState } from "react";
import { auth, firestore } from "../firebase/firebase";

function SignUp({ onUserSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const totalImages = 30;

  const handleSignUp = async () => {
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(
        email,
        password
      );
      const user = userCredential.user;

      // Send email verification
      await user.sendEmailVerification();

      // Use a transaction to get and update nextImageIndex
      await firestore.runTransaction(async (transaction) => {
        const settingsRef = firestore
          .collection("settings")
          .doc("imageAssignment");
        const settingsDoc = await transaction.get(settingsRef);

        if (!settingsDoc.exists) {
          throw new Error("Settings document does not exist.");
        }

        const data = settingsDoc.data();
        const totalNumberOfImages = data.totalNumberOfImages;
        let nextImageIndex = data.nextImageIndex || 0;

        // Compute assigned images
        const assignedImages = [];
        for (let i = 0; i < totalImages; i++) {
          const imageIndex = (nextImageIndex + i) % totalNumberOfImages;
          const imageId = imageIndex.toString();
          assignedImages.push(imageId);
        }

        // Update nextImageIndex
        const newNextImageIndex =
          (nextImageIndex + totalImages) % totalNumberOfImages;
        transaction.update(settingsRef, { nextImageIndex: newNextImageIndex });

        // Save assigned images to user's document
        const userRef = firestore.collection("users").doc(user.uid);
        transaction.set(userRef, {
          email: user.email,
          assignedImages: assignedImages,
          currentImageIndex: 0,
        });
      });

      alert(
        "A verification email has been sent to your email address. Please verify your email before logging in."
      );
    } catch (error) {
      console.error("Error signing up:", error);
      alert(error.message);
    }
  };

  return (
    <div>
      <h2>Sign Up</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br />
      <input
        type="password"
        placeholder="Password (minimum 6 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br />
      <button onClick={handleSignUp}>Sign Up</button>
    </div>
  );
}

export default SignUp;
