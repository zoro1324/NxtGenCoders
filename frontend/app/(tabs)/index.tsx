import { Image } from "expo-image";
import { Link } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const demoReports = [
  {
    id: "1",
    name: "Alex Chen",
    time: "2 hours ago",
    title: "Pothole on Main Street, near City Hall",
    image:
      "https://images.unsplash.com/photo-1519682337058-a94d519337bc?q=80&w=1600&auto=format&fit=crop",
    body:
      "A large and dangerous pothole has developed on Main Street, just east of the City Hall entrance. It's causing disruption to traffic flow.",
    comments: 5,
    likes: 28,
    shares: 3,
  },
  {
    id: "2",
    name: "Maria Rodriguez",
    time: "5 hours ago",
    title: "Broken street light on Oak Avenue",
    image:
      "https://images.unsplash.com/photo-1603052875138-981d558d4f25?q=80&w=1600&auto=format&fit=crop",
    body:
      "The street light on Oak Avenue has been out for three nights. The area is very dark and feels unsafe.",
    comments: 5,
    likes: 15,
    shares: 1,
  },
  {
    id: "3",
    name: "David Lee",
    time: "Yesterday",
    title: "Overflowing public trash can at Central Park",
    image:
      "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?q=80&w=1600&auto=format&fit=crop",
    body:
      "The trash can near the playground at Central Park is overflowing. It's becoming an eyesore and a health concern.",
    comments: 5,
    likes: 42,
    shares: 5,
  },
];

export default function HomeScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return (
    <ScrollView style={[styles.container, isDark && { backgroundColor: "#0B0B0D" }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.appTitle, isDark && { color: "#A5D6FF" }]}>Smart City</Text>
          <Text style={[styles.appSubtitle, isDark && { color: "#E5F3FF" }]}>Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.avatarWrap} activeOpacity={0.8}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?q=80&w=400&auto=format&fit=crop",
            }}
            style={styles.avatar}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <Link href="/(tabs)/reports" asChild>
          <TouchableOpacity style={[styles.cta, styles.ctaPrimary]}>
            <Ionicons name="document-text-outline" size={22} color="#fff" />
            <Text style={styles.ctaText}>My Reports</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/(tabs)/issues" asChild>
          <TouchableOpacity style={[styles.cta, styles.ctaSecondary]}>
            <Ionicons name="megaphone-outline" size={22} color="#fff" />
            <Text style={styles.ctaText}>Report an Issue</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <Text style={[styles.sectionTitle, isDark && { color: "#E6EAF2" }]}>Community Reports</Text>

      <View style={styles.list}>
        {demoReports.map((r) => (
          <View key={r.id} style={[styles.card, isDark && { backgroundColor: "#14161A", borderColor: "#1F2430" }]}>
            <View style={styles.cardHeader}>
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop" }}
                style={styles.userAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, isDark && { color: "#E6EAF2" }]}>{r.name}</Text>
                <Text style={styles.timeText}>{r.time}</Text>
              </View>
              <Ionicons name="ellipsis-horizontal" size={20} color={isDark ? "#9BA7B4" : "#6B7280"} />
            </View>

            <Text style={[styles.cardTitle, isDark && { color: "#E6EAF2" }]}>{r.title}</Text>
            <Image source={{ uri: r.image }} style={styles.cardImage} contentFit="cover" />
            <Text style={[styles.cardBody, isDark && { color: "#C9D2DC" }]}>{r.body}</Text>

            <View style={styles.cardFooter}>
              <View style={styles.footerItem}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#6B7280" />
                <Text style={styles.footerText}>{r.comments}</Text>
              </View>
              <View style={styles.footerItem}>
                <Ionicons name="thumbs-up-outline" size={18} color="#6B7280" />
                <Text style={styles.footerText}>{r.likes}</Text>
              </View>
              <View style={styles.footerItem}>
                <Ionicons name="arrow-redo-outline" size={18} color="#6B7280" />
                <Text style={styles.footerText}>{r.shares}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F8FB" },
  header: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appTitle: { fontSize: 20, fontWeight: "800", color: "#0A66C2" },
  appSubtitle: { fontSize: 18, fontWeight: "700", color: "#2B7FFF" },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatar: { width: "100%", height: "100%" },
  actions: { paddingHorizontal: 20, gap: 12 },
  cta: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  ctaPrimary: { backgroundColor: "#0EA5E9" },
  ctaSecondary: { backgroundColor: "#2563EB" },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  sectionTitle: {
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  userAvatar: { width: 28, height: 28, borderRadius: 14 },
  userName: { fontWeight: "700", color: "#111827" },
  timeText: { color: "#6B7280", fontSize: 12 },
  cardTitle: { marginTop: 8, fontWeight: "700", fontSize: 15, color: "#111827" },
  cardImage: { marginTop: 10, width: "100%", height: 180, borderRadius: 12 },
  cardBody: { marginTop: 10, color: "#374151", lineHeight: 20 },
  cardFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerText: { color: "#6B7280", fontWeight: "600" },
});
