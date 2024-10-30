import React, { useState, useEffect, useRef, useCallback } from "react";
import MapComponent from "../components/MapComponent";
import StreetViewComponent from "../components/StreetViewComponent";
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
  const [imgsData, setImgsData] = useState([]);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [imageURL, setImageURL] = useState("");
  const [isStatic, setIsStatic] = useState(false);

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

  // Fetchs user data from firestore, include: current assigned image, toatal distance, guess count, average distance
  const fetchUserData = useCallback(async () => {
    try {
      const userRef = firestore.collection("users").doc(user.uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      if (userData) {
        // get users assigned images and current image index
        const assignedImages = userData.assignedImages || [];
        const currentIndex = userData.currentImageIndex || 0;
        setCurrentImageIdx(currentIndex);

        const userRegion = userData.region || "North America";
        setRegion(userRegion);

        // Fetch image urls in batches
        const imagesData = [];
        const batchSize = 10;
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

        // load current image url from firebase storage
        if (imagesData.length > 0 && currentIndex < imagesData.length) {
          const currentImageData = imagesData[currentIndex];
          const storageRef = getStorageRef(userRegion);

          const url = await storageRef
            .ref(currentImageData.filename)
            .getDownloadURL();
          setImageURL(url);

          // to combat reloading the page after submitting, check if user alr attempted img
          const guessDoc = await userRef
            .collection("guesses")
            .doc(currentImageData.id)
            .get();

          if (guessDoc.exists) {
            const guessData = guessDoc.data();
            if (guessData.isSubmitted) {
              setSubmittedCoords({
                lat: guessData.userLat,
                lng: guessData.userLng,
              });
              setDistance(guessData.distance);
              setActualCoords({
                lat: parseFloat(currentImageData.lat),
                lng: parseFloat(currentImageData.lng),
              });
              setIsSubmitted(true);
              setSelectedCategories(guessData.categories || []);
              setElapsedTime(guessData.timeTaken || 0);

              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
            }
          }
        } else {
          // All images completed
          setImgsData([]);
        }

        setTotalDistance(userData.totalDistance || 0);
        setGuessCount(userData.guessCount || 0);

        if (guessCount > 0) {
          setAverageDistance(totalDistance / guessCount);
        } else {
          setAverageDistance(0);
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching assigned images:", error);
    }
  }, [user.uid, totalDistance, guessCount]);

  // ################ USE EFFECTS ################
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // 0.5 chance that an image will be static or a photosphere
  useEffect(() => {
    const randomIsStatic = Math.random() < 0.5;
    setIsStatic(randomIsStatic);
  }, [currentImageIdx]);

  // loads image using url
  useEffect(() => {
    const loadImageURL = async () => {
      if (imgsData.length > 0 && currentImageIdx < imgsData.length) {
        const currentImageData = imgsData[currentImageIdx];
        const storageRef = getStorageRef(region);

        const url = await storageRef
          .ref(currentImageData.filename)
          .getDownloadURL();
        setImageURL(url);

        if (currentImageIdx + 1 < imgsData.length) {
          const nextImageData = imgsData[currentImageIdx + 1];
          storageRef.ref(nextImageData.filename).getDownloadURL();
        }
      } else {
        setImageURL("");
      }
    };

    loadImageURL();
  }, [currentImageIdx, imgsData, region]);

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
  }, [currentImageIdx, isSubmitted]);

  // ################ BUTTON HANDLERS ################
  const handleSignOut = () => {
    auth.signOut();
  };

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
    const currentImageData = imgsData[currentImageIdx];
    const actualLat = parseFloat(currentImageData.lat);
    const actualLng = parseFloat(currentImageData.lng);
    const userLat = submittedCoords.lat;
    const userLng = submittedCoords.lng;
    const distance = calculateDistance(actualLat, actualLng, userLat, userLng);
    setDistance(distance);
    setActualCoords({ lat: actualLat, lng: actualLng });

    setIsSubmitted(true);

    // Save users submission to firestore
    const userRef = firestore.collection("users").doc(user.uid);
    const currentImageId = imgsData[currentImageIdx].id;

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
          static: isStatic,
        },
        { merge: true }
      );

      await userRef.set(
        {
          lastSubmittedImageIndex: currentImageIdx,
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error saving submission data:", error);
    }
  };

  const handleNext = async () => {
    if (selectedCategories.length === 0) {
      alert("Please select at least one category at the bottom.");
      return;
    }

    // fetch information
    const currentImageData = imgsData[currentImageIdx];

    const userRef = firestore.collection("users").doc(user.uid);
    const currentImageId = currentImageData.id;

    try {
      // update users submission data with categories
      await userRef.collection("guesses").doc(currentImageId).set(
        {
          categories: selectedCategories,
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

      // Fetch updated user data to update average distance
      await fetchUserData();

      // Move to next image
      const nextIndex = currentImageIdx + 1;

      // Update user's currentImageIndex in Firestore
      await userRef.update({
        currentImageIndex: nextIndex,
      });

      setCurrentImageIdx(nextIndex);

      // Reset state
      setIsSubmitted(false);
      setSubmittedCoords(null);
      setDistance(null);
      setActualCoords(null);
      setIsSubmitted(false);
      setSelectedCategories([]);
      setElapsedTime(0);

      // Reset timer
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
          {`Guess the coordinates of this `}
          <strong>
            {isStatic ? "static image" : "interactive photosphere"}
          </strong>
          {`! (${currentImageIdx + 1} of ${imgsData.length})`}
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper elevation={3} style={{ padding: "10px" }}>
              {isStatic ? (
                imageURL && (
                  <img
                    src={imageURL}
                    alt="Guess"
                    style={{ width: "100%", height: "auto" }}
                  />
                )
              ) : (
                <div style={{ width: "100%", height: "500px" }}>
                  <StreetViewComponent
                    lat={parseFloat(currentImageData.lat)}
                    lng={parseFloat(currentImageData.lng)}
                  />
                </div>
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
