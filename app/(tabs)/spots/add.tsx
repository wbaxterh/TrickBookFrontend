/**
 * Add Spot Screen
 * Full-screen map experience for adding new spots
 *
 * Features:
 * - Interactive map with pin dropping
 * - Google Places search
 * - Street View deep link
 * - Spot details form
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  KeyboardAvoidingView,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  createSpot,
  searchPlaces,
  reverseGeocode,
  PlaceSearchResult,
  getSportTypes,
  SportType,
} from '@/lib/api/spots';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

// Categories for spots
const SPOT_CATEGORIES = [
  { id: 'park', name: 'Park', icon: 'leaf' },
  { id: 'street', name: 'Street', icon: 'business' },
  { id: 'indoor', name: 'Indoor', icon: 'home' },
  { id: 'diy', name: 'DIY', icon: 'construct' },
  { id: 'other', name: 'Other', icon: 'ellipsis-horizontal' },
] as const;

// Dark mode map styling
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
];

type Step = 'location' | 'details';

export default function AddSpotScreen() {
  const { theme, isDark } = useThemeContext();
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);

  // Step state
  const [step, setStep] = useState<Step>('location');

  // Location state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Form state
  const [spotName, setSpotName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('other');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [sportTypes, setSportTypes] = useState<SportType[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sportModalVisible, setSportModalVisible] = useState(false);

  // Get user location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(coords);
        setSelectedLocation(coords);

        // Reverse geocode to get initial address
        const geocodeResult = await reverseGeocode(coords.latitude, coords.longitude);
        if (geocodeResult.city) setCity(geocodeResult.city);
        if (geocodeResult.state) setState(geocodeResult.state);
        if (geocodeResult.address) setLocationAddress(geocodeResult.address);
      }
    })();
  }, []);

  // Fetch sport types
  useEffect(() => {
    const fetchSportTypes = async () => {
      const types = await getSportTypes();
      setSportTypes(types);
    };
    fetchSportTypes();
  }, []);

  // Handle map press to drop pin
  const handleMapPress = useCallback(async (event: any) => {
    const { coordinate } = event.nativeEvent;
    setSelectedLocation(coordinate);
    setLocationName('');
    setSelectedPlaceId(null);

    // Reverse geocode
    setLoading(true);
    try {
      const result = await reverseGeocode(coordinate.latitude, coordinate.longitude);
      if (result.address) setLocationAddress(result.address);
      if (result.city) setCity(result.city);
      if (result.state) setState(result.state);
    } catch (error) {
      console.error('Reverse geocode error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setShowSearchResults(true);
    try {
      const results = await searchPlaces(
        searchQuery,
        userLocation?.latitude,
        userLocation?.longitude
      );
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, userLocation]);

  // Handle search result selection
  const handleSelectPlace = useCallback((place: PlaceSearchResult) => {
    setSelectedLocation({
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setLocationName(place.name);
    setLocationAddress(place.address);
    setSelectedPlaceId(place.placeId);
    setSearchQuery('');
    setShowSearchResults(false);
    setSearchResults([]);

    // Extract city/state from address
    const addressParts = place.address?.split(', ') || [];
    if (addressParts.length >= 2) {
      // Try to extract city and state
      const stateZip = addressParts[addressParts.length - 2];
      const cityPart = addressParts[addressParts.length - 3];
      if (cityPart) setCity(cityPart);
      if (stateZip) {
        const statePart = stateZip.split(' ')[0];
        if (statePart) setState(statePart);
      }
    }

    // Animate to the selected location
    mapRef.current?.animateToRegion({
      latitude: place.latitude,
      longitude: place.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500);
  }, []);

  // Open Street View
  const openStreetView = useCallback(() => {
    if (!selectedLocation) return;

    const { latitude, longitude } = selectedLocation;
    // Open Google Maps Street View
    const url = Platform.select({
      ios: `comgooglemaps://?center=${latitude},${longitude}&zoom=18&mapmode=streetview`,
      android: `google.navigation:q=${latitude},${longitude}&mode=streetview`,
    });

    const webUrl = `https://www.google.com/maps/@${latitude},${longitude},3a,75y,90t/data=!3m6!1e1!3m4!1s!2e0!7i16384!8i8192`;

    Linking.canOpenURL(url || '').then((supported) => {
      if (supported) {
        Linking.openURL(url!);
      } else {
        Linking.openURL(webUrl);
      }
    });
  }, [selectedLocation]);

  // Center on user location
  const centerOnUser = useCallback(() => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  }, [userLocation]);

  // Proceed to details step
  const proceedToDetails = useCallback(() => {
    if (!selectedLocation) {
      Alert.alert('Select Location', 'Please drop a pin or search for a location first.');
      return;
    }
    // Pre-fill spot name if we have a place name
    if (locationName && !spotName) {
      setSpotName(locationName);
    }
    setStep('details');
  }, [selectedLocation, locationName, spotName]);

  // Toggle sport selection
  const toggleSport = useCallback((sport: string) => {
    setSelectedSports(prev =>
      prev.includes(sport)
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  }, []);

  // Submit spot
  const handleSubmit = useCallback(async () => {
    if (!spotName.trim()) {
      Alert.alert('Required', 'Please enter a spot name.');
      return;
    }
    if (!selectedLocation) {
      Alert.alert('Required', 'Location is required.');
      return;
    }
    if (selectedSports.length === 0) {
      Alert.alert('Required', 'Please select at least one sport type.');
      return;
    }

    setSaving(true);
    try {
      const spotData = {
        name: spotName.trim(),
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        description: description.trim() || undefined,
        city: city || undefined,
        state: state || undefined,
        category: selectedCategory as 'park' | 'street' | 'indoor' | 'diy' | 'other',
        sportTypes: selectedSports,
        isPublic,
        googlePlaceId: selectedPlaceId || undefined,
      };

      const result = await createSpot(spotData);

      if (result) {
        Alert.alert(
          'Spot Added!',
          isPublic
            ? 'Your spot has been submitted for review. It will appear publicly once approved.'
            : 'Your private spot has been saved.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to create spot. Please try again.');
      }
    } catch (error) {
      console.error('Error creating spot:', error);
      Alert.alert('Error', 'Failed to create spot. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [spotName, selectedLocation, description, city, state, selectedCategory, selectedSports, isPublic, selectedPlaceId]);

  // Render location selection step
  const renderLocationStep = () => (
    <View style={styles.mapContainer}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={isDark ? darkMapStyle : []}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={handleMapPress}
        initialRegion={
          userLocation
            ? {
                ...userLocation,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
            : {
                latitude: 40.7128,
                longitude: -74.006,
                latitudeDelta: 0.5,
                longitudeDelta: 0.5,
              }
        }
      >
        {selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            draggable
            onDragEnd={handleMapPress}
          >
            <View style={styles.markerContainer}>
              <View style={styles.marker}>
                <Ionicons name="location" size={24} color={DARK} />
              </View>
              <View style={styles.markerPoint} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Search Bar */}
      <View style={[styles.searchOverlay, { backgroundColor: 'transparent' }]}>
        <SafeAreaView edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={[styles.backButton, { backgroundColor: theme.surface }]} onPress={() => router.back()}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Add Spot</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Search Input */}
          <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
            <Ionicons name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search for a place..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowSearchResults(false);
              }}>
                <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Search Results */}
          {showSearchResults && (
            <View style={[styles.searchResults, { backgroundColor: theme.surface }]}>
              {searching ? (
                <View style={styles.searchLoading}>
                  <ActivityIndicator size="small" color={YELLOW} />
                  <Text style={[styles.searchLoadingText, { color: theme.textSecondary }]}>
                    Searching...
                  </Text>
                </View>
              ) : searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.placeId}
                  keyboardShouldPersistTaps="handled"
                  style={styles.searchResultsList}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.searchResultItem}
                      onPress={() => handleSelectPlace(item)}
                    >
                      <Ionicons name="location" size={20} color={YELLOW} />
                      <View style={styles.searchResultInfo}>
                        <Text style={[styles.searchResultName, { color: theme.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.searchResultAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                          {item.address}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                />
              ) : (
                <Text style={[styles.noResultsText, { color: theme.textSecondary }]}>
                  No results found
                </Text>
              )}
            </View>
          )}
        </SafeAreaView>
      </View>

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <Pressable
          style={[styles.mapControlButton, { backgroundColor: YELLOW }]}
          onPress={centerOnUser}
        >
          <Ionicons name="navigate" size={20} color={DARK} />
        </Pressable>
        {selectedLocation && (
          <Pressable
            style={[styles.mapControlButton, { backgroundColor: YELLOW }]}
            onPress={openStreetView}
          >
            <Ionicons name="eye" size={20} color={DARK} />
          </Pressable>
        )}
      </View>

      {/* Bottom Card */}
      <View style={[styles.bottomCard, { backgroundColor: theme.surface }]}>
        {selectedLocation ? (
          <>
            <View style={styles.locationInfo}>
              {locationName ? (
                <Text style={[styles.locationName, { color: theme.text }]} numberOfLines={1}>
                  {locationName}
                </Text>
              ) : null}
              <Text style={[styles.locationAddress, { color: theme.textSecondary }]} numberOfLines={2}>
                {locationAddress || `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`}
              </Text>
              {loading && (
                <ActivityIndicator size="small" color={YELLOW} style={{ marginTop: 8 }} />
              )}
            </View>
            <Pressable
              style={[styles.continueButton, { backgroundColor: YELLOW }]}
              onPress={proceedToDetails}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={DARK} />
            </Pressable>
          </>
        ) : (
          <View style={styles.instructionContainer}>
            <Ionicons name="finger-print" size={32} color={YELLOW} />
            <Text style={[styles.instructionText, { color: theme.text }]}>
              Tap on the map to drop a pin
            </Text>
            <Text style={[styles.instructionSubtext, { color: theme.textSecondary }]}>
              Or search for a location above
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  // Render details form step
  const renderDetailsStep = () => (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.detailsHeader}>
        <Pressable style={styles.backButtonDetails} onPress={() => setStep('location')}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Spot Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Location Preview */}
          <View style={[styles.locationPreview, { backgroundColor: theme.surface }]}>
            <Ionicons name="location" size={24} color={YELLOW} />
            <View style={styles.locationPreviewInfo}>
              <Text style={[styles.locationPreviewText, { color: theme.text }]} numberOfLines={1}>
                {locationName || locationAddress || 'Selected Location'}
              </Text>
              <Text style={[styles.locationPreviewCoords, { color: theme.textSecondary }]}>
                {city && state ? `${city}, ${state}` : `${selectedLocation?.latitude.toFixed(4)}, ${selectedLocation?.longitude.toFixed(4)}`}
              </Text>
            </View>
            <Pressable onPress={() => setStep('location')}>
              <Text style={{ color: YELLOW, fontWeight: '600' }}>Change</Text>
            </Pressable>
          </View>

          {/* Spot Name */}
          <Text style={[styles.label, { color: theme.text }]}>Spot Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="e.g., Astoria Skatepark"
            placeholderTextColor={theme.textSecondary}
            value={spotName}
            onChangeText={setSpotName}
          />

          {/* Description */}
          <Text style={[styles.label, { color: theme.text }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="Describe this spot..."
            placeholderTextColor={theme.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          {/* Category */}
          <Text style={[styles.label, { color: theme.text }]}>Category *</Text>
          <View style={styles.categoryContainer}>
            {SPOT_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryOption,
                  { backgroundColor: selectedCategory === cat.id ? YELLOW : theme.surface },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={20}
                  color={selectedCategory === cat.id ? DARK : theme.text}
                />
                <Text
                  style={[
                    styles.categoryText,
                    { color: selectedCategory === cat.id ? DARK : theme.text },
                  ]}
                >
                  {cat.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Sport Types */}
          <Text style={[styles.label, { color: theme.text }]}>Sport Types *</Text>
          <Pressable
            style={[styles.sportSelector, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setSportModalVisible(true)}
          >
            <Text style={{ color: selectedSports.length > 0 ? theme.text : theme.textSecondary }}>
              {selectedSports.length > 0
                ? selectedSports.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
                : 'Select sport types...'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
          </Pressable>

          {/* Public/Private Toggle */}
          <View style={styles.toggleContainer}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.label, { color: theme.text, marginBottom: 0 }]}>Make Public</Text>
              <Text style={[styles.toggleSubtext, { color: theme.textSecondary }]}>
                {isPublic ? 'Spot will be visible to everyone after approval' : 'Only you can see this spot'}
              </Text>
            </View>
            <Pressable
              style={[
                styles.toggle,
                { backgroundColor: isPublic ? YELLOW : theme.border },
              ]}
              onPress={() => setIsPublic(!isPublic)}
            >
              <View
                style={[
                  styles.toggleKnob,
                  { backgroundColor: '#fff', transform: [{ translateX: isPublic ? 22 : 2 }] },
                ]}
              />
            </Pressable>
          </View>

          {/* Submit Button */}
          <Pressable
            style={[
              styles.submitButton,
              { backgroundColor: YELLOW },
              saving && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={DARK} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color={DARK} />
                <Text style={styles.submitButtonText}>
                  {isPublic ? 'Submit for Review' : 'Save Spot'}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sport Selection Modal */}
      <Modal
        visible={sportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSportModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSportModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select Sports</Text>
              <Pressable onPress={() => setSportModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              {sportTypes.map((sport) => (
                <Pressable
                  key={sport.value}
                  style={[
                    styles.sportOption,
                    selectedSports.includes(sport.value) && { backgroundColor: YELLOW + '20' },
                  ]}
                  onPress={() => toggleSport(sport.value)}
                >
                  <Text
                    style={[
                      styles.sportOptionText,
                      { color: theme.text },
                      selectedSports.includes(sport.value) && { fontWeight: '600' },
                    ]}
                  >
                    {sport.label}
                  </Text>
                  {selectedSports.includes(sport.value) && (
                    <Ionicons name="checkmark-circle" size={22} color={YELLOW} />
                  )}
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={[styles.modalDoneButton, { backgroundColor: YELLOW }]}
              onPress={() => setSportModalVisible(false)}
            >
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );

  return step === 'location' ? renderLocationStep() : renderDetailsStep();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },

  // Search Overlay
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchResults: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  searchResultsList: {
    maxHeight: 250,
  },
  searchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  searchLoadingText: {
    fontSize: 14,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  searchResultAddress: {
    fontSize: 13,
  },
  noResultsText: {
    padding: 16,
    textAlign: 'center',
  },

  // Map Controls
  mapControls: {
    position: 'absolute',
    right: 16,
    top: '40%',
    gap: 10,
  },
  mapControlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },

  // Marker
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#B8A800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8,
  },
  markerPoint: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: YELLOW,
    marginTop: -4,
  },

  // Bottom Card
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  locationInfo: {
    marginBottom: 16,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    lineHeight: 20,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
  },
  instructionContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  instructionText: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 12,
  },
  instructionSubtext: {
    fontSize: 14,
    marginTop: 4,
  },

  // Details Step
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButtonDetails: {
    padding: 10,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    paddingBottom: 40,
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  locationPreviewInfo: {
    flex: 1,
  },
  locationPreviewText: {
    fontSize: 15,
    fontWeight: '600',
  },
  locationPreviewCoords: {
    fontSize: 13,
    marginTop: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 20,
  },
  inputMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sportSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: DARK,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    maxHeight: 350,
  },
  sportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  sportOptionText: {
    fontSize: 16,
  },
  modalDoneButton: {
    marginHorizontal: 20,
    marginVertical: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDoneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
  },
});
