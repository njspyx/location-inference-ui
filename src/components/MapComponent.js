import React, { useCallback, useEffect, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  Polyline,
} from "@react-google-maps/api";

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
    googleMapsApiKey: "YOUR_API_KEY", // Replace with your API key
  });

  const mapRef = useRef();

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

  useEffect(() => {
    if (mapRef.current) {
      if (actualCoords) {
        mapRef.current.panTo(actualCoords);
        mapRef.current.setZoom(4);
      } else if (!actualCoords && !submittedCoords) {
        // Both actualCoords and submittedCoords are null, reset the map
        mapRef.current.panTo(center);
        mapRef.current.setZoom(2);
      }
    }
  }, [actualCoords, submittedCoords]);

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
        {submittedCoords && actualCoords && (
          <Polyline
            path={[submittedCoords, actualCoords]}
            options={{
              strokeColor: "#FF0000",
              strokeOpacity: 0.8,
              strokeWeight: 2,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}

export default MapComponent;
