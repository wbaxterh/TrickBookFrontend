import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getTrickNetwork } from '../api/trickipedia';
import colors from '../config/colors';

function RelationGroup({ title, edges, navigation }) {
  if (!edges?.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      {edges.map((edge) => (
        <Pressable
          key={edge.trick._id}
          style={styles.relation}
          accessibilityRole="button"
          accessibilityLabel={`${edge.trick.name}. ${edge.reason}`}
          onPress={() => navigation.push('Trickipedia Lesson', { trick: edge.trick })}
        >
          <Text style={styles.relationTitle}>{edge.trick.name}</Text>
          <Text style={styles.body}>{edge.reason}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function TrickipediaDetailScreen({ route, navigation }) {
  const { trick } = route.params;
  const [network, setNetwork] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrickNetwork(trick._id).then((response) => {
      if (response.ok) setNetwork(response.data);
      setLoading(false);
    });
  }, [trick._id]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{trick.category} · {trick.difficulty}</Text>
      <Text style={styles.title}>{trick.name}</Text>
      <Text style={styles.lead}>{trick.description}</Text>

      {network?.featuredTutorial ? (
        <View style={styles.tutorial}>
          <Text style={styles.eyebrow}>FEATURED LESSON</Text>
          <Text style={styles.heading}>{network.featuredTutorial.title}</Text>
          <Text style={styles.body}>
            {network.featuredTutorial.instructor?.name || network.featuredTutorial.publisher?.name}
          </Text>
          <Pressable
            style={styles.primaryButton}
            accessibilityRole="link"
            onPress={() => Linking.openURL(network.featuredTutorial.canonicalUrl)}
          >
            <Text style={styles.primaryButtonText}>Watch with credit</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.heading}>How to do it</Text>
        {(trick.steps || []).map((step, index) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      <RelationGroup title="Learn these first" edges={network?.foundations} navigation={navigation} />
      <RelationGroup title="Try next" edges={network?.nextSteps} navigation={navigation} />
      <RelationGroup title="Related variations" edges={network?.related} navigation={navigation} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  content: { padding: 20, paddingBottom: 48 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 34, fontWeight: '900', marginTop: 6 },
  lead: { color: colors.light, fontSize: 17, lineHeight: 26, marginTop: 12 },
  section: { marginTop: 28 },
  heading: { color: colors.white, fontSize: 21, fontWeight: '800', marginBottom: 12 },
  body: { color: colors.light, lineHeight: 21, marginTop: 5 },
  tutorial: { backgroundColor: colors.secondary, borderColor: colors.primary, borderRadius: 16, borderWidth: 1, marginTop: 24, padding: 18 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 10, marginTop: 16, padding: 13 },
  primaryButtonText: { color: colors.black, fontWeight: '900' },
  step: { alignItems: 'flex-start', flexDirection: 'row', marginBottom: 14 },
  stepNumber: { backgroundColor: colors.primary, borderRadius: 12, color: colors.black, fontWeight: '900', marginRight: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  stepText: { color: colors.light, flex: 1, fontSize: 16, lineHeight: 23 },
  relation: { backgroundColor: colors.secondary, borderRadius: 13, marginBottom: 10, padding: 15 },
  relationTitle: { color: colors.white, fontSize: 17, fontWeight: '800' },
});

