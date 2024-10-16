import React, { useState, useEffect, useRef } from "react";
import MapComponent from "../components/MapComponent";
import { auth, firestore, storage } from "../firebase/firebase";
import firebase from "firebase/compat/app";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Grid,
  Paper,
  Box,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";

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

  const [isLoading, setIsLoading] = useState(true);

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

  // In Annotation.js

  const fetchUserAssignedImages = async () => {
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
        const batchSize = 10; // Firestore 'in' queries accept up to 10 items
        for (let i = 0; i < assignedImages.length; i += batchSize) {
          const batchIds = assignedImages.slice(i, i + batchSize);
          const querySnapshot = await firestore
            .collection("images")
            .where(firebase.firestore.FieldPath.documentId(), "in", batchIds)
            .get();
          querySnapshot.forEach((doc) => {
            imagesData.push({ id: doc.id, ...doc.data() });
          });
        }

        // Sort imagesData to maintain order
        imagesData.sort(
          (a, b) => assignedImages.indexOf(a.id) - assignedImages.indexOf(b.id)
        );
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
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching assigned images:", error);
    }
  };

  // Fetch user's assigned images on initial render
  useEffect(() => {
    fetchUserAssignedImages();
  }, [user]);

  // Update imageURL when currentImageIdx changes
  // Inside your useEffect for loading the current image URL
  useEffect(() => {
    const loadImageURL = async () => {
      if (imgsData.length > 0 && currentImageIdx < imgsData.length) {
        const currentImageData = imgsData[currentImageIdx];
        const url = await storage
          .ref(currentImageData.filename)
          .getDownloadURL();
        setImageURL(url);

        // Optionally preload the next image
        if (currentImageIdx + 1 < imgsData.length) {
          const nextImageData = imgsData[currentImageIdx + 1];
          storage.ref(nextImageData.filename).getDownloadURL();
        }
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
    if (selectedCategories.length === 0) {
      alert("Please select at least one category at the bottom.");
      return;
    }

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

  // Inside the Annotation component

  const handleRequestMoreImages = async () => {
    try {
      // Use a transaction to get and update nextImageIndex
      await firestore.runTransaction(async (transaction) => {
        const settingsRef = firestore
          .collection("settings")
          .doc("imageAssignment");
        const settingsDoc = await transaction.get(settingsRef);

        if (!settingsDoc.exists) {
          throw new Error("Settings document does not exist.");
        }

        const data = settingsDoc.data();
        const totalNumberOfImages = data.totalNumberOfImages;
        let nextImageIndex = data.nextImageIndex || 0;

        // Compute new assigned images
        const newAssignedImages = [];
        for (let i = 0; i < 30; i++) {
          const imageIndex = (nextImageIndex + i) % totalNumberOfImages;
          const imageId = imageIndex.toString();
          newAssignedImages.push(imageId);
        }

        // Update nextImageIndex
        const newNextImageIndex = (nextImageIndex + 30) % totalNumberOfImages;
        transaction.update(settingsRef, { nextImageIndex: newNextImageIndex });

        // Update user's assignedImages
        const userRef = firestore.collection("users").doc(user.uid);
        transaction.update(userRef, {
          assignedImages: firebase.firestore.FieldValue.arrayUnion(
            ...newAssignedImages
          ),
        });
      });

      // After successfully adding new images, fetch updated data
      await fetchUserAssignedImages();

      alert("30 more images have been assigned to you.");
    } catch (error) {
      console.error("Error requesting more images:", error);
      alert(
        "An error occurred while requesting more images. Please try again."
      );
    }
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
  if (isLoading) {
    return <div>Loading your assigned images, please wait...</div>;
  }

  if (currentImageIdx >= imgsData.length) {
    return (
      <div>
        <h2>No more images! You have completed the task.</h2>
        <button onClick={handleRequestMoreImages}>
          Request 30 More Images
        </button>
      </div>
    );
  }

  // const currentImageData = imgsData[currentImageIdx];

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
    <div className="root">
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            Location Inference Game
          </Typography>
          <Button
            color="inherit"
            onClick={handleSignOut}
            startIcon={<LogoutIcon />}
          >
            Sign Out
          </Button>
        </Toolbar>
      </AppBar>

      <Box p={2}>
        <Typography variant="h5" gutterBottom>
          Guess the coordinates of Image {currentImageIdx + 1} of{" "}
          {imgsData.length}
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper elevation={3} style={{ padding: "10px" }}>
              {imageURL && (
                <img
                  src={imageURL}
                  alt="Guess"
                  style={{ width: "100%", height: "auto" }}
                />
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={6} container direction="column" spacing={2}>
            <Grid item style={{ height: "450px" }}>
              <Paper elevation={3} style={{ height: "100%", padding: "10px" }}>
                <MapComponent
                  onSelectCoords={setSubmittedCoords}
                  submittedCoords={submittedCoords}
                  actualCoords={actualCoords}
                />
              </Paper>
            </Grid>{" "}
            <Grid item mt={4}>
              <Typography variant="body1">
                Time: {formatTime(elapsedTime)}
              </Typography>
              {submittedCoords && (
                <Typography variant="body1">
                  Selected Coordinates: {submittedCoords.lat.toFixed(4)},{" "}
                  {submittedCoords.lng.toFixed(4)}
                </Typography>
              )}
              {distance && actualCoords && (
                <Box mt={2}>
                  <Typography variant="h6">
                    Your guess was {distance.toFixed(2)} km away.
                  </Typography>
                  <Typography variant="body1">
                    Actual Coordinates: {actualCoords.lat.toFixed(4)},{" "}
                    {actualCoords.lng.toFixed(4)}
                  </Typography>
                </Box>
              )}
              <Box mt={2}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSubmit}
                  disabled={isSubmitted}
                  className="submit-button"
                  style={{ marginRight: "10px" }}
                >
                  Submit
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleNext}
                  disabled={!isSubmitted}
                >
                  Next
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Grid>

        <Box mt={2}>
          {isSubmitted && (
            <Box mt={3}>
              <Typography variant="h6">
                What details from the image did you use to make your guess?
              </Typography>
              <FormGroup>
                <Grid container spacing={1}>
                  {categories.map((category) => (
                    <Grid item xs={12} sm={6} md={4} key={category}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            value={category}
                            checked={selectedCategories.includes(category)}
                            onChange={handleCategoryChange}
                            color="primary"
                          />
                        }
                        label={category}
                      />
                    </Grid>
                  ))}
                </Grid>
              </FormGroup>
            </Box>
          )}
        </Box>
      </Box>
    </div>
  );
}

export default Annotation;
