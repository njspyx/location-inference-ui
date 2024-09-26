import React, { useCallback, useEffect, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  Polyline,
} from "@react-google-maps/api";

const mapContainerStyle = {
  width: "640px",
  height: "400px",
};

const center = {
  lat: 0,
  lng: 0,
};

function MapComponent({ onSelectCoords, submittedCoords, actualCoords }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: "AIzaSyAUir3L7OlFeyLXpW3JoePo_BYfFdeiK6w",
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
    if (mapRef.current && actualCoords) {
      mapRef.current.panTo(actualCoords);
      mapRef.current.setZoom(4);
    }
  }, [actualCoords]);

  if (loadError) return "Error loading maps";
  if (!isLoaded) return "Loading Maps";

  return (
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
  );
}

export default MapComponent;
