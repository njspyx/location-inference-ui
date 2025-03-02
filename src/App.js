import React, { useState, useEffect } from "react";
import { auth } from "./firebase/firebase";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import Annotation from "./pages/Annotation";
import { Container, Paper, Typography, Box, Button, Link } from "@mui/material";

function App() {
  const [user, setUser] = useState(null);
  const [hasAccount, setHasAccount] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);

  // Check if user is signed in, if not show login/signup
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
        setEmailVerified(user.emailVerified);
      } else {
        setUser(null);
        setEmailVerified(false);
      }
    });
    return unsubscribe;
  }, []);

  const onUserSignedIn = (userArg) => {
    if (userArg?.isGuest) {
      // Skip email verification, route as guest
      setUser({ isGuest: true });
    } else {
      const currentUser = auth.currentUser;
      setUser(currentUser);
      setEmailVerified(currentUser.emailVerified);
    }
  };

  return (
    <div style={{ marginBottom: "2rem" }}>
      {user ? (
        user.isGuest || emailVerified ? (
          <Annotation user={user} />
        ) : (
          <Container maxWidth="sm">
            <Paper
              elevation={3}
              sx={{ padding: 4, marginTop: 8, textAlign: "center" }}
            >
              <Typography variant="h4" gutterBottom>
                Email Verification Required
              </Typography>
              <Typography variant="body1" gutterBottom>
                Please verify your email address by clicking on the verification
                link sent to your email.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => auth.currentUser.sendEmailVerification()}
              >
                Resend Verification Email
              </Button>
              <Box mt={2}>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => auth.signOut()}
                >
                  Log Out
                </Button>
              </Box>
            </Paper>
          </Container>
        )
      ) : (
        <Container maxWidth="sm">
          <Paper elevation={3} sx={{ padding: 4, marginTop: 8 }}>
            {hasAccount ? (
              <>
                <Box mt={4}>
                  <Typography variant="h5">Geolocation Inference!</Typography>
                  <Typography variant="body2">
                    Based on GeoGuessr. See our paper,{" "}
                    <Link
                      href="https://arxiv.org/abs/2502.14412"
                      target="_blank"
                      rel="noopener"
                    >
                      Evaluating Precise Geolocation Inference Capabilities of
                      Vision Language Models
                    </Link>
                    .
                  </Typography>
                  <Box mb={1} />
                  <Typography variant="body2">
                    You can choose to view static images or photospheres from
                    Google Street View. Try to guess the location by placing a
                    marker on the map. See if you can beat GPT-4o!
                  </Typography>
                  <Box mb={1} />
                  <Typography variant="body2">
                    Play as guest, or sign in to save progress and choose region
                    (for faster image loading outside NA). Report any issues to{" "}
                    <Link
                      href="https://github.com/njspyx/location-inference-ui"
                      target="_blank"
                      rel="noopener"
                    >
                      Github
                    </Link>
                    .
                  </Typography>
                </Box>
                <Login onUserSignedIn={onUserSignedIn} />
                <Box mt={2} textAlign="center">
                  <Typography variant="body1">
                    Don't have an account?{" "}
                    <Button
                      color="primary"
                      onClick={() => setHasAccount(false)}
                    >
                      Sign Up
                    </Button>
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                <SignUp onUserSignedIn={onUserSignedIn} />
                <Box mt={2} textAlign="center">
                  <Typography variant="body1">
                    Already have an account?{" "}
                    <Button color="primary" onClick={() => setHasAccount(true)}>
                      Log In
                    </Button>
                  </Typography>
                </Box>
              </>
            )}
          </Paper>
        </Container>
      )}
    </div>
  );
}

export default App;
