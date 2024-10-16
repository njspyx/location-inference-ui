import React, { useCallback, useEffect, useRef } from "react";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const center = {
  lat: 0,
  lng: 0,
};

function MapComponent({ onSelectCoords, submittedCoords, actualCoords }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
  });

  const mapRef = useRef();
  const polylineRef = useRef(null);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onMapClick = useCallback(
    (event) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      onSelectCoords({ lat, lng });
    },
    [onSelectCoords]
  );

  // Manage Polyline creation and removal
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

  // reset polylineRef on unmount
  useEffect(() => {
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, []);

  // ff actualCoords is set, pan to the actualCoords and set zoom to 4
  useEffect(() => {
    if (mapRef.current) {
      if (actualCoords) {
        mapRef.current.panTo(actualCoords);
        mapRef.current.setZoom(4);
      } else {
        // else reset map
        mapRef.current.panTo(center);
        mapRef.current.setZoom(2);
      }
    }
  }, [actualCoords]);

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
        }}
      >
        {submittedCoords && (
          <Marker
            position={submittedCoords}
            icon={{
              url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
            }}
          />
        )}
        {actualCoords && (
          <Marker
            position={actualCoords}
            icon={{
              url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}

export default MapComponent;
