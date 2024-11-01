import React, { useState } from "react";
import { auth, firestore } from "../firebase/firebase";
import {
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";

function SignUp({ onUserSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState(""); // ask for region to determine what storage bucket to use

  // const totalImages = 30;

  const handleSignUp = async () => {
    if (!region) {
      alert("Please select your region.");
      return;
    }

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(
        email,
        password
      );
      const user = userCredential.user;

      // Send email verification
      await user.sendEmailVerification();

      // NOTE: this is old code that assigns 30 images to each user on sign-up
      // This is useful for crowdsourcing data collection, but not necessary for this project

      // retrieve and update assigned images and next image index
      // await firestore.runTransaction(async (transaction) => {
      //   const settingsRef = firestore
      //     .collection("settings")
      //     .doc("imageAssignment");
      //   const settingsDoc = await transaction.get(settingsRef);

      //   if (!settingsDoc.exists) {
      //     throw new Error("Settings document does not exist.");
      //   }

      //   const data = settingsDoc.data();
      //   const totalNumberOfImages = data.totalNumberOfImages;
      //   let nextImageIndex = data.nextImageIndex || 0;

      //   // compute assigned images; get N next images in list and wrap around if necessary
      //   const assignedImages = [];
      //   for (let i = 0; i < totalImages; i++) {
      //     const imageIndex = (nextImageIndex + i) % totalNumberOfImages;
      //     const imageId = imageIndex.toString();
      //     assignedImages.push(imageId);
      //   }

      //   // Get the next image index using settings collection
      //   const newNextImageIndex =
      //     (nextImageIndex + totalImages) % totalNumberOfImages;
      //   transaction.update(settingsRef, { nextImageIndex: newNextImageIndex });

      // save assigned images to user document

      // });
      // set email and region for user in firestore
      // Assign initial currentImageId and update nextImageIndex
      await firestore.runTransaction(async (transaction) => {
        const settingsRef = firestore
          .collection("settings")
          .doc("imageAssignment");
        const userRef = firestore.collection("users").doc(user.uid);
        const settingsDoc = await transaction.get(settingsRef);

        if (!settingsDoc.exists) {
          throw new Error("Settings document does not exist.");
        }

        const data = settingsDoc.data();
        const totalNumberOfImages = data.totalNumberOfImages;
        let nextImageIndex = data.nextImageIndex || 0;

        // Get the image ID corresponding to nextImageIndex
        const imageId = nextImageIndex.toString();

        // Update nextImageIndex
        const newNextImageIndex = (nextImageIndex + 1) % totalNumberOfImages;
        transaction.update(settingsRef, { nextImageIndex: newNextImageIndex });

        // Create user document with initial data
        transaction.set(userRef, {
          email: email,
          region: region,
          currentImageId: imageId,
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

          <FormControl component="fieldset" margin="normal">
            <FormLabel component="legend">Select Your Region</FormLabel>
            <RadioGroup
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              row
            >
              <FormControlLabel
                value="North America"
                control={<Radio color="primary" />}
                label="North America"
              />
              <FormControlLabel
                value="South America"
                control={<Radio color="primary" />}
                label="South America"
              />
              <FormControlLabel
                value="Europe"
                control={<Radio color="primary" />}
                label="Europe"
              />
              <FormControlLabel
                value="Africa"
                control={<Radio color="primary" />}
                label="Africa"
              />
              <FormControlLabel
                value="Asia"
                control={<Radio color="primary" />}
                label="Asia"
              />
              <FormControlLabel
                value="Oceania"
                control={<Radio color="primary" />}
                label="Oceania"
              />
            </RadioGroup>
          </FormControl>

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
