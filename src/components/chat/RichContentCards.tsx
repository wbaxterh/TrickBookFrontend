/**
 * Rich Content Cards for Bot Chat
 * Renders interactive cards (spots, tricks, tricklists) in chat messages
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RichContent } from '@/lib/api/messages';

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';
const MAX_CARD_WIDTH = 280;

// --- Individual Card Components ---

function SpotCard({
  data,
  onPress,
}: {
  data: {
    _id: string;
    name: string;
    imageUrl?: string;
    rating?: number;
    reviewCount?: number;
    category?: string;
    address?: string;
  };
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {data.imageUrl ? (
        <Image source={{ uri: data.imageUrl }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.imagePlaceholder]}>
          <Ionicons name="location" size={32} color="#666" />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {data.name}
        </Text>
        {data.address && (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {data.address}
          </Text>
        )}
        <View style={styles.cardMeta}>
          {data.rating != null && (
            <View style={styles.metaItem}>
              <Text style={styles.metaText}>⭐ {data.rating.toFixed(1)}</Text>
              {data.reviewCount != null && (
                <Text style={styles.metaTextSecondary}>({data.reviewCount})</Text>
              )}
            </View>
          )}
          {data.category && (
            <View style={[styles.badge, styles.categoryBadge]}>
              <Text style={styles.badgeText}>{data.category}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function SpotsListCard({
  data,
  onPress,
}: {
  data: {
    spots: Array<{
      _id: string;
      name: string;
      imageUrl?: string;
      rating?: number;
      category?: string;
    }>;
    title?: string;
  };
  onPress: (spotId: string) => void;
}) {
  return (
    <View style={styles.card}>
      {data.title && (
        <View style={styles.listHeader}>
          <Ionicons name="location" size={16} color={YELLOW} />
          <Text style={styles.listTitle}>{data.title}</Text>
        </View>
      )}
      {data.spots.slice(0, 3).map((spot, index) => (
        <Pressable
          key={spot._id}
          style={[styles.listItem, index > 0 && styles.listItemBorder]}
          onPress={() => onPress(spot._id)}
        >
          {spot.imageUrl ? (
            <Image source={{ uri: spot.imageUrl }} style={styles.listItemImage} />
          ) : (
            <View style={[styles.listItemImage, styles.imagePlaceholder]}>
              <Ionicons name="location" size={16} color="#666" />
            </View>
          )}
          <View style={styles.listItemInfo}>
            <Text style={styles.listItemName} numberOfLines={1}>
              {spot.name}
            </Text>
            <View style={styles.cardMeta}>
              {spot.rating != null && (
                <Text style={styles.metaTextSmall}>⭐ {spot.rating.toFixed(1)}</Text>
              )}
              {spot.category && <Text style={styles.metaTextSecondary}>{spot.category}</Text>}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#666" />
        </Pressable>
      ))}
      {data.spots.length > 3 && <Text style={styles.moreText}>+{data.spots.length - 3} more</Text>}
    </View>
  );
}

function TrickListCard({
  data,
  onPress,
}: {
  data: {
    _id: string;
    name: string;
    trickCount?: number;
    progress?: number;
    difficulty?: string;
  };
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="list" size={20} color={YELLOW} />
          <Text style={styles.cardTitle} numberOfLines={1}>
            {data.name}
          </Text>
        </View>
        <View style={styles.cardMeta}>
          {data.trickCount != null && <Text style={styles.metaText}>{data.trickCount} tricks</Text>}
          {data.difficulty && (
            <View style={[styles.badge, getDifficultyStyle(data.difficulty)]}>
              <Text style={styles.badgeText}>{data.difficulty}</Text>
            </View>
          )}
        </View>
        {data.progress != null && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${data.progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(data.progress)}%</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function TrickCard({
  data,
  onPress,
}: {
  data: {
    _id: string;
    name: string;
    difficulty?: string;
    imageUrl?: string;
    description?: string;
  };
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {data.imageUrl && <Image source={{ uri: data.imageUrl }} style={styles.cardImageSmall} />}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {data.name}
        </Text>
        {data.difficulty && (
          <View style={[styles.badge, getDifficultyStyle(data.difficulty)]}>
            <Text style={styles.badgeText}>{data.difficulty}</Text>
          </View>
        )}
        {data.description && (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {data.description}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function SpotDraftCard({
  data,
}: {
  data: {
    name: string;
    category?: string;
    address?: string;
    status?: string;
  };
}) {
  return (
    <View style={[styles.card, styles.confirmationCard]}>
      <View style={styles.confirmationHeader}>
        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
        <Text style={styles.confirmationTitle}>Spot Draft Created</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {data.name}
        </Text>
        {data.address && (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {data.address}
          </Text>
        )}
        {data.category && (
          <View style={[styles.badge, styles.categoryBadge]}>
            <Text style={styles.badgeText}>{data.category}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// --- Helpers ---

function getDifficultyStyle(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case 'beginner':
      return { backgroundColor: 'rgba(76, 175, 80, 0.2)' };
    case 'intermediate':
      return { backgroundColor: 'rgba(252, 241, 80, 0.2)' };
    case 'advanced':
      return { backgroundColor: 'rgba(244, 67, 54, 0.2)' };
    case 'expert':
      return { backgroundColor: 'rgba(156, 39, 176, 0.2)' };
    default:
      return {};
  }
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case 'beginner':
      return '#4CAF50';
    case 'intermediate':
      return '#FCF150';
    case 'advanced':
      return '#F44336';
    case 'expert':
      return '#9C27B0';
    default:
      return '#999';
  }
}

// --- Main Component ---

export function RichContentCard({ richContent }: { richContent: RichContent }) {
  const handleNavigate = (type: string, id: string) => {
    switch (type) {
      case 'spot':
        router.push(`/(tabs)/spots/${id}`);
        break;
      case 'tricklist':
        router.push(`/(tabs)/trickbook/list/${id}`);
        break;
      case 'trick':
        router.push('/(tabs)/trickbook');
        break;
    }
  };

  switch (richContent.type) {
    case 'spot_card':
      return (
        <SpotCard
          data={richContent.data}
          onPress={() => handleNavigate('spot', richContent.data._id)}
        />
      );
    case 'spots_list':
      return (
        <SpotsListCard
          data={richContent.data}
          onPress={(spotId) => handleNavigate('spot', spotId)}
        />
      );
    case 'tricklist_card':
      return (
        <TrickListCard
          data={richContent.data}
          onPress={() => handleNavigate('tricklist', richContent.data._id)}
        />
      );
    case 'trick_card':
      return (
        <TrickCard
          data={richContent.data}
          onPress={() => handleNavigate('trick', richContent.data._id)}
        />
      );
    case 'spot_draft_confirmation':
      return <SpotDraftCard data={richContent.data} />;
    default:
      return null;
  }
}

// --- Styles ---

const styles = StyleSheet.create({
  card: {
    maxWidth: MAX_CARD_WIDTH,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 6,
  },
  cardImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#333',
  },
  cardImageSmall: {
    width: '100%',
    height: 100,
    backgroundColor: '#333',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
  },
  cardBody: {
    padding: 12,
    gap: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    flexShrink: 1,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#AAA',
  },
  cardDescription: {
    fontSize: 13,
    color: '#AAA',
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#CCC',
  },
  metaTextSmall: {
    fontSize: 12,
    color: '#CCC',
  },
  metaTextSecondary: {
    fontSize: 12,
    color: '#999',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryBadge: {
    backgroundColor: 'rgba(252, 241, 80, 0.15)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: YELLOW,
    textTransform: 'capitalize',
  },
  // List styles
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    paddingBottom: 8,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  listItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#444',
  },
  listItemImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  listItemInfo: {
    flex: 1,
    gap: 2,
  },
  listItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFF',
  },
  moreText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Progress bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: YELLOW,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: YELLOW,
  },
  // Confirmation card
  confirmationCard: {
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  confirmationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  confirmationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
});
