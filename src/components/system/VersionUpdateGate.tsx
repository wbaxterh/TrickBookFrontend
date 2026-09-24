import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { sendClientHeartbeat, track, type UpdatePolicy } from '@/lib/analytics';

const DISMISSED_KEY = 'versionUpdate.dismissedRevision';

export function VersionUpdateGate({ safeToPrompt }: { safeToPrompt: boolean }) {
  const [policy, setPolicy] = useState<UpdatePolicy | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRefreshTick((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!safeToPrompt) return;
    // A foreground transition increments this value and intentionally re-checks policy.
    if (refreshTick < 0) return;
    let active = true;
    sendClientHeartbeat().then(async (nextPolicy) => {
      if (!active || !nextPolicy || nextPolicy.status === 'current') return;
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY);
      if (
        nextPolicy.status === 'optional' &&
        dismissed === String(nextPolicy.policyRevision || 0)
      ) {
        return;
      }
      setPolicy(nextPolicy);
      track('update_prompt_seen', {
        status: nextPolicy.status,
        policy_revision: nextPolicy.policyRevision || 0,
      });
    });
    return () => {
      active = false;
    };
  }, [safeToPrompt, refreshTick]);

  if (!policy || !safeToPrompt) return null;
  const required = policy.status === 'required';

  const update = async () => {
    await track('update_store_opened', {
      status: policy.status,
      policy_revision: policy.policyRevision || 0,
    });
    if (policy.storeUrl) await Linking.openURL(policy.storeUrl);
  };

  const dismiss = async () => {
    if (required) return;
    await AsyncStorage.setItem(DISMISSED_KEY, String(policy.policyRevision || 0));
    await track('update_prompt_dismissed', { policy_revision: policy.policyRevision || 0 });
    setPolicy(null);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{policy.title || 'Update TrickBook'}</Text>
          <Text style={styles.message}>
            {policy.message || 'A newer version is available with important improvements.'}
          </Text>
          <Pressable style={styles.primaryButton} onPress={update} accessibilityRole="button">
            <Text style={styles.primaryText}>Update now</Text>
          </Pressable>
          {!required && (
            <Pressable style={styles.secondaryButton} onPress={dismiss} accessibilityRole="button">
              <Text style={styles.secondaryText}>Not now</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  card: { width: '100%', maxWidth: 420, borderRadius: 20, padding: 24, backgroundColor: '#181818' },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 10 },
  message: { color: '#d6d6d6', fontSize: 16, lineHeight: 23, marginBottom: 22 },
  primaryButton: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  primaryText: { color: '#111', fontSize: 16, fontWeight: '800' },
  secondaryButton: { padding: 14, alignItems: 'center' },
  secondaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
