import React, { useRef, useEffect } from "react";
import { useLoadScript } from "@react-google-maps/api";

function StreetViewComponent({ lat, lng, heading }) {
  const streetViewRef = useRef(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    let panorama;
    if (isLoaded && streetViewRef.current) {
      // Create a new Street View Panorama instance
      panorama = new window.google.maps.StreetViewPanorama(
        streetViewRef.current,
        {
          position: { lat, lng },
          pov: { heading: heading, pitch: 0, zoom: 0 },
          disableDefaultUI: true,
          clickToGo: false,
          linksControl: false,
          panControl: false,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          zoomControl: false, // Disable zoom control UI
        }
      );

      // Disable zoom via scroll wheel and touch gestures
      panorama.setOptions({
        scrollwheel: false,
        disableDoubleClickZoom: true,
      });

      // Reset zoom level if it changes
      // const initialZoom = panorama.getZoom();
      // panorama.addListener("zoom_changed", () => {
      //   if (panorama.getZoom() !== initialZoom) {
      //     panorama.setZoom(initialZoom);
      //   }
      // });
    }

    return () => {
      if (panorama) {
        window.google.maps.event.clearInstanceListeners(panorama);
      }
    };
  }, [isLoaded, lat, lng, heading]);

  if (loadError) return <div>Error loading Street View</div>;
  if (!isLoaded) return <div>Loading Street View...</div>;

  return (
    <div ref={streetViewRef} style={{ width: "100%", height: "100%" }}></div>
  );
}

export default StreetViewComponent;
