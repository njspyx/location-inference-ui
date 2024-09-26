import React, { useState, useEffect } from "react";
import axios from "axios";
import MapComponent from "./MapComponent";

function App() {
  const [imgsData, setImgsData] = useState([]);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [submittedCoords, setSubmittedCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [actualCoords, setActualCoords] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Fetch image coords data on page render
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/images")
      .then((res) => {
        setImgsData(res.data);
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  // Copied from python notebooks
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers

    // Convert degrees to radians
    const toRadians = (degrees) => degrees * (Math.PI / 180);
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

  // SUBMIT btn handler
  const handleSubmit = () => {
    if (!submittedCoords) {
      alert("Please select a location on the map first!");
      return;
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
  };

  // NEXT btn handler
  const handleNext = () => {
    const currentImageData = imgsData[currentImageIdx];

    // Save user results
    axios
      .post("http://localhost:5000/api/submit", {
        filename: currentImageData.filename,
        userLat: submittedCoords.lat,
        userLng: submittedCoords.lng,
        distance: distance,
        categories: selectedCategories,
      })
      .catch((err) => {
        console.error(err);
      });

    // move to next image and reset state
    setCurrentImageIdx(currentImageIdx + 1);
    setSubmittedCoords(null);
    setDistance(null);
    setActualCoords(null);
    setIsSubmitted(false);
    setSelectedCategories([]);
  };

  const handleCategoryChange = (event) => {
    const { value, checked } = event.target;
    if (checked) {
      setSelectedCategories((prev) => [...prev, value]);
    } else {
      setSelectedCategories((prev) => prev.filter((cat) => cat !== value));
    }
  };

  // Check if all images are done
  if (currentImageIdx >= imgsData.length) {
    return <div>Completed all images!</div>;
  }

  const currentImageData = imgsData[currentImageIdx];
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
      <h1>Guess the coordinates of Image {currentImageIdx + 1}</h1>
      <img
        src={`http://localhost:5000/${currentImageData.filename}`}
        alt="img"
        style={{
          width: "640px",
          height: "480px",
        }}
      />
      <MapComponent
        onSelectCoords={setSubmittedCoords}
        submittedCoords={submittedCoords}
        actualCoords={actualCoords}
      />
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
  );
}

export default App;
