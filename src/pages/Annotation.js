import React, { useState, useEffect, useRef, useCallback } from "react";
import MapComponent from "../components/MapComponent";
import {
  auth,
  firestore,
  americaStorage,
  asiaStorage,
  europeStorage,
} from "../firebase/firebase";
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
  // ################ STATE VARS ################
  // page state
  const [isLoading, setIsLoading] = useState(true);

  // image state
  const [currentImageData, setCurrentImageData] = useState(null);
  const [imageURL, setImageURL] = useState("");

  // user state for each image
  const [submittedCoords, setSubmittedCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [actualCoords, setActualCoords] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // user state general
  const [totalDistance, setTotalDistance] = useState(0);
  const [guessCount, setGuessCount] = useState(0);
  const [averageDistance, setAverageDistance] = useState(0);
  const [region, setRegion] = useState("");

  // timer
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  // ################ UTIL FUNCTIONS ################
  // Format elapsed time as MM:SS
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };
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

  // direct user to correct firebase storage bucket
  const getStorageRef = (region) => {
    if (region === "Asia" || region === "Oceania") {
      return asiaStorage;
    }
    if (region === "Europe" || region === "Africa") {
      return europeStorage;
    } else {
      return americaStorage;
    }
  };

  const getNextImage = useCallback(async () => {
    const settingsRef = firestore.collection("settings").doc("imageAssignment");

    let newCurrentImageId = null;

    await firestore.runTransaction(async (transaction) => {
      const settingsDoc = await transaction.get(settingsRef);

      const data = settingsDoc.data();
      const totalNumberOfImages = data.totalNumberOfImages;
      let nextImageIndex = data.nextImageIndex || 0;

      // Get the image ID corresponding to nextImageIndex
      const imageId = nextImageIndex.toString();

      // Update nextImageIndex
      const newNextImageIndex = (nextImageIndex + 1) % totalNumberOfImages;
      transaction.update(settingsRef, { nextImageIndex: newNextImageIndex });

      // Store the new current image ID to use outside the transaction
      newCurrentImageId = imageId;
    });

    return newCurrentImageId;
  }, []);

  // Fetchs user data from firestore, include: current assigned image, total distance, guess count, average distance
  const fetchUserData = useCallback(async () => {
    try {
      const userRef = firestore.collection("users").doc(user.uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      if (userData) {
        let currentImageId = userData.currentImageId || null;

        setTotalDistance(userData.totalDistance || 0);
        setGuessCount(userData.guessCount || 0);

        // Recalculate averageDistance
        if ((userData.guessCount || 0) > 0) {
          setAverageDistance(
            (userData.totalDistance || 0) / userData.guessCount
          );
        } else {
          setAverageDistance(0);
        }

        let guessData = null;

        if (currentImageId) {
          // Fetch the guess data for currentImageId
          const guessDoc = await userRef
            .collection("guesses")
            .doc(currentImageId)
            .get();
          guessData = guessDoc.exists ? guessDoc.data() : null;
        }

        if (guessData && guessData.isFinalized === false) {
          // User has an unfinalized submission, set state accordingly

          // Fetch the image data
          const imageDoc = await firestore
            .collection("images")
            .doc(currentImageId)
            .get();
          const imageData = imageDoc.data();
          setCurrentImageData({ id: currentImageId, ...imageData });

          // Load image URL
          const storageRef = getStorageRef(userData.region || "North America");
          const url = await storageRef.ref(imageData.filename).getDownloadURL();
          setImageURL(url);

          setIsSubmitted(true);
          setSubmittedCoords({
            lat: guessData.userLat,
            lng: guessData.userLng,
          });
          setDistance(guessData.distance);
          setActualCoords({
            lat: parseFloat(imageData.lat),
            lng: parseFloat(imageData.lng),
          });
          setElapsedTime(guessData.timeTaken || 0);
          setSelectedCategories(guessData.categories || []);

          // Do not start timer, since the submission is done
        } else {
          // User needs to start or continue guessing the current image

          // Fetch the image data
          const imageDoc = await firestore
            .collection("images")
            .doc(currentImageId)
            .get();
          const imageData = imageDoc.data();
          setCurrentImageData({ id: currentImageId, ...imageData });

          // Load image URL
          const storageRef = getStorageRef(userData.region || "North America");
          const url = await storageRef.ref(imageData.filename).getDownloadURL();
          setImageURL(url);

          // Reset state
          setIsSubmitted(false);
          setSubmittedCoords(null);
          setDistance(null);
          setActualCoords(null);
          setSelectedCategories([]);
          setElapsedTime(0);

          // Start timer
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          timerRef.current = setInterval(() => {
            setElapsedTime((prevTime) => prevTime + 1);
          }, 1000);
        }

        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  }, [user.uid]);

  // ################ EFFECTS ################

  // fetch user data
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // loads image using url
  useEffect(() => {
    const loadImageURL = async () => {
      if (currentImageData) {
        const storageRef = getStorageRef(region || "North America");
        const url = await storageRef
          .ref(currentImageData.filename)
          .getDownloadURL();
        setImageURL(url);
      } else {
        setImageURL("");
      }
    };
    loadImageURL();
  }, [currentImageData, region]);

  // timer effect
  useEffect(() => {
    if (isSubmitted) {
      return;
    }

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
  }, [currentImageData, isSubmitted]);

  // ################ BUTTON HANDLERS ################
  const handleSignOut = () => {
    auth.signOut();
  };

  // Modified handleSubmit function
  const handleSubmit = async () => {
    if (!submittedCoords) {
      alert("Please select a location on the map first!");
      return;
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Calculate distance
    const actualLat = parseFloat(currentImageData.lat);
    const actualLng = parseFloat(currentImageData.lng);
    const userLat = submittedCoords.lat;
    const userLng = submittedCoords.lng;
    const distance = calculateDistance(actualLat, actualLng, userLat, userLng);
    setDistance(distance);
    setActualCoords({ lat: actualLat, lng: actualLng });

    setIsSubmitted(true);

    // Save user's submission to Firestore with isFinalized: false
    const userRef = firestore.collection("users").doc(user.uid);
    const currentImageId = currentImageData.id;

    try {
      await userRef.collection("guesses").doc(currentImageId).set(
        {
          filename: currentImageData.filename,
          userLat: submittedCoords.lat,
          userLng: submittedCoords.lng,
          distance: distance,
          timeTaken: elapsedTime,
          timestamp: new Date(),
          isSubmitted: true,
          isFinalized: false, // Mark as unfinalized
        },
        { merge: true }
      );

      // Removed currentImageSubmitted update

      setIsSubmitted(true);
    } catch (error) {
      console.error("Error saving submission data:", error);
    }
  };

  const handleNext = async () => {
    if (selectedCategories.length === 0) {
      alert("Please select at least one category at the bottom.");
      return;
    }

    const userRef = firestore.collection("users").doc(user.uid);
    const currentImageId = currentImageData.id;

    try {
      // Update user's submission data with categories and set isFinalized to true
      await userRef.collection("guesses").doc(currentImageId).set(
        {
          categories: selectedCategories,
          isFinalized: true, // Mark as finalized
        },
        { merge: true }
      );

      // Update totalDistance and guessCount in user's document
      await userRef.set(
        {
          totalDistance: firebase.firestore.FieldValue.increment(distance),
          guessCount: firebase.firestore.FieldValue.increment(1),
        },
        { merge: true }
      );

      // Compute new totalDistance and guessCount
      const newTotalDistance = totalDistance + distance;
      const newGuessCount = guessCount + 1;
      const newAverageDistance = newTotalDistance / newGuessCount;

      // Update local state variables
      setTotalDistance(newTotalDistance);
      setGuessCount(newGuessCount);
      setAverageDistance(newAverageDistance);

      // Assign next image
      const newCurrentImageId = await getNextImage();

      // Update user's currentImageId
      await userRef.update({
        currentImageId: newCurrentImageId,
      });

      // Fetch the new image data
      const imageDoc = await firestore
        .collection("images")
        .doc(newCurrentImageId)
        .get();
      const imageData = imageDoc.data();
      setCurrentImageData({ id: newCurrentImageId, ...imageData });

      // Load the image URL
      const storageRef = getStorageRef(region || "North America");
      const url = await storageRef.ref(imageData.filename).getDownloadURL();
      setImageURL(url);

      // Reset state
      setIsSubmitted(false);
      setSubmittedCoords(null);
      setDistance(null);
      setActualCoords(null);
      setSelectedCategories([]);
      setElapsedTime(0);

      // Restart timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(() => {
        setElapsedTime((prevTime) => prevTime + 1);
      }, 1000);
    } catch (error) {
      console.error("Error saving data:", error);
    }
  };

  const handleRequestMoreImages = async () => {
    try {
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
      await fetchUserData();

      alert("30 more images have been assigned to you.");
    } catch (error) {
      console.error("Error requesting more images:", error);
      alert(
        "An error occurred while requesting more images. Please try again."
      );
    }
  };

  // handler for category checkboxes
  const handleCategoryChange = (event) => {
    const { value, checked } = event.target;
    if (checked) {
      setSelectedCategories((prev) => [...prev, value]);
    } else {
      setSelectedCategories((prev) => prev.filter((cat) => cat !== value));
    }
  };

  // ################ RENDER ################
  // Check if all images are done
  if (isLoading) {
    return <div>Loading your assigned images, please wait...</div>;
  }

  if (!currentImageData) {
    return (
      <div>
        <h2>No more images! You have completed the task.</h2>
        <button onClick={handleRequestMoreImages}>
          Request 30 More Images
        </button>
      </div>
    );
  }

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
          <Button
            color="inherit"
            onClick={handleSignOut}
            startIcon={<LogoutIcon />}
          >
            Sign Out
          </Button>

          <Typography variant="h6" style={{ flexGrow: 1, textAlign: "center" }}>
            Avg Score: {averageDistance.toFixed(2)} km
          </Typography>
        </Toolbar>
      </AppBar>

      <Box p={2}>
        <Typography variant="h5" gutterBottom>
          Guess the coordinates of Image {guessCount + 1}
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
                  isSubmitted={isSubmitted}
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
