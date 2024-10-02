// src/Annotation (game).js

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import MapComponent from "./MapComponent";
import { auth, firestore, storage } from "./firebase/firebase";

function Annotation({ user }) {
  // image state
  const [imgsData, setImgsData] = useState([]);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [imageURL, setImageURL] = useState("");

  const [submittedCoords, setSubmittedCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [actualCoords, setActualCoords] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // timer
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  // Haversine formula to calculate distance between two coordinates
  // copied from benchmark notebook
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers

    // Convert degrees to radians
    const toRadians = (degrees) => (degrees * Math.PI) / 180;
    const phi1 = toRadians(lat1);
    const phi2 = toRadians(lat2);
    const deltaPhi = toRadians(lat2 - lat1);
    const deltaLambda = toRadians(lon2 - lon1);

    // Calculate the Haversine formula
    const a =
      Math.sin(deltaPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  };

  // Fetch user's assigned images on initial render
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRef = firestore.collection("users").doc(user.uid);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        if (userData) {
          // Get assigned image IDs and current index
          const assignedImages = userData.assignedImages || [];
          const currentIndex = userData.currentImageIndex || 0;
          setCurrentImageIdx(currentIndex);

          // Fetch image data for assigned images
          const imagesData = [];
          for (const imageId of assignedImages) {
            const imageDoc = await firestore
              .collection("images")
              .doc(imageId)
              .get();
            if (imageDoc.exists) {
              imagesData.push({ id: imageDoc.id, ...imageDoc.data() });
            }
          }
          setImgsData(imagesData);

          // Load the current image's URL
          if (imagesData.length > 0 && currentIndex < imagesData.length) {
            const currentImageData = imagesData[currentIndex];
            const url = await storage
              .ref(currentImageData.filename)
              .getDownloadURL();
            setImageURL(url);
          } else {
            // All images completed
            setImgsData([]);
          }
        }
      } catch (error) {
        console.error("Error fetching assigned images:", error);
      }
    };

    fetchData();
  }, [user]);

  // Update imageURL when currentImageIdx changes
  useEffect(() => {
    const loadImageURL = async () => {
      if (imgsData.length > 0 && currentImageIdx < imgsData.length) {
        const currentImageData = imgsData[currentImageIdx];
        const url = await storage
          .ref(currentImageData.filename)
          .getDownloadURL();
        setImageURL(url);
      } else {
        setImageURL("");
      }
    };

    loadImageURL();
  }, [currentImageIdx, imgsData]);

  // timer effect
  useEffect(() => {
    setElapsedTime(0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setElapsedTime((prevTime) => prevTime + 1);
    }, 1000);

    // reset when image changes
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentImageIdx]);

  const handleSignOut = () => {
    auth.signOut();
  };

  // "Submit" button handler
  const handleSubmit = () => {
    if (!submittedCoords) {
      alert("Please select a location on the map first!");
      return;
    }

    // stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // calculate distance, update state
    const currentImageData = imgsData[currentImageIdx];
    const actualLat = parseFloat(currentImageData.lat);
    const actualLng = parseFloat(currentImageData.lng);
    const userLat = submittedCoords.lat;
    const userLng = submittedCoords.lng;
    const distance = calculateDistance(actualLat, actualLng, userLat, userLng);
    setDistance(distance);
    setActualCoords({ lat: actualLat, lng: actualLng });

    setIsSubmitted(true);
  };

  // "Next" button handler
  const handleNext = async () => {
    // save user results to Firestore
    const currentImageData = imgsData[currentImageIdx];

    const userRef = firestore.collection("users").doc(user.uid);
    const guessData = {
      filename: currentImageData.filename,
      userLat: submittedCoords.lat,
      userLng: submittedCoords.lng,
      distance: distance,
      timeTaken: elapsedTime,
      categories: selectedCategories,
      timestamp: new Date(),
    };

    try {
      // Create user document it doesn't exist
      await userRef.set(
        {
          email: user.email,
        },
        { merge: true }
      );

      // Add the guessData to the user's guesses subcollection
      await userRef.collection("guesses").add(guessData);
    } catch (error) {
      console.error("Error saving data:", error);
    }

    // mvoe to next image
    const nextIndex = currentImageIdx + 1;

    // Update user's currentImageIndex in Firestore
    await firestore.collection("users").doc(user.uid).update({
      currentImageIndex: nextIndex,
    });

    setCurrentImageIdx(nextIndex);

    // reset state
    setSubmittedCoords(null);
    setDistance(null);
    setActualCoords(null);
    setIsSubmitted(false);
    setSelectedCategories([]);
    setElapsedTime(0);

    // reset timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setElapsedTime((prevTime) => prevTime + 1);
    }, 1000);
  };

  // Handler for category checkbox changes
  const handleCategoryChange = (event) => {
    const { value, checked } = event.target;
    if (checked) {
      setSelectedCategories((prev) => [...prev, value]);
    } else {
      setSelectedCategories((prev) => prev.filter((cat) => cat !== value));
    }
  };

  // Format elapsed time as MM:SS
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  // Check if all images are done
  if (imgsData.length === 0) {
    return <div>Loading...</div>;
  } else if (currentImageIdx >= imgsData.length) {
    return <div>No more images! You have completed the task.</div>;
  }

  const currentImageData = imgsData[currentImageIdx];

  // Categories for checkboxes
  const categories = [
    "Climate",
    "Architecture",
    "Street Signs",
    "Language",
    "Landmark",
    "Vegetation",
    "Vehicle",
    "Urban Layout",
    "Cultural Element",
  ];

  return (
    <div>
      <button onClick={handleSignOut}>Sign Out</button>
      <div>
        <h1>Guess the coordinates of Image {currentImageIdx + 1}</h1>
        {imageURL && (
          <img
            src={imageURL}
            alt="Guess"
            style={{ width: "640px", height: "auto" }}
          />
        )}
        <MapComponent
          key={currentImageIdx} // Force remount on image change
          onSelectCoords={setSubmittedCoords}
          submittedCoords={submittedCoords}
          actualCoords={actualCoords}
        />
        <p>Time: {formatTime(elapsedTime)}</p>
        {submittedCoords && (
          <p>
            Selected Coordinates: {submittedCoords.lat.toFixed(4)},{" "}
            {submittedCoords.lng.toFixed(4)}
          </p>
        )}
        {distance && actualCoords && (
          <div>
            <p>Your guess was {distance.toFixed(2)} km away.</p>
            <p>
              Actual Coordinates: {actualCoords.lat.toFixed(4)},{" "}
              {actualCoords.lng.toFixed(4)}
            </p>
          </div>
        )}
        <button onClick={handleSubmit} disabled={isSubmitted}>
          Submit
        </button>
        <button onClick={handleNext} disabled={!isSubmitted}>
          Next
        </button>

        {isSubmitted && (
          <div>
            <h3>What details from the image did you use to make your guess?</h3>
            {categories.map((category) => (
              <div key={category}>
                <label>
                  <input
                    type="checkbox"
                    value={category}
                    checked={selectedCategories.includes(category)}
                    onChange={handleCategoryChange}
                  />
                  {category}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Annotation;
