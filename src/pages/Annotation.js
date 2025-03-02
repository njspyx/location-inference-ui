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
  Chip,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import InfoIcon from "@mui/icons-material/Info";
import ComputerIcon from "@mui/icons-material/Computer";
import PersonIcon from "@mui/icons-material/Person";

function Annotation({ user }) {
  // ################ STATE VARIABLES ################
  // Page state
  const [isLoading, setIsLoading] = useState(true);
  const [annotationType, setAnnotationType] = useState("Static Image");
  const [isStatic, setIsStatic] = useState(true);

  // Temporary flag to keep loading for an extra second
  const [isHoldingLoading, setIsHoldingLoading] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setIsHoldingLoading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Settings and availability
  const [totalImages, setTotalImages] = useState(0);
  const [totalPhotospheres, setTotalPhotospheres] = useState(0);
  const [staticImagesAvailable, setStaticImagesAvailable] = useState(true);
  const [photospheresAvailable, setPhotospheresAvailable] = useState(true);

  // Image state
  const [currentImageData, setCurrentImageData] = useState(null);
  const [imageURL, setImageURL] = useState("");

  // User state for each image
  const [submittedCoords, setSubmittedCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [actualCoords, setActualCoords] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // GPT state
  const [gptCoords, setGptCoords] = useState(null);
  const [gptDistance, setGptDistance] = useState(null);
  const [gptCategories, setGptCategories] = useState([]);
  const [showGptGuess, setShowGptGuess] = useState(false);

  // User state general
  const [totalDistance, setTotalDistance] = useState(0);
  const [guessCount, setGuessCount] = useState(0);
  const [averageDistance, setAverageDistance] = useState(0);
  const [userWinCount, setUserWinCount] = useState(0);
  const [gptWinCount, setGptWinCount] = useState(0);

  // Timer
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  // Local-only stats for guests
  const [guestGuessCount, setGuestGuessCount] = useState(0);
  const [guestTotalDistance, setGuestTotalDistance] = useState(0);
  const [guestUserWinCount, setGuestUserWinCount] = useState(0);
  const [guestGptWinCount, setGuestGptWinCount] = useState(0);

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

  // Function to get total counts
  const getTotalCounts = useCallback(async () => {
    try {
      const imageAssignmentDoc = await firestore
        .collection("settings")
        .doc("imageAssignment")
        .get();

      const photosphereAssignmentDoc = await firestore
        .collection("settings")
        .doc("photosphereAssignment")
        .get();

      if (imageAssignmentDoc.exists) {
        setTotalImages(imageAssignmentDoc.data().totalNumberOfImages || 0);
      }

      if (photosphereAssignmentDoc.exists) {
        setTotalPhotospheres(
          photosphereAssignmentDoc.data().totalNumberOfImages || 0
        );
      }
    } catch (error) {
      console.error("Error getting total counts:", error);
    }
  }, []);

  // Function to check image/photosphere availability
  const checkAvailability = useCallback(
    async (userData) => {
      // We assume userData already fetched from Firestore
      // By default, set indexes to 0 if they're missing
      const currentIndex = userData.currentImageIndex ?? 0;
      const currentSphereIndex = userData.currentPhotosphereIndex ?? 0;

      // If currentIndex >= totalImages => no more static images
      setStaticImagesAvailable(currentIndex < totalImages);

      // If currentSphereIndex >= totalPhotospheres => no more photospheres
      setPhotospheresAvailable(currentSphereIndex < totalPhotospheres);
    },
    [totalImages, totalPhotospheres]
  );

  // Function to get the current item (no increment here!)
  const getNextItem = useCallback(
    async (userData, isStaticFlag) => {
      try {
        let currentIndex, itemId, collectionName;

        if (isStaticFlag) {
          // Use currentImageIndex directly
          currentIndex = userData.currentImageIndex ?? 0;
          if (currentIndex >= totalImages) {
            setStaticImagesAvailable(false);
            return null;
          }
          itemId = currentIndex.toString();
          collectionName = "images";
        } else {
          // Use currentPhotosphereIndex
          currentIndex = userData.currentPhotosphereIndex ?? 0;
          if (currentIndex >= totalPhotospheres) {
            setPhotospheresAvailable(false);
            return null;
          }
          itemId = `p_${currentIndex}`;
          collectionName = "photospheres";
        }

        // Fetch the item data
        const itemDoc = await firestore
          .collection(collectionName)
          .doc(itemId)
          .get();

        if (!itemDoc.exists) {
          console.error(
            `No document found with ID ${itemId} in ${collectionName}`
          );
          return null;
        }

        return { id: itemId, ...itemDoc.data() };
      } catch (error) {
        console.error("Error getting next item:", error);
        return null;
      }
    },
    [totalImages, totalPhotospheres]
  );

  const getRandomItem = useCallback(async (isStaticFlag) => {
    try {
      const collectionName = isStaticFlag ? "images" : "photospheres";
      const snapshot = await firestore.collection(collectionName).get();
      if (snapshot.empty) return null;
      const docs = snapshot.docs;
      const randomDoc = docs[Math.floor(Math.random() * docs.length)];
      return { id: randomDoc.id, ...randomDoc.data() };
    } catch (error) {
      console.error("Error fetching random item:", error);
      return null;
    }
  }, []);

  // ################ EFFECTS ################

  // Fetch total counts on component mount
  useEffect(() => {
    getTotalCounts();
  }, [getTotalCounts]);

  // Fetch user data and initial item
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userRef = firestore.collection("users").doc(user.uid);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        if (userData) {
          // Set user stats
          setTotalDistance(userData.totalDistance || 0);
          setGuessCount(userData.guessCount || 0);
          setUserWinCount(userData.userWinCount || 0);
          setGptWinCount(userData.gptWinCount || 0);

          // Calculate average distance
          if ((userData.guessCount || 0) > 0) {
            setAverageDistance(
              (userData.totalDistance || 0) / userData.guessCount
            );
          }

          // Check availability
          await checkAvailability(userData);

          // Get current item
          const nextItem = await getNextItem(userData, isStatic);

          if (nextItem) {
            setCurrentImageData(nextItem);

            // Load image URL for static images
            if (isStatic) {
              const storageRef = getStorageRef(
                userData.region || "North America"
              );
              const url = await storageRef
                .ref(nextItem.filename)
                .getDownloadURL();
              setImageURL(url);
            }

            // Reset state for new image
            setIsSubmitted(false);
            setSubmittedCoords(null);
            setDistance(null);
            setActualCoords(null);
            setSelectedCategories([]);
            setGptCoords(null);
            setGptDistance(null);
            setGptCategories([]);
            setShowGptGuess(false);
            setElapsedTime(0);

            // Start timer
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            timerRef.current = setInterval(() => {
              setElapsedTime((prevTime) => prevTime + 1);
            }, 1000);
          } else {
            // No more items available
            setCurrentImageData(null);
          }

          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    // If user is guest, just pick a random item without saving progress
    async function fetchGuestItem() {
      const item = await getRandomItem(isStatic);
      if (item) {
        setCurrentImageData(item);
        if (isStatic) {
          const region = "North America"; // or any default
          const storageRef = getStorageRef(region);
          const url = await storageRef.ref(item.filename).getDownloadURL();
          setImageURL(url);
        }
      }
      setIsLoading(false);
    }

    if (user?.isGuest) {
      fetchGuestItem();
    } else {
      fetchUserData();
    }

    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [user.uid, isStatic, checkAvailability, getNextItem, getRandomItem]);

  // ################ BUTTON HANDLERS ################

  const handleSignOut = () => {
    auth.signOut();
  };

  // Handle annotation type change
  const handleAnnotationTypeChange = async (event) => {
    const selectedType = event.target.value;

    // If the annotation type hasn't changed, do nothing
    if (selectedType === annotationType) {
      return;
    }

    // Reset timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Update the annotation type
    setAnnotationType(selectedType);
    const isStaticNext = selectedType === "Static Image";
    setIsStatic(isStaticNext);

    // Reset state
    setIsSubmitted(false);
    setSubmittedCoords(null);
    setDistance(null);
    setActualCoords(null);
    setSelectedCategories([]);
    setGptCoords(null);
    setGptDistance(null);
    setGptCategories([]);
    setShowGptGuess(false);
    setElapsedTime(0);
    setCurrentImageData(null);

    // Refetch user data and get the next item (for the new type)
    try {
      const userRef = firestore.collection("users").doc(user.uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      if (!userData) return;

      // Check availability again after switching
      await checkAvailability(userData);

      // If no items available for this new type, alert and return
      if (
        (isStaticNext && !staticImagesAvailable) ||
        (!isStaticNext && !photospheresAvailable)
      ) {
        alert(`No more ${selectedType.toLowerCase()}s available.`);
        return;
      }

      // Get the next item
      const nextItem = await getNextItem(userData, isStaticNext);

      if (nextItem) {
        setCurrentImageData(nextItem);

        // Load image URL for static images
        if (isStaticNext) {
          const storageRef = getStorageRef(userData.region || "North America");
          const url = await storageRef.ref(nextItem.filename).getDownloadURL();
          setImageURL(url);
        } else {
          setImageURL(null);
        }

        // Start timer
        timerRef.current = setInterval(() => {
          setElapsedTime((prevTime) => prevTime + 1);
        }, 1000);
      }
    } catch (error) {
      console.error("Error loading new annotation type item:", error);
    }
  };

  // Handle submit
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
    const distanceVal = calculateDistance(
      actualLat,
      actualLng,
      userLat,
      userLng
    );

    setDistance(distanceVal);
    setActualCoords({ lat: actualLat, lng: actualLng });

    // Get GPT guess if available
    if (currentImageData.gptGuess) {
      const gpt = currentImageData.gptGuess;
      if (gpt.predicted_lat && gpt.predicted_lng) {
        setGptCoords({
          lat: parseFloat(gpt.predicted_lat),
          lng: parseFloat(gpt.predicted_lng),
        });

        setGptDistance(
          parseFloat(gpt.distance) ||
            calculateDistance(
              actualLat,
              actualLng,
              gpt.predicted_lat,
              gpt.predicted_lng
            )
        );

        if (gpt.categories) {
          setGptCategories(gpt.categories);
        }
      }
    }

    setShowGptGuess(true);
    setIsSubmitted(true); // local UI state: now "locked in" for this browser session

    // ---- SAVE USER'S SUBMISSION TO FIRESTORE ----
    if (!user?.isGuest) {
      try {
        const userRef = firestore.collection("users").doc(user.uid);
        const guessRef = userRef.collection("guesses").doc(currentImageData.id);

        // Create (or overwrite) the guess document
        await guessRef.set({
          filename: currentImageData.filename,
          userLat: userLat,
          userLng: userLng,
          actualLat: actualLat,
          actualLng: actualLng,
          distance: distanceVal,
          timeTaken: elapsedTime,
          timestamp: new Date(),
          isStatic: isStatic,
          // Notice we are not storing `categories` here
        });
      } catch (error) {
        console.error("Error saving submission data:", error);
      }
    }
  };

  // Handle next
  const handleNext = async () => {
    if (user?.isGuest) {
      // Guest: just update local stats & pick another random item
      if (distance !== null && gptDistance !== null) {
        if (distance <= gptDistance) {
          setGuestUserWinCount((prev) => prev + 1);
        } else {
          setGuestGptWinCount((prev) => prev + 1);
        }
        setGuestTotalDistance((prev) => prev + distance);
        setGuestGuessCount((prev) => prev + 1);
      }
      // Reset states
      setIsSubmitted(false);
      setSubmittedCoords(null);
      setDistance(null);
      setActualCoords(null);
      setSelectedCategories([]);
      setGptCoords(null);
      setGptDistance(null);
      setGptCategories([]);
      setShowGptGuess(false);
      setElapsedTime(0);
      clearInterval(timerRef.current);

      // Fetch another random item
      const item = await getRandomItem(isStatic);
      setCurrentImageData(item);
      if (item && isStatic) {
        const region = "North America"; // or any default
        const storageRef = getStorageRef(region);
        const url = await storageRef.ref(item.filename).getDownloadURL();
        setImageURL(url);
      }
      // Restart timer
      timerRef.current = setInterval(() => {
        setElapsedTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      // Fetch fresh user data before incrementing
      const userDoc = await firestore.collection("users").doc(user.uid).get();
      const userData = userDoc.data();

      // We'll increment the appropriate index
      let nextIndex;
      if (isStatic) {
        nextIndex = (userData?.currentImageIndex ?? 0) + 1;
      } else {
        nextIndex = (userData?.currentPhotosphereIndex ?? 0) + 1;
      }

      // Update user stats
      try {
        const userRef = firestore.collection("users").doc(user.uid);

        const updateData = {
          totalDistance: firebase.firestore.FieldValue.increment(distance || 0),
          guessCount: firebase.firestore.FieldValue.increment(1),
        };

        // Compare user and GPT performance
        if (gptDistance !== null) {
          if (distance <= gptDistance) {
            updateData.userWinCount =
              firebase.firestore.FieldValue.increment(1);
            setUserWinCount((prevCount) => prevCount + 1);
          } else {
            updateData.gptWinCount = firebase.firestore.FieldValue.increment(1);
            setGptWinCount((prevCount) => prevCount + 1);
          }
        }

        // Update the current index by +1
        if (isStatic) {
          updateData.currentImageIndex = nextIndex;
        } else {
          updateData.currentPhotosphereIndex = nextIndex;
        }

        // Save to Firestore
        await userRef.update(updateData);

        // Update local stats
        setTotalDistance((prevDistance) => prevDistance + (distance || 0));
        setGuessCount((prevCount) => prevCount + 1);
        setAverageDistance(
          (totalDistance + (distance || 0)) / (guessCount + 1)
        );
      } catch (error) {
        console.error("Error updating user stats:", error);
      }

      // Reset local states
      setIsSubmitted(false);
      setSubmittedCoords(null);
      setDistance(null);
      setActualCoords(null);
      setSelectedCategories([]);
      setGptCoords(null);
      setGptDistance(null);
      setGptCategories([]);
      setShowGptGuess(false);
      setElapsedTime(0);

      // Check if we've reached the end of available items
      if (isStatic && nextIndex >= totalImages) {
        setStaticImagesAvailable(false);
        if (photospheresAvailable) {
          alert(
            "You've viewed all available static images. Switching to photospheres."
          );
          setAnnotationType("Photosphere");
          setIsStatic(false);
        } else {
          alert("You've completed all available images and photospheres!");
          setCurrentImageData(null);
          return;
        }
      } else if (!isStatic && nextIndex >= totalPhotospheres) {
        setPhotospheresAvailable(false);
        if (staticImagesAvailable) {
          alert(
            "You've viewed all available photospheres. Switching to static images."
          );
          setAnnotationType("Static Image");
          setIsStatic(true);
        } else {
          alert("You've completed all available images and photospheres!");
          setCurrentImageData(null);
          return;
        }
      }

      // Now load the new item based on updated index
      try {
        const updatedUserDoc = await firestore
          .collection("users")
          .doc(user.uid)
          .get();
        const updatedUserData = updatedUserDoc.data();

        const newItem = await getNextItem(updatedUserData, isStatic);

        if (!newItem) {
          setCurrentImageData(null);
          return;
        }
        setCurrentImageData(newItem);

        // Load image URL if it's a static image
        if (isStatic) {
          const storageRef = getStorageRef(
            updatedUserData.region || "North America"
          );
          const url = await storageRef.ref(newItem.filename).getDownloadURL();
          setImageURL(url);
        } else {
          setImageURL(null);
        }

        // Restart timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        timerRef.current = setInterval(() => {
          setElapsedTime((prevTime) => prevTime + 1);
        }, 1000);
      } catch (error) {
        console.error("Error getting the next item:", error);
      }
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

  if (isLoading || isHoldingLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Typography variant="h5">
          Loading images/photospheres, please wait...
        </Typography>
      </Box>
    );
  }

  // Only show “No more images” if neither static nor photospheres remain
  if (
    !isLoading &&
    !currentImageData &&
    !staticImagesAvailable &&
    !photospheresAvailable
  ) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        flexDirection="column"
        p={3}
      >
        <Typography variant="h4" gutterBottom>
          No more images! You have completed the benchmark!
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSignOut}
          startIcon={<LogoutIcon />}
          sx={{ mt: 2 }}
        >
          Sign Out
        </Button>
      </Box>
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

          {user?.isGuest ? (
            <Typography
              variant="h6"
              style={{ flexGrow: 1, textAlign: "center" }}
            >
              Guest Session: Avg Score:{" "}
              {(guestGuessCount
                ? guestTotalDistance / guestGuessCount
                : 0
              ).toFixed(2)}{" "}
              km | Beat GPT: {guestUserWinCount} | Lost to GPT:{" "}
              {guestGptWinCount}
            </Typography>
          ) : (
            <Typography
              variant="h6"
              style={{ flexGrow: 1, textAlign: "center" }}
            >
              Avg Score: {averageDistance.toFixed(2)} km | Beat GPT:{" "}
              {userWinCount} times | Lost to GPT: {gptWinCount} times
            </Typography>
          )}
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
            disabled={!staticImagesAvailable && !photospheresAvailable}
          >
            <InputLabel id="annotation-type-label">Annotation Type</InputLabel>
            <Select
              labelId="annotation-type-label"
              id="annotation-type-select"
              value={annotationType}
              onChange={handleAnnotationTypeChange}
              label="Annotation Type"
            >
              <MenuItem value="Static Image" disabled={!staticImagesAvailable}>
                Static Image
              </MenuItem>
              <MenuItem value="Photosphere" disabled={!photospheresAvailable}>
                Photosphere
              </MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper elevation={3} style={{ padding: "10px" }}>
              {isStatic
                ? currentImageData &&
                  imageURL && (
                    <img
                      src={imageURL}
                      alt="Guess"
                      style={{ width: "100%", height: "auto" }}
                    />
                  )
                : currentImageData && (
                    <div style={{ width: "100%", height: "500px" }}>
                      <StreetViewComponent
                        lat={parseFloat(currentImageData.lat)}
                        lng={parseFloat(currentImageData.lng)}
                        heading={parseFloat(currentImageData.heading || 0)}
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
                  gptCoords={showGptGuess ? gptCoords : null}
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
                    {showGptGuess && gptDistance && (
                      <span
                        style={{
                          marginLeft: "10px",
                          color: distance <= gptDistance ? "green" : "red",
                        }}
                      >
                        {distance <= gptDistance
                          ? `(Beat GPT by ${(gptDistance - distance).toFixed(
                              2
                            )} km!)`
                          : `(GPT was better by ${(
                              distance - gptDistance
                            ).toFixed(2)} km)`}
                      </span>
                    )}
                  </Typography>
                  <Typography variant="body1">
                    Actual Coordinates: {actualCoords.lat.toFixed(4)},{" "}
                    {actualCoords.lng.toFixed(4)}
                  </Typography>
                  {showGptGuess && gptCoords && (
                    <Typography variant="body1">
                      GPT's Guess: {gptCoords.lat.toFixed(4)},{" "}
                      {gptCoords.lng.toFixed(4)} ({gptDistance.toFixed(2)} km
                      away)
                    </Typography>
                  )}
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
                <Typography
                  variant="body2"
                  color="textSecondary"
                  style={{ marginTop: "5px" }}
                >
                  (Categories are optional, but help us understand what features
                  are useful)
                </Typography>
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle1"
                    display="flex"
                    alignItems="center"
                  >
                    <PersonIcon style={{ marginRight: "8px" }} /> Your
                    Categories:
                  </Typography>
                  <FormGroup>
                    <Grid container spacing={1}>
                      {categories.map((category) => (
                        <Grid item xs={12} sm={6} key={category.name}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                value={category.name}
                                checked={selectedCategories.includes(
                                  category.name
                                )}
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
                </Grid>

                {showGptGuess && gptCategories && gptCategories.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Typography
                      variant="subtitle1"
                      display="flex"
                      alignItems="center"
                    >
                      <ComputerIcon style={{ marginRight: "8px" }} /> GPT's
                      Categories:
                    </Typography>
                    <Box mt={1}>
                      {gptCategories.map((category) => (
                        <Chip
                          key={category}
                          label={category}
                          variant="outlined"
                          style={{ margin: "0 4px 4px 0" }}
                        />
                      ))}
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </Box>
      </Box>
    </div>
  );
}

export default Annotation;
