// Login.js
import React, { useState } from "react";
import { auth } from "../firebase/firebase";
import {
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  Box,
} from "@mui/material";

function Login({ onUserSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      await auth.signInWithEmailAndPassword(email, password);
      const user = auth.currentUser;

      if (user.emailVerified) {
        onUserSignedIn();
      } else {
        alert(
          "Your email is not verified. Please check your inbox and verify your email address."
        );
        await user.sendEmailVerification();
        alert("A new verification email has been sent to your email address.");
      }
    } catch (error) {
      console.error("Error logging in:", error);
      alert(error.message);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      alert("Please enter your email address first.");
      return;
    }
    try {
      await auth.sendPasswordResetEmail(email);
      alert(
        "Password reset email has been sent. Please check your inbox to reset your password."
      );
    } catch (error) {
      console.error("Error sending password reset email:", error);
      alert(error.message);
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ padding: 4, marginTop: 8 }}>
        <Typography variant="h4" gutterBottom>
          Log In
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
            onClick={handleLogin}
            fullWidth
            sx={{ marginTop: 2 }}
          >
            Log In
          </Button>
          <Button
            variant="text"
            color="secondary"
            onClick={handlePasswordReset}
            fullWidth
            sx={{ marginTop: 1 }}
          >
            Forgot Password?
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default Login;
