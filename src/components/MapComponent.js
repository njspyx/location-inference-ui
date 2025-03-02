import React, { useRef, useCallback, useEffect } from "react";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const center = {
  lat: 0,
  lng: 0,
};

function MapComponent({
  onSelectCoords,
  submittedCoords,
  actualCoords,
  gptCoords,
  isSubmitted,
}) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
  });

  const mapRef = useRef();
  const polylineRef = useRef(null);
  const gptPolylineRef = useRef(null);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onMapClick = useCallback(
    (event) => {
      if (isSubmitted) return;

      const lat = event.latLng.lat();
      const lng = event.latLng.lng();

      // Log to see if this function is being called correctly
      console.log("Map clicked:", { lat, lng });

      onSelectCoords({ lat, lng });
    },
    [onSelectCoords, isSubmitted]
  );

  // Debug effect to watch for changes in submittedCoords
  useEffect(() => {
    console.log("submittedCoords updated:", submittedCoords);
  }, [submittedCoords]);

  // Manage Polylines from user guess to actual location
  useEffect(() => {
    if (mapRef.current) {
      if (submittedCoords && actualCoords) {
        // Remove existing Polyline if it exists
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
        }

        // Create a new Polyline
        const polyline = new window.google.maps.Polyline({
          path: [submittedCoords, actualCoords],
          geodesic: true,
          strokeColor: "#FF0000",
          strokeOpacity: 1.0,
          strokeWeight: 2,
        });

        // Set the Polyline on the map
        polyline.setMap(mapRef.current);

        // Save the Polyline instance
        polylineRef.current = polyline;
      } else {
        // Remove the Polyline if either coordinate is null
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
          polylineRef.current = null;
        }
      }
    }
  }, [submittedCoords, actualCoords]);

  // Manage Polylines from GPT guess to actual location
  useEffect(() => {
    if (mapRef.current) {
      if (gptCoords && actualCoords) {
        // Remove existing GPT Polyline if it exists
        if (gptPolylineRef.current) {
          gptPolylineRef.current.setMap(null);
        }

        // Create a new Polyline for GPT guess
        const gptPolyline = new window.google.maps.Polyline({
          path: [gptCoords, actualCoords],
          geodesic: true,
          strokeColor: "#0000FF", // Blue line for GPT
          strokeOpacity: 1.0,
          strokeWeight: 2,
        });

        // Set the GPT Polyline on the map
        gptPolyline.setMap(mapRef.current);

        // Save the GPT Polyline instance
        gptPolylineRef.current = gptPolyline;
      } else {
        // Remove the GPT Polyline if either coordinate is null
        if (gptPolylineRef.current) {
          gptPolylineRef.current.setMap(null);
          gptPolylineRef.current = null;
        }
      }
    }
  }, [gptCoords, actualCoords]);

  // Reset polylineRefs on unmount
  useEffect(() => {
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      if (gptPolylineRef.current) {
        gptPolylineRef.current.setMap(null);
        gptPolylineRef.current = null;
      }
    };
  }, []);

  // If actualCoords is set, pan to the actualCoords and set zoom level
  useEffect(() => {
    if (mapRef.current) {
      if (actualCoords) {
        // Calculate bounding box to fit all relevant markers
        if (submittedCoords && gptCoords) {
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend(
            new window.google.maps.LatLng(actualCoords.lat, actualCoords.lng)
          );
          bounds.extend(
            new window.google.maps.LatLng(
              submittedCoords.lat,
              submittedCoords.lng
            )
          );
          bounds.extend(
            new window.google.maps.LatLng(gptCoords.lat, gptCoords.lng)
          );

          // Fit map to these bounds
          mapRef.current.fitBounds(bounds);

          // Set minimum zoom to prevent excessive zoom on close markers
          const listener = window.google.maps.event.addListener(
            mapRef.current,
            "idle",
            function () {
              if (mapRef.current.getZoom() > 10) {
                mapRef.current.setZoom(10);
              }
              window.google.maps.event.removeListener(listener);
            }
          );
        } else if (submittedCoords) {
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend(
            new window.google.maps.LatLng(actualCoords.lat, actualCoords.lng)
          );
          bounds.extend(
            new window.google.maps.LatLng(
              submittedCoords.lat,
              submittedCoords.lng
            )
          );

          mapRef.current.fitBounds(bounds);

          const listener = window.google.maps.event.addListener(
            mapRef.current,
            "idle",
            function () {
              if (mapRef.current.getZoom() > 10) {
                mapRef.current.setZoom(10);
              }
              window.google.maps.event.removeListener(listener);
            }
          );
        } else {
          mapRef.current.panTo(actualCoords);
          mapRef.current.setZoom(4);
        }
      } else {
        // Reset map if no actual coordinates
        mapRef.current.panTo(center);
        mapRef.current.setZoom(2);
      }
    }
  }, [actualCoords, submittedCoords, gptCoords]);

  if (loadError) return "Error loading maps";
  if (!isLoaded) return "Loading Maps";

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={2}
        center={center}
        onClick={onMapClick}
        onLoad={onMapLoad}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          draggable: !isSubmitted,
          scrollwheel: !isSubmitted,
          disableDoubleClickZoom: isSubmitted,
          gestureHandling: isSubmitted ? "none" : "auto",
        }}
      >
        {/* Explicitly check that submittedCoords exists and has lat/lng properties */}
        {submittedCoords &&
          typeof submittedCoords.lat === "number" &&
          typeof submittedCoords.lng === "number" && (
            <Marker
              position={submittedCoords}
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                labelOrigin: new window.google.maps.Point(14, -10),
              }}
              label={{
                text: "You",
                color: "#C00000",
                fontWeight: "bold",
              }}
            />
          )}
        {gptCoords &&
          typeof gptCoords.lat === "number" &&
          typeof gptCoords.lng === "number" && (
            <Marker
              position={gptCoords}
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                labelOrigin: new window.google.maps.Point(14, -10),
              }}
              label={{
                text: "GPT",
                color: "#0000C0",
                fontWeight: "bold",
              }}
            />
          )}
        {actualCoords &&
          typeof actualCoords.lat === "number" &&
          typeof actualCoords.lng === "number" && (
            <Marker
              position={actualCoords}
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
                labelOrigin: new window.google.maps.Point(14, -10),
              }}
              label={{
                text: "Actual",
                color: "#006400",
                fontWeight: "bold",
              }}
            />
          )}
      </GoogleMap>
    </div>
  );
}

export default MapComponent;
