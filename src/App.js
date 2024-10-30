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

  const onUserSignedIn = () => {
    const currentUser = auth.currentUser;
    setUser(currentUser);
    setEmailVerified(currentUser.emailVerified);
  };

  if (user) {
    if (emailVerified) {
      return <Annotation user={user} />;
    } else {
      return (
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
      );
    }
  } else {
    return (
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ padding: 4, marginTop: 8 }}>
          {hasAccount ? (
            <>
              <Login onUserSignedIn={onUserSignedIn} />
              <Box mt={2} textAlign="center">
                <Typography variant="body1">
                  Don't have an account?{" "}
                  <Button color="primary" onClick={() => setHasAccount(false)}>
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
              <Box mt={4}>
                <Typography variant="h5">
                  Instructions (please read!)
                </Typography>
                <Typography variant="body2">
                  You will be shown a mix of static images and photospheres from
                  Google Street View. The photospheres will allow you to look
                  around the environment, while the images will not. Try to
                  guess the location by placing a marker on the map!{" "}
                </Typography>
                <Typography variant="body2">
                  By signing up, you are agreeing to answer all questions to the
                  best of your ability.
                </Typography>
                <Typography variant="body2">
                  Report any issues to{" "}
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
            </>
          )}
        </Paper>
      </Container>
    );
  }
}

export default App;
