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
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Tooltip,
  IconButton,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import InfoIcon from "@mui/icons-material/Info";

function Annotation({ user }) {
  // ################ STATE VARIABLES ################
  // Page state
  const [isLoading, setIsLoading] = useState(true);

  // Image state
  const [currentImageData, setCurrentImageData] = useState(null);
  const [imageURL, setImageURL] = useState("");

  // User state for each image
  const [submittedCoords, setSubmittedCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [actualCoords, setActualCoords] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // User state general
  const [totalDistance, setTotalDistance] = useState(0);
  const [guessCount, setGuessCount] = useState(0);
  const [averageDistance, setAverageDistance] = useState(0);

  // Annotation type and availability
  const [annotationType, setAnnotationType] = useState("Static Image");
  const [isStatic, setIsStatic] = useState(true);
  const [staticImagesAvailable, setStaticImagesAvailable] = useState(true);
  const [photospheresAvailable, setPhotospheresAvailable] = useState(true);

  // Timer
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

  // Direct user to correct Firebase storage bucket
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

  // Function to update availability
  const updateAvailability = useCallback(async () => {
    try {
      const imageAssignmentRef = firestore
        .collection("settings")
        .doc("imageAssignment");
      const photosphereAssignmentRef = firestore
        .collection("settings")
        .doc("photosphereAssignment");

      const [imageAssignmentDoc, photosphereAssignmentDoc] = await Promise.all([
        imageAssignmentRef.get(),
        photosphereAssignmentRef.get(),
      ]);

      const imageAssignmentData = imageAssignmentDoc.data();
      const photosphereAssignmentData = photosphereAssignmentDoc.data();

      const staticAvailable =
        imageAssignmentData.nextImageIndex <
        imageAssignmentData.totalNumberOfImages;
      const photospheresAvailable =
        photosphereAssignmentData.nextImageIndex <
        photosphereAssignmentData.totalNumberOfImages;

      setStaticImagesAvailable(staticAvailable);
      setPhotospheresAvailable(photospheresAvailable);

      if (!staticAvailable && photospheresAvailable) {
        setAnnotationType("Photosphere");
      } else if (!photospheresAvailable && staticAvailable) {
        setAnnotationType("Static Image");
      } else if (!staticAvailable && !photospheresAvailable) {
        alert("Annotation complete! No locations left.");
        setCurrentImageData(null);
      }
    } catch (error) {
      console.error("Error checking availability:", error);
    }
  }, []);

  const getNextImage = useCallback(async (isStatic) => {
    const settingsCollection = isStatic
      ? "imageAssignment"
      : "photosphereAssignment";
    const settingsRef = firestore
      .collection("settings")
      .doc(settingsCollection);

    let newCurrentImageId = null;

    await firestore.runTransaction(async (transaction) => {
      const settingsDoc = await transaction.get(settingsRef);

      const data = settingsDoc.data();
      const totalNumberOfImages = data.totalNumberOfImages;
      let nextImageIndex = data.nextImageIndex || 0;

      if (nextImageIndex >= totalNumberOfImages) {
        // No more images left
        newCurrentImageId = null;
        return;
      }

      // Get the image ID corresponding to nextImageIndex
      const imageId = isStatic
        ? nextImageIndex.toString()
        : `p_${nextImageIndex}`;

      // Update nextImageIndex
      const newNextImageIndex = nextImageIndex + 1;
      transaction.update(settingsRef, { nextImageIndex: newNextImageIndex });

      // Store the new current image ID to use outside the transaction
      newCurrentImageId = imageId;
    });

    return newCurrentImageId;
  }, []);

  // Fetch user data from Firestore
  const fetchUserData = useCallback(async () => {
    try {
      const userRef = firestore.collection("users").doc(user.uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      if (userData) {
        let currentImageId = userData.currentImageId || null;
        const isStatic =
          userData.isStatic !== undefined ? userData.isStatic : true;
        setIsStatic(isStatic);

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
          const collectionName = isStatic ? "images" : "photospheres";
          const imageDoc = await firestore
            .collection(collectionName)
            .doc(currentImageId)
            .get();
          const imageData = imageDoc.data();
          setCurrentImageData({ id: currentImageId, ...imageData });

          // Load image URL or set for photosphere
          if (isStatic) {
            const storageRef = getStorageRef(
              userData.region || "North America"
            );
            const url = await storageRef
              .ref(imageData.filename)
              .getDownloadURL();
            setImageURL(url);
          } else {
            setImageURL(null);
          }

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
          const collectionName = isStatic ? "images" : "photospheres";
          const imageDoc = await firestore
            .collection(collectionName)
            .doc(currentImageId)
            .get();
          const imageData = imageDoc.data();
          setCurrentImageData({ id: currentImageId, ...imageData });

          // Load image URL or set for photosphere
          if (isStatic) {
            const storageRef = getStorageRef(
              userData.region || "North America"
            );
            const url = await storageRef
              .ref(imageData.filename)
              .getDownloadURL();
            setImageURL(url);
          } else {
            setImageURL(null);
          }

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

  // Fetch user data
  useEffect(() => {
    updateAvailability();
    fetchUserData();
  }, [fetchUserData, updateAvailability]);

  // Load image using URL
  useEffect(() => {
    const loadImageURL = async () => {
      if (currentImageData && isStatic) {
        const storageRef = getStorageRef(
          currentImageData.region || "North America"
        );
        const url = await storageRef
          .ref(currentImageData.filename)
          .getDownloadURL();
        setImageURL(url);
      } else {
        setImageURL(null);
      }
    };
    loadImageURL();
  }, [currentImageData, isStatic]);

  // Timer effect
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

    // Reset when image changes
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

  // Modified handleAnnotationTypeChange function
  const handleAnnotationTypeChange = async (event) => {
    const selectedType = event.target.value;

    // If the annotation type hasn't changed, do nothing
    if (selectedType === annotationType) {
      return;
    }

    // Unassign current image if necessary
    if (currentImageData && !isSubmitted) {
      // Decrement the nextImageIndex in the settings for the previous annotation type
      const settingsCollection = isStatic
        ? "imageAssignment"
        : "photosphereAssignment";
      const settingsRef = firestore
        .collection("settings")
        .doc(settingsCollection);

      await firestore.runTransaction(async (transaction) => {
        const settingsDoc = await transaction.get(settingsRef);
        const data = settingsDoc.data();
        let nextImageIndex = data.nextImageIndex || 0;

        // Decrement nextImageIndex by 1, but ensure it doesn't go below 0
        const newNextImageIndex = Math.max(nextImageIndex - 1, 0);
        transaction.update(settingsRef, { nextImageIndex: newNextImageIndex });
      });
    }

    // Update the annotation type
    setAnnotationType(selectedType);
    const isStaticNext = selectedType === "Static Image";
    setIsStatic(isStaticNext);

    // Assign new image
    const newCurrentImageId = await getNextImage(isStaticNext);

    if (!newCurrentImageId) {
      // No more images of this type
      if (isStaticNext) {
        setStaticImagesAvailable(false);
      } else {
        setPhotospheresAvailable(false);
      }

      // Update availability
      await updateAvailability();

      if (!staticImagesAvailable && !photospheresAvailable) {
        alert("Annotation complete! No locations left.");
        setCurrentImageData(null);
        return;
      } else {
        const otherType = isStaticNext ? "Photosphere" : "Static Image";
        setAnnotationType(otherType);
        alert(
          `No more ${selectedType.toLowerCase()}s available. Switching to ${otherType.toLowerCase()}s.`
        );
        return;
      }
    }

    // Update user's currentImageId and isStatic
    const userRef = firestore.collection("users").doc(user.uid);
    await userRef.update({
      currentImageId: newCurrentImageId,
      isStatic: isStaticNext,
    });

    // Fetch the new image data
    const collectionName = isStaticNext ? "images" : "photospheres";
    const imageDoc = await firestore
      .collection(collectionName)
      .doc(newCurrentImageId)
      .get();
    const imageData = imageDoc.data();
    setCurrentImageData({ id: newCurrentImageId, ...imageData });

    // Load the image URL or set the component for photosphere
    if (isStaticNext) {
      const storageRef = getStorageRef(imageData.region || "North America");
      const url = await storageRef.ref(imageData.filename).getDownloadURL();
      setImageURL(url);
    } else {
      setImageURL(null);
    }

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
          isStatic: isStatic,
        },
        { merge: true }
      );

      setIsSubmitted(true);
    } catch (error) {
      console.error("Error saving submission data:", error);
    }
  };

  // Modified handleNext function
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

      // Determine if the next item is static or not based on annotationType
      const isStaticNext = annotationType === "Static Image";

      // Assign next image
      const newCurrentImageId = await getNextImage(isStaticNext);

      if (!newCurrentImageId) {
        // No more images left
        if (isStaticNext) {
          setStaticImagesAvailable(false);
        } else {
          setPhotospheresAvailable(false);
        }

        // Update availability
        await updateAvailability();

        if (!staticImagesAvailable && !photospheresAvailable) {
          alert("Annotation complete! No locations left.");
          setCurrentImageData(null);
          return;
        } else {
          const otherType = isStaticNext ? "Photosphere" : "Static Image";
          setAnnotationType(otherType);
          alert(
            `No more ${annotationType.toLowerCase()}s available. Switching to ${otherType.toLowerCase()}s.`
          );
          return;
        }
      }

      // Update user's currentImageId and isStatic
      await userRef.update({
        currentImageId: newCurrentImageId,
        isStatic: isStaticNext,
      });

      // Fetch the new image data
      const collectionName = isStaticNext ? "images" : "photospheres";
      const imageDoc = await firestore
        .collection(collectionName)
        .doc(newCurrentImageId)
        .get();
      const imageData = imageDoc.data();
      setCurrentImageData({ id: newCurrentImageId, ...imageData });

      // Load the image URL or set the component for photosphere
      if (isStaticNext) {
        const storageRef = getStorageRef(imageData.region || "North America");
        const url = await storageRef.ref(imageData.filename).getDownloadURL();
        setImageURL(url);
      } else {
        setImageURL(null);
      }

      // Update isStatic state
      setIsStatic(isStaticNext);

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

  // Handler for category checkboxes
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
      </div>
    );
  }

  // Categories with descriptions
  const categories = [
    {
      name: "Road and infrastructure",
      description:
        "Details related to roads, infrastructure on roads, pavements, or sidewalks.",
    },
    {
      name: "Urban layout and elements",
      description:
        "Features related to street layout, building density, urban planning, etc.",
    },
    {
      name: "Signage",
      description: "Traffic signs, shop signs, billboards, etc.",
    },
    {
      name: "Architecture",
      description:
        "Buildings, structures, materials, architectural styles, etc.",
    },
    {
      name: "Traffic and vehicles",
      description:
        "Types of vehicles, license plates, car models, traffic patterns, utility vehicles, etc.",
    },
    {
      name: "Vegetation",
      description: "Plants, trees, etc.",
    },
    {
      name: "Environment and climate",
      description: "Sky, weather, landscape features, terrain, etc.",
    },
    {
      name: "Lighting and shadows",
      description: "Used to guess hemisphere, time of day, season, etc.",
    },
    {
      name: "Recognizable landmarks",
      description: "Specific, identifiable places or structures.",
    },
    {
      name: "Language",
      description: "Text on signs, buildings, or overheard speech.",
    },
    {
      name: "Other cultural elements",
      description:
        "Clothing, festivals, customs, etc. (not including language).",
    },
    {
      name: "Other",
      description: "Any other details that don't fit the above categories.",
    },
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
        <Box display="flex" alignItems="center" mb={2}>
          <Typography variant="h5">
            #{guessCount + 1}: Guess the coordinates of the image.
          </Typography>
          <FormControl
            variant="outlined"
            style={{ marginLeft: "auto", minWidth: 150 }}
          >
            <InputLabel id="annotation-type-label">Annotation Type</InputLabel>
            <Select
              labelId="annotation-type-label"
              id="annotation-type-select"
              value={annotationType}
              onChange={handleAnnotationTypeChange}
              label="Annotation Type"
            >
              <MenuItem value="Static Image">Static Image</MenuItem>
              <MenuItem value="Photosphere" disabled>
                Photosphere
              </MenuItem>
            </Select>
          </FormControl>
        </Box>

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
                <Tooltip
                  title={
                    <React.Fragment>
                      {categories.map((category) => (
                        <div key={category.name}>
                          <strong>{category.name}:</strong>{" "}
                          {category.description}
                        </div>
                      ))}
                    </React.Fragment>
                  }
                  placement="right"
                  arrow
                >
                  <IconButton size="small">
                    <InfoIcon />
                  </IconButton>
                </Tooltip>
              </Typography>
              <FormGroup>
                <Grid container spacing={1}>
                  {categories.map((category) => (
                    <Grid item xs={12} sm={6} md={4} key={category.name}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            value={category.name}
                            checked={selectedCategories.includes(category.name)}
                            onChange={handleCategoryChange}
                            color="primary"
                          />
                        }
                        label={category.name}
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
