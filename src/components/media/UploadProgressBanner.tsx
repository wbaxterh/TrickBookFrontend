/**
 * UploadProgressBanner
 * A compact, non-blocking banner shown on the Media tab while a Feed upload runs
 * in the background (via uploadStore). Lets the user browse the feed and watch it
 * finish. Shows progress, a "Posted!" flash, or a failure with Retry.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useUploadStore } from '@/lib/stores/uploadStore';

const YELLOW = '#FCF150';

export function UploadProgressBanner({ topOffset = 0 }: { topOffset?: number }) {
  const job = useUploadStore((s) => s.job);
  const retry = useUploadStore((s) => s.retry);
  const dismiss = useUploadStore((s) => s.dismiss);

  // Auto-dismiss the banner a couple seconds after a successful post (the Feed
  // has already prepended it by then).
  useEffect(() => {
    if (job?.phase === 'done') {
      const t = setTimeout(() => dismiss(), 2500);
      return () => clearTimeout(t);
    }
  }, [job?.phase, dismiss]);

  if (!job) return null;

  const isVideo = job.input.mediaType === 'video';
  const failed = job.phase === 'failed';
  const done = job.phase === 'done';
  const showProgress = job.phase === 'uploading';

  return (
    <View style={[styles.wrap, { top: topOffset }]} pointerEvents="box-none">
      <View style={[styles.banner, failed && styles.bannerFailed, done && styles.bannerDone]}>
        {/* Thumb */}
        <View style={styles.thumb}>
          {!isVideo && job.input.fileUri ? (
            <Image source={{ uri: job.input.fileUri }} style={styles.thumbImg} contentFit="cover" />
          ) : (
            <Ionicons
              name={isVideo ? 'videocam' : 'image'}
              size={20}
              color={done ? '#22c55e' : failed ? '#ef4444' : YELLOW}
            />
          )}
        </View>

        {/* Text + progress */}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {done ? 'Posted!' : failed ? 'Upload failed' : job.statusText}
          </Text>
          {showProgress ? (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(4, job.progress)}%` }]} />
            </View>
          ) : failed ? (
            <Text style={styles.sub} numberOfLines={1}>
              {job.error || 'Please try again.'}
            </Text>
          ) : (
            <Text style={styles.sub} numberOfLines={1}>
              {done ? 'Your clip is on the Feed' : 'Keep scrolling — we’ll finish this up'}
            </Text>
          )}
        </View>

        {/* Trailing control */}
        {failed ? (
          <View style={styles.actions}>
            <Pressable style={styles.retryBtn} onPress={retry} hitSlop={8}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
            <Pressable onPress={dismiss} hitSlop={8}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : done ? (
          <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
        ) : (
          <ActivityIndicator size="small" color={YELLOW} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, zIndex: 200, paddingHorizontal: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(20,20,20,0.96)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bannerFailed: { borderColor: 'rgba(239,68,68,0.5)' },
  bannerDone: { borderColor: 'rgba(34,197,94,0.5)' },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: 40, height: 40 },
  body: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 6,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: YELLOW, borderRadius: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  retryBtn: {
    backgroundColor: YELLOW,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryText: { color: '#1a1a1a', fontWeight: '700', fontSize: 12 },
});
