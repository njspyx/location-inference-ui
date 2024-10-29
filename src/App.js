import React, { useState, useEffect } from "react";
import { auth } from "./firebase/firebase";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import Annotation from "./pages/Annotation";

function App() {
  const [user, setUser] = useState(null);
  const [hasAccount, setHasAccount] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);

  // check if user is signed in, if not show login/signup
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
        <div>
          <h2>Email Verification Required</h2>
          <p>
            Please verify your email address by clicking on the verification
            link sent to your email.
          </p>
          <button onClick={() => auth.currentUser.sendEmailVerification()}>
            Resend Verification Email
          </button>
          <button onClick={() => auth.signOut()}>Log Out</button>
        </div>
      );
    }
  } else {
    return (
      <div>
        {hasAccount ? (
          <>
            <Login onUserSignedIn={onUserSignedIn} />
            <p>
              {"Don't have an account? "}
              <button onClick={() => setHasAccount(false)}>Sign Up</button>
            </p>
          </>
        ) : (
          <>
            <SignUp onUserSignedIn={onUserSignedIn} />
            <p>
              {"Already have an account? "}
              <button onClick={() => setHasAccount(true)}>Log In</button>
            </p>
          </>
        )}
      </div>
    );
  }
}

export default App;
