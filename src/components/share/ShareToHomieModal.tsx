/**
 * ShareToHomieModal
 * Modal for sharing content (tricks, tricklists, spots, videos) with homies via DM
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getMyHomies, type Homie } from '@/lib/api/homies';
import {
  type SharedContent,
  type SharedContentPreview,
  type SharedContentType,
  sendSharedContent,
} from '@/lib/api/messages';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const _YELLOW = '#FCF150';
const DARK = '#1a1a1a';

interface ShareToHomieModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: SharedContentType;
  contentId: string;
  preview: SharedContentPreview;
  onSuccess?: (conversationId: string) => void;
}

export function ShareToHomieModal({
  visible,
  onClose,
  contentType,
  contentId,
  preview,
  onSuccess,
}: ShareToHomieModalProps) {
  const { theme, colors } = useThemeContext();
  const [homies, setHomies] = useState<Homie[]>([]);
  const [filteredHomies, setFilteredHomies] = useState<Homie[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHomie, setSelectedHomie] = useState<Homie | null>(null);
  const [message, setMessage] = useState('');

  // Fetch homies when modal opens
  useEffect(() => {
    if (visible) {
      fetchHomies();
    } else {
      // Reset state when closed
      setSelectedHomie(null);
      setMessage('');
      setSearchQuery('');
    }
  }, [visible]);

  // Filter homies based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = homies.filter((h) =>
        h.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredHomies(filtered);
    } else {
      setFilteredHomies(homies);
    }
  }, [searchQuery, homies]);

  const fetchHomies = async () => {
    setLoading(true);
    try {
      const data = await getMyHomies();
      setHomies(data);
      setFilteredHomies(data);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHomie = (homie: Homie) => {
    setSelectedHomie(homie);
  };

  const handleSend = async () => {
    if (!selectedHomie) return;

    setSending(true);
    try {
      const sharedContent: SharedContent = {
        contentType,
        contentId,
        preview,
      };

      const result = await sendSharedContent(
        selectedHomie._id,
        sharedContent,
        message.trim() || undefined,
      );

      if (result.success) {
        Alert.alert('Sent!', `Shared with ${selectedHomie.name}`, [
          {
            text: 'View Chat',
            onPress: () => {
              onClose();
              if (result.conversationId && onSuccess) {
                onSuccess(result.conversationId);
              }
            },
          },
          {
            text: 'OK',
            onPress: onClose,
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to send. Please try again.');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const getContentTypeIcon = (): string => {
    switch (contentType) {
      case 'tricklist':
        return 'list';
      case 'trick':
        return 'sparkles';
      case 'spot':
        return 'location';
      case 'spotlist':
        return 'bookmark';
      case 'video':
        return 'videocam';
      default:
        return 'share';
    }
  };

  const getContentTypeLabel = (): string => {
    switch (contentType) {
      case 'tricklist':
        return 'TrickList';
      case 'trick':
        return 'Trick';
      case 'spot':
        return 'Spot';
      case 'spotlist':
        return 'SpotList';
      case 'video':
        return 'Video';
      default:
        return 'Content';
    }
  };

  const renderHomieItem = ({ item }: { item: Homie }) => {
    const isSelected = selectedHomie?._id === item._id;

    return (
      <Pressable
        style={[
          styles.homieItem,
          { backgroundColor: isSelected ? `${colors.primary}20` : theme.surface },
          isSelected && { borderColor: colors.primary, borderWidth: 2 },
        ]}
        onPress={() => handleSelectHomie(item)}
      >
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.homieAvatar} />
        ) : (
          <View style={[styles.homieAvatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.homieAvatarEmoji}>🛹</Text>
          </View>
        )}
        <Text style={[styles.homieName, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        {isSelected && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Share to Homie</Text>
              <View style={styles.closeButton} />
            </View>

            {/* Content Preview */}
            <View style={[styles.previewCard, { backgroundColor: theme.surface }]}>
              <View style={[styles.previewIcon, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name={getContentTypeIcon() as any} size={24} color={colors.primary} />
              </View>
              <View style={styles.previewInfo}>
                <Text style={[styles.previewType, { color: theme.textSecondary }]}>
                  {getContentTypeLabel()}
                </Text>
                <Text style={[styles.previewTitle, { color: theme.text }]} numberOfLines={1}>
                  {preview.title}
                </Text>
                {preview.subtitle && (
                  <Text
                    style={[styles.previewSubtitle, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {preview.subtitle}
                  </Text>
                )}
              </View>
              {preview.thumbnailUrl && (
                <Image source={{ uri: preview.thumbnailUrl }} style={styles.previewThumbnail} />
              )}
            </View>

            {/* Search */}
            <View style={[styles.searchContainer, { backgroundColor: theme.surface }]}>
              <Ionicons name="search" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search homies..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Homies List */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : filteredHomies.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {homies.length === 0 ? 'No homies yet' : 'No homies found'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredHomies}
                keyExtractor={(item) => item._id}
                renderItem={renderHomieItem}
                contentContainerStyle={styles.homiesList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            )}

            {/* Optional Message Input */}
            {selectedHomie && (
              <View style={[styles.messageContainer, { borderTopColor: theme.border }]}>
                <TextInput
                  style={[
                    styles.messageInput,
                    { backgroundColor: theme.surface, color: theme.text },
                  ]}
                  placeholder="Add a message (optional)..."
                  placeholderTextColor={theme.textSecondary}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={200}
                />
              </View>
            )}

            {/* Send Button */}
            <View style={styles.footer}>
              <Pressable
                style={[
                  styles.sendButton,
                  { backgroundColor: selectedHomie ? colors.primary : theme.surface },
                ]}
                onPress={handleSend}
                disabled={!selectedHomie || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={DARK} />
                ) : (
                  <>
                    <Ionicons
                      name="send"
                      size={20}
                      color={selectedHomie ? DARK : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.sendButtonText,
                        { color: selectedHomie ? DARK : theme.textSecondary },
                      ]}
                    >
                      {selectedHomie ? `Send to ${selectedHomie.name}` : 'Select a homie'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: {
    flex: 1,
  },
  previewType: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  previewSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  previewThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
  },
  homiesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  homieItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  homieAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  homieAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homieAvatarEmoji: {
    fontSize: 20,
  },
  homieName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  messageContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  messageInput: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    maxHeight: 80,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
