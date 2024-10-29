import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";

import firebaseConfig from "./firebaseConfig";

// init firebase
firebase.initializeApp(firebaseConfig);

const storage = firebase.storage(); //default storage (nam5; US)
const asiaStorage = firebase
  .app()
  .storage("gs://apart-location-inference-f196f-asia-southeast");

const auth = firebase.auth();
const firestore = firebase.firestore();

export { auth, firestore, storage, asiaStorage };
