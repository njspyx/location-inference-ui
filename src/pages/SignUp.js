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

      // fetch all image ids and choose 30 random ones
      const imagesSnapshot = await firestore.collection("images").get();
      const imageIDs = imagesSnapshot.docs.map((doc) => doc.id);

      const shuffled = imageIDs.sort(() => 0.5 - Math.random());
      const assignedImages = shuffled.slice(0, totalImages);

      // save list of assigned images to user object in firestore
      await firestore.collection("users").doc(user.uid).set({
        email: user.email,
        assignedImages: assignedImages,
        currentImageIndex: 0,
      });

      onUserSignedIn();
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
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br />
      <button onClick={handleSignUp}>Sign Up</button>
    </div>
  );
}

export default SignUp;
