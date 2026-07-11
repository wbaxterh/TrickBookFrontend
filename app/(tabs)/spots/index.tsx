/**
 * Spots Screen
 * Toggle between Map view and List view
 * Filterable by category and sport type
 */

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddToSpotListModal, SpotListCard as SpotListCardComponent } from '@/components/spots';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useMapClusters } from '@/hooks/useMapClusters';
import { createSpotList, getSpotLists } from '@/lib/api/spotlists';
import {
  getMapPins,
  getMySpots,
  getSavedSpots,
  getSportTypes,
  getSpotCategories,
  getSpots,
  type MapPin,
  type SportType,
  type Spot,
  type SpotCategory,
  saveSpot,
  unsaveSpot,
} from '@/lib/api/spots';
import { projectToScreen } from '@/lib/mapProjection';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import type { CreateSpotListInput, SpotList } from '@/types/spots';

/**
 * Theme colors - see /src/constants/colors.ts for full policy
 * YELLOW: Use for backgrounds with dark text, or icons. Never for text on light backgrounds.
 */
const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

// Spot categories and sport types are fetched from API in the component
const ALL_SPOT_CATEGORY: SpotCategory = { id: 'all', name: 'All', icon: 'location' };

// Sport icons mapping
const SPORT_ICONS: Record<string, string> = {
  all: 'globe',
  skateboarding: 'flash',
  snowboarding: 'snow',
  skiing: 'trending-down',
  bmx: 'bicycle',
  mtb: 'bicycle',
  scooter: 'walk',
  rollerblading: 'footsteps',
  surfing: 'water',
  wakeboarding: 'boat',
};

type ViewMode = 'map' | 'list';
type TabType = 'allSpots' | 'mySpots';
// My Spots sub-view: the flat authored+saved list vs. the named collections.
type MySpotsView = 'spots' | 'collections';
// A spot in the flat "My Spots" list, tagged with how the user relates to it.
type MySpotBadge = 'Mine' | 'Saved';
type MySpot = Spot & { mineOrSaved: MySpotBadge };

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

export default function SpotsScreen() {
  const { theme, isDark } = useThemeContext();
  const { user, token } = useAuthStore();
  const insets = useSafeAreaInsets();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('allSpots');

  // All Spots state
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSport, setSelectedSport] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [sportTypes, setSportTypes] = useState<SportType[]>([]);
  const [spotCategories, setSpotCategories] = useState<SpotCategory[]>([ALL_SPOT_CATEGORY]);
  const [_totalCount, setTotalCount] = useState(0);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  // Saved-spot state: track which spot ids the user has saved so the bookmark
  // control renders filled/outline. Seeded via isSpotSaved when a spot is selected.
  const [savedSpotIds, setSavedSpotIds] = useState<Set<string>>(new Set());
  // Spot whose named-list picker (AddToSpotListModal) is open, if any.
  const [spotForListModal, setSpotForListModal] = useState<Spot | null>(null);
  const [mapPins, setMapPins] = useState<MapPin[]>([]);
  // Current visible region, used to compute clusters for the viewport.
  const [region, setRegion] = useState<Region>({
    latitude: 40.7128,
    longitude: -74.006,
    latitudeDelta: 2,
    longitudeDelta: 2,
  });
  // Live region (updated continuously while panning) + viewport size, used to
  // project our overlay markers onto the map. Kept separate from `region` (which
  // only settles on region-change-complete and drives clustering) so markers
  // track the map smoothly during a gesture without recomputing clusters.
  const [projectionRegion, setProjectionRegion] = useState<Region>({
    latitude: 40.7128,
    longitude: -74.006,
    latitudeDelta: 2,
    longitudeDelta: 2,
  });
  const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 });
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const mapPinsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // My Spots state
  // Sub-view within the My Spots tab: the flat authored+saved list ('spots')
  // is primary; collections (named lists) live behind a toggle.
  const [mySpotsView, setMySpotsView] = useState<MySpotsView>('spots');
  // Flat list = spots the user created (badge "Mine") + saved (badge "Saved").
  const [mySpots, setMySpots] = useState<MySpot[]>([]);
  const [mySpotsLoading, setMySpotsLoading] = useState(false);
  const [mySpotsRefreshing, setMySpotsRefreshing] = useState(false);
  const [myLists, setMyLists] = useState<SpotList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsRefreshing, setListsRefreshing] = useState(false);

  // Filter modal (for All Spots)
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Create list modal (for My Spots)
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const { isKeyboardVisible, dismissKeyboard } = useKeyboardVisible();

  const handleCreateModalBackdropPress = () => {
    if (isKeyboardVisible()) {
      dismissKeyboard();
    } else {
      setCreateModalVisible(false);
    }
  };

  // One-tap save/unsave toggle for the selected-spot map card. Optimistically
  // flips the saved state, then reconciles on the server response.
  const handleToggleSave = async (spot: Spot) => {
    const currentlySaved = savedSpotIds.has(spot._id);
    // Optimistic update
    setSavedSpotIds((prev) => {
      const next = new Set(prev);
      if (currentlySaved) {
        next.delete(spot._id);
      } else {
        next.add(spot._id);
      }
      return next;
    });
    const ok = currentlySaved ? await unsaveSpot(spot._id) : await saveSpot(spot._id);
    if (!ok) {
      // Revert on failure
      setSavedSpotIds((prev) => {
        const next = new Set(prev);
        if (currentlySaved) {
          next.add(spot._id);
        } else {
          next.delete(spot._id);
        }
        return next;
      });
      Alert.alert('Error', currentlySaved ? 'Failed to remove spot' : 'Failed to save spot');
    }
  };

  // Long-press on the save control opens the named-list picker for that spot.
  const handleOpenListPicker = (spot: Spot) => {
    setSpotForListModal(spot);
  };

  // Get user location on mount and center map
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
        setRegion({ ...coords, latitudeDelta: 0.3, longitudeDelta: 0.3 });
        setProjectionRegion({ ...coords, latitudeDelta: 0.3, longitudeDelta: 0.3 });
        // Animate map to user location once obtained
        mapRef.current?.animateToRegion(
          {
            ...coords,
            latitudeDelta: 0.3,
            longitudeDelta: 0.3,
          },
          500,
        );
      }
    })();
  }, []);

  // Fetch sport types and spot categories on mount
  useEffect(() => {
    getSportTypes().then((types) => {
      setSportTypes([{ value: 'all', label: 'All Sports' }, ...types]);
    });
    getSpotCategories().then((cats) => {
      setSpotCategories([ALL_SPOT_CATEGORY, ...cats]);
    });
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch spots when filters change
  const fetchSpots = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getSpots({
        sportType: selectedSport,
        category: selectedCategory,
        q: debouncedSearchQuery || undefined,
        limit: 50,
      });
      setSpots(response.spots);
      setTotalCount(response.pagination.totalCount);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }, [selectedSport, selectedCategory, debouncedSearchQuery]);

  useEffect(() => {
    fetchSpots();
  }, [fetchSpots]);

  // Fetch map pins for a given visible region (bounding box) with debouncing.
  const fetchMapPinsForRegion = useCallback(
    (region: Region) => {
      if (mapPinsDebounceRef.current) {
        clearTimeout(mapPinsDebounceRef.current);
      }
      mapPinsDebounceRef.current = setTimeout(async () => {
        const bounds = {
          minLat: region.latitude - region.latitudeDelta / 2,
          maxLat: region.latitude + region.latitudeDelta / 2,
          minLng: region.longitude - region.longitudeDelta / 2,
          maxLng: region.longitude + region.longitudeDelta / 2,
        };
        const pins = await getMapPins(bounds, selectedSport, selectedCategory);
        setMapPins(pins);
      }, 350);
    },
    [selectedSport, selectedCategory],
  );

  // Track the viewport region (for clustering) and refetch pins, in one handler.
  const handleRegionChangeComplete = useCallback(
    (r: Region) => {
      setRegion(r);
      fetchMapPinsForRegion(r);
    },
    [fetchMapPinsForRegion],
  );

  // Cluster the viewport pins in JS (supercluster) — keeps rendered marker count bounded.
  const { clusters, getClusterExpansionRegion } = useMapClusters(mapPins, region);

  // Refetch pins when filters change, using the current visible region if available.
  useEffect(() => {
    return () => {
      if (mapPinsDebounceRef.current) {
        clearTimeout(mapPinsDebounceRef.current);
      }
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSpots();
    setRefreshing(false);
  }, [fetchSpots]);

  // Load the full set of saved spot ids up front so every bookmark control
  // (map preview cards, the selected-spot card, My Spots) renders filled/outline
  // correctly. This replaces per-spot isSpotSaved checks — those only seeded the
  // selected spot and, because they depended on savedSpotIds, re-added an id
  // right after the user optimistically unsaved it (the bookmark bounced back).
  const loadSavedSpotIds = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getSavedSpots({ limit: 500 });
      setSavedSpotIds(new Set(res.spots.map((s) => s._id)));
    } catch (_error) {
      // Keep whatever we already know on failure.
    }
  }, [token]);

  useEffect(() => {
    loadSavedSpotIds();
  }, [loadSavedSpotIds]);

  // Fetch the flat "My Spots" list: spots the user created (badge "Mine") plus
  // spots they saved (badge "Saved"), merged and de-duped by _id. If a spot is
  // both authored and saved, it shows "Mine".
  const fetchMySpots = useCallback(async () => {
    if (!user?.id && !user?._id) return;
    setMySpotsLoading(true);
    try {
      const [mine, saved] = await Promise.all([
        getMySpots({ limit: 100 }),
        getSavedSpots({ limit: 100 }),
      ]);
      const byId = new Map<string, MySpot>();
      // Saved first so authored ("Mine") overwrites on conflict.
      for (const spot of saved.spots) {
        byId.set(spot._id, { ...spot, mineOrSaved: 'Saved' });
      }
      for (const spot of mine.spots) {
        byId.set(spot._id, { ...spot, mineOrSaved: 'Mine' });
      }
      setMySpots(Array.from(byId.values()));
      // Keep the bookmark state in sync with what the server considers saved.
      setSavedSpotIds((prev) => {
        const next = new Set(prev);
        for (const spot of saved.spots) next.add(spot._id);
        return next;
      });
    } catch (_error) {
    } finally {
      setMySpotsLoading(false);
    }
  }, [user?.id, user?._id]);

  const onMySpotsRefresh = useCallback(async () => {
    setMySpotsRefreshing(true);
    await fetchMySpots();
    setMySpotsRefreshing(false);
  }, [fetchMySpots]);

  // Fetch user's spot lists
  const fetchMyLists = useCallback(async () => {
    if (!user?.id && !user?._id) return;
    setListsLoading(true);
    try {
      const data = await getSpotLists();
      setMyLists(data);
    } catch (_error) {
    } finally {
      setListsLoading(false);
    }
  }, [user?.id, user?._id]);

  const onListsRefresh = useCallback(async () => {
    setListsRefreshing(true);
    await fetchMyLists();
    setListsRefreshing(false);
  }, [fetchMyLists]);

  // Fetch My Spots content when switching to the tab / sub-view.
  useEffect(() => {
    if (activeTab !== 'mySpots') return;
    if (mySpotsView === 'spots') {
      fetchMySpots();
    } else {
      fetchMyLists();
    }
  }, [activeTab, mySpotsView, fetchMySpots, fetchMyLists]);

  // Refresh My Spots content whenever the screen regains focus (e.g. after
  // creating/saving a spot elsewhere), matching the previous refresh-on-focus.
  useFocusEffect(
    useCallback(() => {
      // Reconcile saved-bookmark state with the server on every focus.
      loadSavedSpotIds();
      if (activeTab !== 'mySpots') return;
      if (mySpotsView === 'spots') {
        fetchMySpots();
      } else {
        fetchMyLists();
      }
    }, [activeTab, mySpotsView, fetchMySpots, fetchMyLists, loadSavedSpotIds]),
  );

  // Handle create spot list
  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      const data: CreateSpotListInput = {
        name: newListName.trim(),
        description: newListDescription.trim() || undefined,
      };
      const result = await createSpotList(data);
      if (result) {
        setCreateModalVisible(false);
        setNewListName('');
        setNewListDescription('');
        fetchMyLists();
      } else {
        Alert.alert('Error', 'Failed to create spot list');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to create spot list');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header — hidden in fullscreen map for an immersive view. */}
      {!isMapFullscreen && (
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Spots</Text>
          <View style={styles.headerActions}>
            {activeTab === 'allSpots' && (
              <Pressable style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
                <Ionicons name="options-outline" size={18} color={isDark ? YELLOW : DARK} />
                <Text style={[styles.filterText, { color: isDark ? YELLOW : DARK }]}>Filter</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.addButton, { backgroundColor: YELLOW }]}
              onPress={() =>
                activeTab === 'allSpots'
                  ? router.push('/(tabs)/spots/add')
                  : setCreateModalVisible(true)
              }
            >
              <Ionicons name="add" size={22} color={DARK} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Tab Toggle — hidden in fullscreen map. */}
      {!isMapFullscreen && (
        <View style={[styles.tabContainer, { backgroundColor: theme.surface }]}>
          <Pressable
            style={[styles.tab, activeTab === 'allSpots' && { backgroundColor: YELLOW }]}
            onPress={() => setActiveTab('allSpots')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'allSpots' ? DARK : theme.textSecondary },
              ]}
            >
              All Spots
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'mySpots' && { backgroundColor: YELLOW }]}
            onPress={() => setActiveTab('mySpots')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'mySpots' ? DARK : theme.textSecondary },
              ]}
            >
              My Spots
            </Text>
          </Pressable>
        </View>
      )}

      {activeTab === 'allSpots' ? (
        <>
          {/* Search Bar — hidden in fullscreen map. */}
          {!isMapFullscreen && (
            <View style={styles.searchContainer}>
              <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
                <Ionicons name="search" size={20} color={theme.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search spots..."
                  placeholderTextColor={theme.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* View Toggle & Categories — hidden in fullscreen map. */}
          {!isMapFullscreen && (
            <View style={styles.filtersRow}>
              {/* View Toggle */}
              <View style={[styles.viewToggle, { backgroundColor: theme.surface }]}>
                <Pressable
                  style={[
                    styles.viewToggleButton,
                    viewMode === 'map' && styles.viewToggleActive,
                    viewMode === 'map' && { backgroundColor: YELLOW },
                  ]}
                  onPress={() => setViewMode('map')}
                >
                  <Ionicons
                    name="map"
                    size={18}
                    color={viewMode === 'map' ? DARK : theme.textSecondary}
                  />
                </Pressable>
                <Pressable
                  style={[
                    styles.viewToggleButton,
                    viewMode === 'list' && styles.viewToggleActive,
                    viewMode === 'list' && { backgroundColor: YELLOW },
                  ]}
                  onPress={() => setViewMode('list')}
                >
                  <Ionicons
                    name="list"
                    size={18}
                    color={viewMode === 'list' ? DARK : theme.textSecondary}
                  />
                </Pressable>
              </View>

              {/* Category Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesScroll}
              >
                {spotCategories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.categoryPill,
                      { backgroundColor: selectedCategory === cat.id ? YELLOW : theme.surface },
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={16}
                      color={selectedCategory === cat.id ? DARK : theme.textSecondary}
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
              </ScrollView>
            </View>
          )}

          {/* Content */}
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={YELLOW} />
            </View>
          ) : viewMode === 'map' ? (
            // Map View with all spots (clustered, viewport-loaded)
            <View
              style={[styles.mapContainer, isMapFullscreen && styles.mapContainerFullscreen]}
              onLayout={(e) => setMapLayout(e.nativeEvent.layout)}
            >
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                customMapStyle={isDark ? darkMapStyle : []}
                showsUserLocation
                showsMyLocationButton={false}
                initialRegion={
                  userLocation
                    ? {
                        latitude: userLocation.latitude,
                        longitude: userLocation.longitude,
                        latitudeDelta: 0.3,
                        longitudeDelta: 0.3,
                      }
                    : {
                        latitude: 40.7128,
                        longitude: -74.006,
                        latitudeDelta: 2,
                        longitudeDelta: 2,
                      }
                }
                onPress={() => setSelectedSpot(null)}
                onMapReady={() => setMapReady(true)}
                onRegionChange={(r) => setProjectionRegion(r)}
                onRegionChangeComplete={handleRegionChangeComplete}
              />

              {/* Custom markers overlaid on top of the map. react-native-maps
                  <Marker> crashes AIRGoogleMap under the New Architecture, so we
                  project each coordinate to a screen point and render plain RN
                  Views. box-none lets map pan/zoom pass through except on markers. */}
              {mapReady && mapLayout.width > 0 && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  {clusters.map((item) => {
                    const pt = projectToScreen(
                      item.latitude,
                      item.longitude,
                      projectionRegion,
                      mapLayout,
                    );
                    if (!pt) return null;

                    if (item.type === 'cluster') {
                      return (
                        <Pressable
                          key={item.id}
                          style={[
                            styles.overlayMarker,
                            {
                              left: pt.x,
                              top: pt.y,
                              transform: [{ translateX: -20 }, { translateY: -20 }],
                            },
                          ]}
                          onPress={() =>
                            mapRef.current?.animateToRegion(
                              getClusterExpansionRegion(
                                item.clusterId as number,
                                item.latitude,
                                item.longitude,
                              ),
                              300,
                            )
                          }
                        >
                          <View style={styles.clusterBubble}>
                            <Text style={styles.clusterText}>{item.count}</Text>
                          </View>
                        </Pressable>
                      );
                    }

                    const selected = selectedSpot?._id === item.pin?._id;
                    return (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.overlayMarker,
                          {
                            left: pt.x,
                            top: pt.y,
                            transform: [{ translateX: -20 }, { translateY: -47 }],
                          },
                        ]}
                        onPress={() => {
                          setSelectedSpot(item.pin as unknown as Spot);
                          mapRef.current?.animateToRegion(
                            {
                              latitude: item.latitude,
                              longitude: item.longitude,
                              latitudeDelta: 0.05,
                              longitudeDelta: 0.05,
                            },
                            300,
                          );
                        }}
                      >
                        <View style={styles.markerContainer}>
                          <View
                            style={[
                              styles.marker,
                              {
                                backgroundColor: YELLOW,
                                borderColor: selected ? DARK : '#B8A800',
                                borderWidth: selected ? 3 : 2,
                                transform: [{ scale: selected ? 1.2 : 1 }],
                              },
                            ]}
                          >
                            <Ionicons name="location" size={18} color={DARK} />
                          </View>
                          <View style={[styles.markerPoint, { borderTopColor: YELLOW }]} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Map Controls — nudged below the status bar when fullscreen so
                  the top control clears the notch/safe area. */}
              <View style={[styles.mapControls, isMapFullscreen && { top: insets.top + 12 }]}>
                {/* Filter — reachable in fullscreen since the header is hidden. */}
                <Pressable
                  style={[styles.mapControlButton, { backgroundColor: YELLOW }]}
                  onPress={() => setFilterModalVisible(true)}
                >
                  <Ionicons name="options-outline" size={20} color={DARK} />
                </Pressable>

                {/* Center on user button */}
                <Pressable
                  style={[styles.mapControlButton, { backgroundColor: YELLOW }]}
                  onPress={() => {
                    if (userLocation) {
                      mapRef.current?.animateToRegion(
                        {
                          ...userLocation,
                          latitudeDelta: 0.1,
                          longitudeDelta: 0.1,
                        },
                        500,
                      );
                    }
                  }}
                >
                  <Ionicons name="navigate" size={20} color={DARK} />
                </Pressable>

                {/* Zoom In */}
                <Pressable
                  style={[styles.mapControlButton, { backgroundColor: YELLOW }]}
                  onPress={() => {
                    mapRef.current?.getCamera().then((camera) => {
                      if (camera) {
                        mapRef.current?.animateCamera(
                          {
                            ...camera,
                            zoom: (camera.zoom || 10) + 1,
                          },
                          { duration: 300 },
                        );
                      }
                    });
                  }}
                >
                  <Ionicons name="add" size={22} color={DARK} />
                </Pressable>

                {/* Zoom Out */}
                <Pressable
                  style={[styles.mapControlButton, { backgroundColor: YELLOW }]}
                  onPress={() => {
                    mapRef.current?.getCamera().then((camera) => {
                      if (camera) {
                        mapRef.current?.animateCamera(
                          {
                            ...camera,
                            zoom: (camera.zoom || 10) - 1,
                          },
                          { duration: 300 },
                        );
                      }
                    });
                  }}
                >
                  <Ionicons name="remove" size={22} color={DARK} />
                </Pressable>

                {/* Toggle full-screen map */}
                <Pressable
                  style={[styles.mapControlButton, { backgroundColor: YELLOW }]}
                  onPress={() => setIsMapFullscreen((v) => !v)}
                >
                  <Ionicons name={isMapFullscreen ? 'contract' : 'expand'} size={18} color={DARK} />
                </Pressable>
              </View>

              {/* Selected spot card or spots preview — lifted above the bottom
                  safe area when fullscreen (no tab bar padding then). */}
              <View
                style={[
                  styles.mapSpotsContainer,
                  isMapFullscreen && { paddingBottom: insets.bottom + 16 },
                ]}
              >
                {selectedSpot ? (
                  <SpotMapCard
                    spot={selectedSpot}
                    theme={theme}
                    saved={savedSpotIds.has(selectedSpot._id)}
                    onPress={() => router.push(`/(tabs)/spots/${selectedSpot._id}`)}
                    onToggleSave={() => handleToggleSave(selectedSpot)}
                    onOpenListPicker={() => handleOpenListPicker(selectedSpot)}
                  />
                ) : spots.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.mapSpotsScroll}
                  >
                    {spots.slice(0, 5).map((spot) => (
                      <SpotMapCard
                        key={spot._id}
                        spot={spot}
                        theme={theme}
                        saved={savedSpotIds.has(spot._id)}
                        onPress={() => {
                          setSelectedSpot(spot);
                          mapRef.current?.animateToRegion(
                            {
                              latitude: spot.latitude,
                              longitude: spot.longitude,
                              latitudeDelta: 0.05,
                              longitudeDelta: 0.05,
                            },
                            500,
                          );
                        }}
                        onToggleSave={() => handleToggleSave(spot)}
                        onOpenListPicker={() => handleOpenListPicker(spot)}
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            </View>
          ) : (
            // List View
            <FlatList
              data={spots}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />
              }
              ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="location-outline" size={48} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No spots found</Text>
                  <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                    Try adjusting your search or filters
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <SpotListCard
                  spot={item}
                  theme={theme}
                  onPress={() => router.push(`/(tabs)/spots/${item._id}`)}
                />
              )}
            />
          )}

          {/* Filter Modal (Sport + Category) */}
          <Modal
            visible={filterModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setFilterModalVisible(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setFilterModalVisible(false)}>
              <Pressable style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Filter Spots</Text>
                  <Pressable onPress={() => setFilterModalVisible(false)}>
                    <Ionicons name="close" size={24} color={theme.text} />
                  </Pressable>
                </View>

                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  {/* Sport Filter */}
                  <Text style={[styles.filterSectionTitle, { color: theme.text }]}>Sport Type</Text>
                  {sportTypes.map((sport) => (
                    <Pressable
                      key={sport.value}
                      style={[
                        styles.sportOption,
                        selectedSport === sport.value && { backgroundColor: `${YELLOW}20` },
                      ]}
                      onPress={() => setSelectedSport(sport.value)}
                    >
                      <View style={styles.sportOptionLeft}>
                        <View
                          style={[
                            styles.sportIconContainer,
                            {
                              backgroundColor:
                                selectedSport === sport.value
                                  ? YELLOW
                                  : isDark
                                    ? '#2a2a2a'
                                    : '#f0f0f0',
                            },
                          ]}
                        >
                          <Ionicons
                            name={(SPORT_ICONS[sport.value] as any) || 'globe'}
                            size={18}
                            color={selectedSport === sport.value ? DARK : theme.textSecondary}
                          />
                        </View>
                        <Text
                          style={[
                            styles.sportOptionText,
                            {
                              color: theme.text,
                              fontWeight: selectedSport === sport.value ? '600' : '500',
                            },
                          ]}
                        >
                          {sport.label}
                        </Text>
                      </View>
                      {selectedSport === sport.value && (
                        <Ionicons name="checkmark-circle" size={22} color={YELLOW} />
                      )}
                    </Pressable>
                  ))}

                  {/* Category Filter */}
                  <Text style={[styles.filterSectionTitle, { color: theme.text, marginTop: 20 }]}>
                    Category
                  </Text>
                  {spotCategories.map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[
                        styles.sportOption,
                        selectedCategory === cat.id && { backgroundColor: `${YELLOW}20` },
                      ]}
                      onPress={() => setSelectedCategory(cat.id)}
                    >
                      <View style={styles.sportOptionLeft}>
                        <View
                          style={[
                            styles.sportIconContainer,
                            {
                              backgroundColor:
                                selectedCategory === cat.id
                                  ? YELLOW
                                  : isDark
                                    ? '#2a2a2a'
                                    : '#f0f0f0',
                            },
                          ]}
                        >
                          <Ionicons
                            name={cat.icon as any}
                            size={18}
                            color={selectedCategory === cat.id ? DARK : theme.textSecondary}
                          />
                        </View>
                        <Text
                          style={[
                            styles.sportOptionText,
                            {
                              color: theme.text,
                              fontWeight: selectedCategory === cat.id ? '600' : '500',
                            },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </View>
                      {selectedCategory === cat.id && (
                        <Ionicons name="checkmark-circle" size={22} color={YELLOW} />
                      )}
                    </Pressable>
                  ))}

                  {/* Apply Button */}
                  <Pressable
                    style={[styles.applyFilterButton, { backgroundColor: YELLOW }]}
                    onPress={() => setFilterModalVisible(false)}
                  >
                    <Text style={styles.applyFilterButtonText}>Apply Filters</Text>
                  </Pressable>
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      ) : (
        // My Spots Tab
        <>
          {/* Sub-view toggle: flat Spots (authored + saved) vs. Collections. */}
          <View style={styles.mySpotsSwitch}>
            <Pressable
              style={[
                styles.mySpotsSwitchButton,
                mySpotsView === 'spots' && { backgroundColor: `${YELLOW}25` },
              ]}
              onPress={() => setMySpotsView('spots')}
            >
              <Ionicons
                name="location"
                size={16}
                color={mySpotsView === 'spots' ? (isDark ? YELLOW : DARK) : theme.textSecondary}
              />
              <Text
                style={[
                  styles.mySpotsSwitchText,
                  {
                    color: mySpotsView === 'spots' ? (isDark ? YELLOW : DARK) : theme.textSecondary,
                  },
                ]}
              >
                Spots
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.mySpotsSwitchButton,
                mySpotsView === 'collections' && { backgroundColor: `${YELLOW}25` },
              ]}
              onPress={() => setMySpotsView('collections')}
            >
              <Ionicons
                name="albums-outline"
                size={16}
                color={
                  mySpotsView === 'collections' ? (isDark ? YELLOW : DARK) : theme.textSecondary
                }
              />
              <Text
                style={[
                  styles.mySpotsSwitchText,
                  {
                    color:
                      mySpotsView === 'collections'
                        ? isDark
                          ? YELLOW
                          : DARK
                        : theme.textSecondary,
                  },
                ]}
              >
                Collections
              </Text>
            </Pressable>
          </View>

          {mySpotsView === 'spots' ? (
            mySpotsLoading && !mySpotsRefreshing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={YELLOW} />
              </View>
            ) : (
              <FlatList
                data={mySpots}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={mySpotsRefreshing}
                    onRefresh={onMySpotsRefresh}
                    tintColor={YELLOW}
                  />
                }
                ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="location-outline" size={48} color={theme.textSecondary} />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No spots yet</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                      You haven't added or saved any spots yet
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <SpotListCard
                    spot={item}
                    theme={theme}
                    badge={item.mineOrSaved}
                    onPress={() => router.push(`/(tabs)/spots/${item._id}`)}
                  />
                )}
              />
            )
          ) : listsLoading && !listsRefreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={YELLOW} />
            </View>
          ) : (
            <FlatList
              data={myLists}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.myListsContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={listsRefreshing}
                  onRefresh={onListsRefresh}
                  tintColor={YELLOW}
                />
              }
              ListHeaderComponent={
                <Pressable
                  style={[styles.createListButton, { backgroundColor: theme.surface }]}
                  onPress={() => setCreateModalVisible(true)}
                >
                  <View style={[styles.createListIcon, { backgroundColor: `${YELLOW}25` }]}>
                    <Ionicons name="add" size={24} color={YELLOW} />
                  </View>
                  <Text style={[styles.createListText, { color: theme.text }]}>
                    Create New List
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </Pressable>
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="bookmark-outline" size={48} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No spot lists yet</Text>
                  <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                    Create a list to save and organize your favorite spots
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <SpotListCardComponent
                  list={item}
                  onPress={() => router.push(`/(tabs)/spots/list/${item._id}`)}
                />
              )}
            />
          )}

          {/* Create List Modal */}
          <Modal
            visible={createModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setCreateModalVisible(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <Pressable style={styles.modalOverlay} onPress={handleCreateModalBackdropPress}>
                <Pressable
                  style={[styles.modalContent, { backgroundColor: theme.surface }]}
                  onPress={(e) => e.stopPropagation()}
                >
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: theme.text }]}>Create Spot List</Text>
                    <Pressable onPress={() => setCreateModalVisible(false)}>
                      <Ionicons name="close" size={24} color={theme.text} />
                    </Pressable>
                  </View>

                  <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={styles.createModalBody}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>List Name</Text>
                      <TextInput
                        style={[
                          styles.createInput,
                          {
                            backgroundColor: theme.background,
                            color: theme.text,
                            borderColor: theme.border,
                          },
                        ]}
                        placeholder="e.g., My Favorite Skate Spots"
                        placeholderTextColor={theme.textSecondary}
                        value={newListName}
                        onChangeText={setNewListName}
                        autoFocus
                      />

                      <Text style={[styles.inputLabel, { color: theme.text, marginTop: 16 }]}>
                        Description (optional)
                      </Text>
                      <TextInput
                        style={[
                          styles.createInput,
                          styles.createInputMultiline,
                          {
                            backgroundColor: theme.background,
                            color: theme.text,
                            borderColor: theme.border,
                          },
                        ]}
                        placeholder="Add a description for this list..."
                        placeholderTextColor={theme.textSecondary}
                        value={newListDescription}
                        onChangeText={setNewListDescription}
                        multiline
                        numberOfLines={3}
                      />

                      <Pressable
                        style={[
                          styles.createSubmitButton,
                          { backgroundColor: YELLOW },
                          (!newListName.trim() || creating) && styles.createSubmitButtonDisabled,
                        ]}
                        onPress={handleCreateList}
                        disabled={!newListName.trim() || creating}
                      >
                        {creating ? (
                          <ActivityIndicator size="small" color={DARK} />
                        ) : (
                          <Text style={styles.createSubmitButtonText}>Create List</Text>
                        )}
                      </Pressable>
                    </View>
                  </ScrollView>
                </Pressable>
              </Pressable>
            </KeyboardAvoidingView>
          </Modal>
        </>
      )}

      {/* Named-list picker (opened via long-press on a save/bookmark control).
          Mounted once at screen level and controlled by spotForListModal. */}
      <AddToSpotListModal
        visible={spotForListModal !== null}
        spotId={spotForListModal?._id ?? ''}
        spotName={spotForListModal?.name ?? ''}
        onClose={() => setSpotForListModal(null)}
        onSuccess={() => {
          // The picker may have added the spot to the default Saved bucket.
          if (spotForListModal) {
            const id = spotForListModal._id;
            setSavedSpotIds((prev) => {
              if (prev.has(id)) return prev;
              const next = new Set(prev);
              next.add(id);
              return next;
            });
          }
        }}
      />
    </SafeAreaView>
  );
}

// Map Card Component
interface SpotMapCardProps {
  spot: Spot;
  theme: any;
  saved?: boolean;
  onPress: () => void;
  /** Tap the bookmark: one-tap save/unsave. */
  onToggleSave?: () => void;
  /** Long-press the bookmark: open the named-list picker. */
  onOpenListPicker?: () => void;
}

function SpotMapCard({
  spot,
  theme,
  saved,
  onPress,
  onToggleSave,
  onOpenListPicker,
}: SpotMapCardProps) {
  const address = [spot.city, spot.state].filter(Boolean).join(', ');

  return (
    <Pressable style={[styles.mapCard, { backgroundColor: theme.surface }]} onPress={onPress}>
      {spot.imageURL ? (
        <Image source={{ uri: spot.imageURL }} style={styles.mapCardImage} />
      ) : (
        <View
          style={[
            styles.mapCardImagePlaceholder,
            { backgroundColor: theme.surfaceElevated || theme.border },
          ]}
        >
          <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.mapCardContent}>
        <Text style={[styles.mapCardName, { color: theme.text }]} numberOfLines={1}>
          {spot.name}
        </Text>
        {address ? (
          <Text style={[styles.mapCardAddress, { color: theme.textSecondary }]} numberOfLines={1}>
            {address}
          </Text>
        ) : null}
        <View style={styles.mapCardMeta}>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={14} color={YELLOW} />
            <Text style={[styles.ratingText, { color: theme.text }]}>
              {spot.rating?.toFixed(1) || 'N/A'}
            </Text>
          </View>
          <View style={styles.mapCardActions}>
            <Pressable
              style={[
                styles.addToListButton,
                { borderColor: saved ? YELLOW : theme.border },
                saved && { backgroundColor: `${YELLOW}25` },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onToggleSave?.();
              }}
              onLongPress={(e) => {
                e.stopPropagation();
                onOpenListPicker?.();
              }}
              delayLongPress={300}
              hitSlop={6}
            >
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={16}
                color={saved ? YELLOW : theme.text}
              />
            </Pressable>
            <Pressable style={[styles.viewButton, { backgroundColor: YELLOW }]} onPress={onPress}>
              <Text style={styles.viewButtonText}>View</Text>
              <Ionicons name="chevron-forward" size={14} color={DARK} />
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// List Card Component
interface SpotListCardProps {
  spot: Spot;
  theme: any;
  /** Optional "Mine"/"Saved" badge shown on the image (My Spots flat list). */
  badge?: MySpotBadge;
  onPress: () => void;
}

function SpotListCard({ spot, theme, badge, onPress }: SpotListCardProps) {
  const address = [spot.city, spot.state].filter(Boolean).join(', ') || 'Unknown location';

  return (
    <Pressable style={[styles.listCard, { backgroundColor: theme.surface }]} onPress={onPress}>
      {/* Image */}
      <View>
        {spot.imageURL ? (
          <Image source={{ uri: spot.imageURL }} style={styles.listCardImage} />
        ) : (
          <View
            style={[
              styles.listCardImagePlaceholder,
              { backgroundColor: theme.surfaceElevated || theme.border },
            ]}
          >
            <Ionicons name="image-outline" size={32} color={theme.textSecondary} />
          </View>
        )}
        {badge && (
          <View style={styles.cardBadge}>
            <Ionicons name={badge === 'Mine' ? 'create' : 'bookmark'} size={10} color={DARK} />
            <Text style={styles.cardBadgeText}>{badge}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.listCardContent}>
        <Text style={[styles.listCardName, { color: theme.text }]} numberOfLines={1}>
          {spot.name}
        </Text>
        <Text style={[styles.listCardAddress, { color: theme.textSecondary }]} numberOfLines={1}>
          {address}
        </Text>

        {/* Meta row */}
        <View style={styles.listCardMeta}>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={14} color={YELLOW} />
            <Text style={[styles.listCardRating, { color: theme.text }]}>
              {spot.rating?.toFixed(1) || 'N/A'}
            </Text>
            {spot.reviewCount && (
              <Text style={[styles.listCardReviews, { color: theme.textSecondary }]}>
                ({spot.reviewCount})
              </Text>
            )}
          </View>
          {spot.distance && (
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.distanceText, { color: theme.textSecondary }]}>
                {spot.distance.toFixed(1)} mi
              </Text>
            </View>
          )}
        </View>

        {/* Sport tags - yellow bg tint with dark text per theme policy */}
        {spot.sportTypes && spot.sportTypes.length > 0 && (
          <View style={styles.sportTags}>
            {spot.sportTypes.slice(0, 2).map((sport) => (
              <View key={sport} style={[styles.sportTag, { backgroundColor: `${YELLOW}25` }]}>
                <Text style={[styles.sportTagText, { color: theme.text }]}>
                  {sport.charAt(0).toUpperCase() + sport.slice(1)}
                </Text>
              </View>
            ))}
            {spot.sportTypes.length > 2 && (
              <Text style={[styles.moreText, { color: theme.textSecondary }]}>
                +{spot.sportTypes.length - 2}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Chevron */}
      <View style={styles.listCardChevron}>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterText: {
    fontSize: 15,
    fontWeight: '500',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab Toggle
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 4,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },

  // Filters
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    marginBottom: 16,
  },
  viewToggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    marginRight: 12,
  },
  viewToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewToggleActive: {},
  categoriesScroll: {
    paddingRight: 20,
    gap: 8,
  },
  categoryPill: {
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

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Map View
  mapContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapContainerFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    zIndex: 100,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  mapSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  mapControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    gap: 10,
  },
  mapControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#B8A800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  overlayMarker: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    padding: 4,
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPoint: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -3,
  },
  clusterBubble: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: YELLOW,
    borderWidth: 2,
    borderColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterText: {
    color: DARK,
    fontWeight: '700',
    fontSize: 14,
  },
  mapSpotsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  mapSpotsScroll: {
    gap: 12,
  },

  // Map Card
  mapCard: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  mapCardImage: {
    width: 100,
    height: 100,
  },
  mapCardImagePlaceholder: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  mapCardName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  mapCardAddress: {
    fontSize: 13,
    marginBottom: 8,
  },
  mapCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addToListButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 2,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
  },

  // List View
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  listSeparator: {
    height: 12,
  },

  // List Card
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
  },
  listCardImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  listCardImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCardContent: {
    flex: 1,
    marginLeft: 14,
  },
  listCardName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listCardAddress: {
    fontSize: 13,
    marginBottom: 8,
  },
  listCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  listCardRating: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  listCardReviews: {
    fontSize: 13,
    marginLeft: 2,
  },
  listCardChevron: {
    paddingLeft: 8,
  },
  sportTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  sportTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sportTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  moreText: {
    fontSize: 12,
    marginLeft: 4,
  },

  // Shared
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 13,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
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
  sportOptionSelected: {},
  sportOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sportIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Filter Modal
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  applyFilterButton: {
    marginTop: 24,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyFilterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK,
  },

  // My Spots sub-view switch (Spots | Collections)
  mySpotsSwitch: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  mySpotsSwitchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mySpotsSwitchText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Mine / Saved badge on spot card image
  cardBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: YELLOW,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: DARK,
  },

  // My Spots List
  myListsContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  createListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  createListIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  createListText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },

  // Create List Modal
  createModalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  createInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  createInputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  createSubmitButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  createSubmitButtonDisabled: {
    opacity: 0.5,
  },
  createSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK,
  },
});
