import React, { useState } from "react";
import { auth } from "../firebase/firebase";

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
        // Optionally, resend verification email
        await user.sendEmailVerification();
        alert("A new verification email has been sent to your email address.");
      }
    } catch (error) {
      console.error("Error logging in:", error);
      alert(error.message);
    }
  };

  return (
    <div>
      <h2>Log In</h2>
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
      <button onClick={handleLogin}>Log In</button>
    </div>
  );
}

export default Login;
