// SignUp.js
import React, { useState } from "react";
import { auth, firestore } from "../firebase/firebase";
import {
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  Box,
} from "@mui/material";

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
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ padding: 4, marginTop: 8 }}>
        <Typography variant="h4" gutterBottom>
          Sign Up
        </Typography>
        <Box component="form" noValidate autoComplete="off">
          <TextField
            type="email"
            label="Email"
            variant="outlined"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
          />
          <TextField
            type="password"
            label="Password (minimum 6 characters)"
            variant="outlined"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSignUp}
            fullWidth
            sx={{ marginTop: 2 }}
          >
            Sign Up
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default SignUp;
