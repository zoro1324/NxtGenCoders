import { Image } from "expo-image";
import { Link } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useColorScheme,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";

type Report = {
  id: number;
  name: string;
  time?: string;
  title: string;
  image_url?: string;
  body: string;
  comments: number;
  likes: number;
  shares: number;
  created_at?: string;
};

export default function HomeScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usedBase, setUsedBase] = useState<string | null>(null);
  const [triedBases, setTriedBases] = useState<string[]>([]);

  const apiCandidates = useMemo(() => {
    const list: string[] = [];
    const publicEnv = (typeof process !== "undefined" && (process as any)?.env?.EXPO_PUBLIC_API_URL)
      ? (process as any).env.EXPO_PUBLIC_API_URL as string
      : undefined;
    if (publicEnv) return [publicEnv.replace(/\/$/, "")];

    const hostUri: string | undefined = (Constants as any)?.expoConfig?.hostUri || (Constants as any)?.debuggerHost;
    const host = typeof hostUri === "string" ? hostUri.split(":" )[0] : undefined;
    const isIPv4 = host ? /^\d+\.\d+\.\d+\.\d+$/.test(host) : false;

    if (Platform.OS === "android") {
      // Prefer emulator alias first
      list.push("http://10.0.2.2:8000");
      if (isIPv4) list.push(`http://${host}:8000`);
      list.push("http://127.0.0.1:8000");
    } else {
      if (isIPv4) list.push(`http://${host}:8000`);
      list.push("http://127.0.0.1:8000");
    }
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        let lastErr: any = null;
        const attempts: string[] = [];
        for (const base of apiCandidates) {
          attempts.push(base);
          try {
            const url = `${base}/api/reports/`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const items: Report[] = (data.results ?? data) as Report[];
            if (!cancelled) {
              setReports(items);
              setError(null);
              setUsedBase(base);
              setTriedBases(attempts);
            }
            return; // success
          } catch (e) {
            lastErr = e;
            // try next candidate
          }
        }
        // if all candidates failed
        if (!cancelled) {
          setError(lastErr?.message ?? "Failed to load");
          setUsedBase(null);
          setTriedBases(attempts);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [apiCandidates]);

  function formatTime(iso?: string) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const sec = Math.max(1, Math.floor(diffMs / 1000));
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const day = Math.floor(hr / 24);
      if (day < 7) return `${day}d ago`;
      return d.toLocaleDateString();
    } catch {
      return "";
    }
  }

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
        {loading && (
          <Text style={{ paddingHorizontal: 16, color: isDark ? "#C9D2DC" : "#6B7280" }}>Loading…</Text>
        )}
        {!!error && !loading && (
          <Text style={{ paddingHorizontal: 16, color: "#DC2626" }}>
            Error: {error}{"\n"}
            {triedBases.length > 0 ? `Tried: ${triedBases.join(', ')}` : ''}
          </Text>
        )}
        {!loading && !error && reports.length === 0 && (
          <Text style={{ paddingHorizontal: 16, color: isDark ? "#C9D2DC" : "#6B7280" }}>No reports yet.</Text>
        )}
        {!loading && !error && reports.map((r) => (
          <View key={r.id} style={[styles.card, isDark && { backgroundColor: "#14161A", borderColor: "#1F2430" }]}>
            <View style={styles.cardHeader}>
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop" }}
                style={styles.userAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, isDark && { color: "#E6EAF2" }]}>{r.name}</Text>
                <Text style={styles.timeText}>{r.time ?? formatTime(r.created_at)}</Text>
              </View>
              <Ionicons name="ellipsis-horizontal" size={20} color={isDark ? "#9BA7B4" : "#6B7280"} />
            </View>

            <Text style={[styles.cardTitle, isDark && { color: "#E6EAF2" }]}>{r.title}</Text>
            {!!r.image_url && <Image source={{ uri: r.image_url }} style={styles.cardImage} contentFit="cover" />}
            {!!r.body && <Text style={[styles.cardBody, isDark && { color: "#C9D2DC" }]}>{r.body}</Text>}

            <View style={styles.cardFooter}>
              <View style={styles.footerItem}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#6B7280" />
                <Text style={styles.footerText}>{r.comments ?? 0}</Text>
              </View>
              <View style={styles.footerItem}>
                <Ionicons name="thumbs-up-outline" size={18} color="#6B7280" />
                <Text style={styles.footerText}>{r.likes ?? 0}</Text>
              </View>
              <View style={styles.footerItem}>
                <Ionicons name="arrow-redo-outline" size={18} color="#6B7280" />
                <Text style={styles.footerText}>{r.shares ?? 0}</Text>
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
