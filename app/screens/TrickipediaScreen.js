import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getTrickipedia } from '../api/trickipedia';
import colors from '../config/colors';

export default function TrickipediaScreen({ navigation }) {
  const [tricks, setTricks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTrickipedia().then((response) => {
      if (response.ok) setTricks(response.data || []);
      else setError('Trickipedia could not load. Check your connection and try again.');
      setLoading(false);
    });
  }, []);

  if (loading) return <ActivityIndicator style={styles.center} color={colors.primary} size="large" />;

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>LEARN · RIDE · PROGRESS</Text>
      <Text style={styles.title}>What do you want to learn?</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={tricks}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.difficulty}`}
            onPress={() => navigation.navigate('Trickipedia Lesson', { trick: item })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.meta}>{item.category} · {item.difficulty}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark, paddingHorizontal: 18, paddingTop: 20 },
  center: { flex: 1, backgroundColor: colors.dark },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.white, fontSize: 28, fontWeight: '800', marginBottom: 18, marginTop: 6 },
  list: { paddingBottom: 32 },
  card: { alignItems: 'center', backgroundColor: colors.secondary, borderRadius: 14, flexDirection: 'row', marginBottom: 10, padding: 16 },
  pressed: { opacity: 0.72 },
  cardCopy: { flex: 1 },
  cardTitle: { color: colors.white, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.medium, marginTop: 4 },
  arrow: { color: colors.primary, fontSize: 32 },
  error: { color: colors.red, marginBottom: 12 },
});

