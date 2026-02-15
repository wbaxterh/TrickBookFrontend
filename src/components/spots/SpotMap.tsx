/**
 * SpotMap Component
 * Interactive map showing a spot's location with user location
 */

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, getThemeColors } from '@/constants/colors';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

interface SpotMapProps {
  latitude: number;
  longitude: number;
  spotName: string;
  height?: number;
}

export function SpotMap({ latitude, longitude, spotName, height = 200 }: SpotMapProps) {
  const { isDark } = useThemeContext();
  const theme = getThemeColors(isDark);
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (_error) {}
  };

  const centerOnSpot = () => {
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500,
    );
  };

  const centerOnUser = async () => {
    if (!locationPermission) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Enable location access in settings to use this feature.');
        return;
      }
      setLocationPermission(true);
    }

    try {
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      mapRef.current?.animateToRegion(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500,
      );
    } catch (_error) {
      Alert.alert('Error', 'Could not get your location.');
    }
  };

  const fitBothLocations = () => {
    if (!userLocation) {
      centerOnSpot();
      return;
    }

    const coordinates = [{ latitude, longitude }, userLocation];

    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  };

  const openDirections = () => {
    const _scheme = Platform.select({
      ios: 'maps:',
      android: 'geo:',
    });
    const url = Platform.select({
      ios: `maps:?daddr=${latitude},${longitude}&dirflg=d`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(spotName)})`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback to Google Maps web
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
        );
      });
    }
  };

  const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  ];

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        customMapStyle={isDark ? darkMapStyle : []}
        showsUserLocation={locationPermission}
        showsMyLocationButton={false}
      >
        <Marker coordinate={{ latitude, longitude }} title={spotName}>
          <View style={styles.markerContainer}>
            <View style={[styles.marker, { backgroundColor: colors.primary }]}>
              <Ionicons name="location" size={20} color={colors.primaryText} />
            </View>
            <View style={[styles.markerPoint, { borderTopColor: colors.primary }]} />
          </View>
        </Marker>
      </MapView>

      {/* Map Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: theme.surface }]}
          onPress={centerOnSpot}
        >
          <Ionicons name="flag" size={18} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: theme.surface }]}
          onPress={centerOnUser}
        >
          <Ionicons name="navigate" size={18} color={theme.text} />
        </TouchableOpacity>

        {userLocation && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: theme.surface }]}
            onPress={fitBothLocations}
          >
            <Ionicons name="expand" size={18} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Directions Button */}
      <TouchableOpacity
        style={[styles.directionsButton, { backgroundColor: colors.primary }]}
        onPress={openDirections}
      >
        <Ionicons name="navigate-circle" size={20} color={colors.primaryText} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerPoint: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  controls: {
    position: 'absolute',
    right: 10,
    top: 10,
    gap: 8,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  directionsButton: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default SpotMap;
