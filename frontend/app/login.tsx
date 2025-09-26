import React, { useMemo, useState, useCallback } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const api = useMemo(() => {
    const list: string[] = [];
    const env = (process as any)?.env?.EXPO_PUBLIC_API_URL as string | undefined;
    if (env) list.push(env.replace(/\/$/, ""));
    const hostUri: string | undefined = (Constants as any)?.expoConfig?.hostUri || (Constants as any)?.debuggerHost;
    const host = typeof hostUri === "string" ? hostUri.split(":")[0] : undefined;
    const isIPv4 = host ? /^\d+\.\d+\.\d+\.\d+$/.test(host) : false;
    if (Platform.OS === "android") { list.push("http://10.0.2.2:8000"); if (isIPv4) list.push(`http://${host}:8000`); list.push("http://127.0.0.1:8000"); }
    else { if (isIPv4) list.push(`http://${host}:8000`); list.push("http://127.0.0.1:8000"); }
    return Array.from(new Set(list));
  }, []);

  const submit = useCallback(async () => {
    try {
      if (!username || !password) return Alert.alert("Missing", "Fill both fields");
      setLoading(true);
      let lastErr: any = null;
      for (const base of api) {
        try {
          const res = await fetch(`${base}/api/auth/login/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
          const data = await res.json();
          if (!res.ok) throw new Error(typeof data === 'object' ? JSON.stringify(data) : res.statusText);
          await saveAuth(data.token, data);
          router.replace("/(tabs)");
          return;
        } catch (e) { lastErr = e; }
      }
      throw lastErr ?? new Error("Login failed");
    } catch (e: any) { Alert.alert("Login failed", e?.message ?? ""); } finally { setLoading(false); }
  }, [username, password, api]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log In</Text>
      <TextInput style={styles.input} placeholder="Username" autoCapitalize="none" value={username} onChangeText={setUsername} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={styles.btn} disabled={loading} onPress={submit}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log In</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  input: { width: '100%', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 10 },
  btn: { width: '100%', backgroundColor: '#2563EB', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },
});

async function saveAuth(token: string, profile: any) {
  try {
    const { default: SecureStore } = await import('expo-secure-store');
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_profile', JSON.stringify(profile));
  } catch {}
}
