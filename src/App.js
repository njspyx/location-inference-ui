import React, { useState, useEffect, useRef } from "react";
import { auth } from "./firebase/firebase";
import SignUp from "./SignUp";
import Login from "./Login";
import Annotation from "./Annotation";

function App() {
  const [user, setUser] = useState(null);
  const [hasAccount, setHasAccount] = useState(true);

  // check if user is signed in, if not show login/signup
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return unsubscribe;
  }, []);

  const onUserSignedIn = () => {
    setUser(auth.currentUser);
  };

  if (user) {
    return <Annotation user={user} />;
  } else {
    return (
      <div>
        {hasAccount ? (
          <>
            <Login onUserSignedIn={onUserSignedIn} />
            <p>
              Don't have an account?
              <button onClick={() => setHasAccount(false)}>Sign Up</button>
            </p>
          </>
        ) : (
          <>
            <SignUp onUserSignedIn={onUserSignedIn} />
            <p>
              Already have an account?
              <button onClick={() => setHasAccount(true)}>Log In</button>
            </p>
          </>
        )}
      </div>
    );
  }
}

export default App;
