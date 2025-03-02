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
  const [region, setRegion] = useState("North America"); // Default region is North America

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

      // Create new user document with initial data
      const userRef = firestore.collection("users").doc(user.uid);

      await userRef.set({
        email: email,
        region: region,
        createdAt: new Date(), // Use JavaScript Date instead of serverTimestamp
        currentImageIndex: 0, // Start with index 0 for the first image
        currentPhotosphereIndex: 0, // Start with index 0 for the first photosphere
        guessCount: 0,
        totalDistance: 0,
        gptWinCount: 0, // Number of times GPT had a better guess
        userWinCount: 0, // Number of times user had a better guess
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
