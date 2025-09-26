import React, { useMemo, useState, useCallback } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, ScrollView, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

export default function SignupScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{lat:number; lng:number} | null>(null);
  const [photo, setPhoto] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const apiCandidates = useMemo(() => {
    const list: string[] = [];
    const publicEnv = (typeof process !== "undefined" && (process as any)?.env?.EXPO_PUBLIC_API_URL)
      ? (process as any).env.EXPO_PUBLIC_API_URL as string
      : undefined;
    if (publicEnv) list.push(publicEnv.replace(/\/$/, ""));

    const hostUri: string | undefined = (Constants as any)?.expoConfig?.hostUri || (Constants as any)?.debuggerHost;
    const host = typeof hostUri === "string" ? hostUri.split(":")[0] : undefined;
    const isIPv4 = host ? /^\d+\.\d+\.\d+\.\d+$/.test(host) : false;

    if (Platform.OS === "android") {
      list.push("http://10.0.2.2:8000");
      if (isIPv4) list.push(`http://${host}:8000`);
      list.push("http://127.0.0.1:8000");
    } else {
      if (isIPv4) list.push(`http://${host}:8000`);
      list.push("http://127.0.0.1:8000");
    }
    return Array.from(new Set(list));
  }, []);

  const pickImage = useCallback(async () => {
    const ImagePicker = await import('expo-image-picker');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!res.canceled && res.assets?.length) setPhoto(res.assets[0]);
  }, []);

  const getLocation = useCallback(async () => {
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: 3 });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {}
  }, []);

  const submit = useCallback(async () => {
    try {
      if (!firstName || !lastName || !username || !email || !password || !confirm) {
        Alert.alert("Missing info", "Please fill all required fields.");
        return;
      }
      if (password !== confirm) { Alert.alert('Password', 'Passwords do not match'); return; }
      setLoading(true);
      let lastErr: any = null;
      const attempted: string[] = [];
      let gotServerResponse = false; // track if any base returned an HTTP response (even 4xx)
      for (const base of apiCandidates) {
        try {
          attempted.push(base);
          const hasImage = !!photo;
          let res: Response;
          if (hasImage) {
            const fd = new FormData();
            fd.append('first_name', firstName);
            fd.append('last_name', lastName);
            fd.append('username', username);
            fd.append('email', email);
            fd.append('password', password);
            fd.append('confirm_password', confirm);
            if (phone) fd.append('phone_number', phone);
            if (coords) { fd.append('lat', String(coords.lat)); fd.append('lng', String(coords.lng)); }
            if (photo) {
              // @ts-ignore
              fd.append('avatar', { uri: photo.uri, name: 'profile.jpg', type: photo.mimeType || 'image/jpeg' });
            }
            res = await fetch(`${base}/api/auth/signup/`, { method: 'POST', body: fd as any });
          } else {
            const body: any = { first_name: firstName, last_name: lastName, username, email, password, confirm_password: confirm };
            if (phone) body.phone_number = phone;
            if (coords) { body.lat = coords.lat; body.lng = coords.lng; }
            res = await fetch(`${base}/api/auth/signup/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          }
          // We reached the server; capture that fact so we don't mask server errors with later network failures
          gotServerResponse = true;
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            // Format common DRF error shapes nicely
            let msg = res.statusText;
            if (data && typeof data === 'object') {
              try {
                const parts: string[] = [];
                for (const [k, v] of Object.entries<any>(data)) {
                  if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
                  else if (typeof v === 'string') parts.push(`${k}: ${v}`);
                  else parts.push(`${k}: ${JSON.stringify(v)}`);
                }
                if (parts.length) msg = parts.join('\n');
              } catch {}
            }
            // Stop trying other bases; we got a definitive answer from the server
            throw new Error(msg || 'Signup failed');
          }
          // success
          const data = await res.json();
          await saveAuth(data.token, data);
          Alert.alert("Welcome!", "Your account has been created.");
          router.replace("/(tabs)");
          return;
        } catch (e) {
          lastErr = e;
          if (gotServerResponse) break; // don't try other bases; preserve server error
        }
      }
      if (gotServerResponse && lastErr) throw lastErr;
      const msg = (lastErr && (lastErr as any).message) || 'Network request failed';
      throw new Error(`${msg}\n\nTried: ${attempted.join('\n- ')}`);
    } catch (e: any) {
      Alert.alert("Signup failed", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [firstName, lastName, username, email, password, confirm, phone, coords, photo, apiCandidates, router]);

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={{ flex: 1 }}>
      <LinearGradient colors={["#F5E0DE", "#D0C7A8"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.titleTop}>Create Account</Text>
          <Text style={styles.subtitle}>Sign Up Today</Text>
          <Text style={styles.caption}>Join our community and discover a world of possibilities.</Text>

          <View style={styles.row}>
            <View style={[styles.inputWrap, { flex: 1, marginRight: 8 }]}> 
              <Ionicons name="person-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput placeholder="First Name" value={firstName} onChangeText={setFirstName} style={styles.input} placeholderTextColor="#9CA3AF" />
            </View>
            <View style={[styles.inputWrap, { flex: 1, marginLeft: 8 }]}> 
              <Ionicons name="person-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput placeholder="Last Name" value={lastName} onChangeText={setLastName} style={styles.input} placeholderTextColor="#9CA3AF" />
            </View>
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="at-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput placeholder="Username" autoCapitalize="none" value={username} onChangeText={setUsername} style={styles.input} placeholderTextColor="#9CA3AF" />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput placeholder="Email ID" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholderTextColor="#9CA3AF" />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="call-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput placeholder="Phone Number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} placeholderTextColor="#9CA3AF" />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput placeholder="Password" secureTextEntry={!showPass} value={password} onChangeText={setPassword} style={styles.input} placeholderTextColor="#9CA3AF" />
            <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput placeholder="Confirm Password" secureTextEntry={!showPass} value={confirm} onChangeText={setConfirm} style={styles.input} placeholderTextColor="#9CA3AF" />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="location-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput placeholder="Location (optional note)" value={location} onChangeText={setLocation} style={styles.input} placeholderTextColor="#9CA3AF" />
          </View>

          {!!photo && (
            <View style={{ alignItems:'center', marginBottom: 8 }}>
              <Image source={{ uri: photo.uri }} style={{ width: 80, height: 80, borderRadius: 40 }} />
            </View>
          )}
          <View style={{ width:'100%', marginBottom: 6, flexDirection:'row', gap: 8 }}>
            <TouchableOpacity onPress={pickImage} style={[styles.smallBtn, { backgroundColor:'#F3F4F6' }]}><Text>Upload Profile (optional)</Text></TouchableOpacity>
            <TouchableOpacity onPress={getLocation} style={[styles.smallBtn, { backgroundColor:'#ECFEFF' }]}><Text>Use My Location</Text></TouchableOpacity>
          </View>

          <TouchableOpacity onPress={submit} activeOpacity={0.9} disabled={loading} style={{ width: "100%" }}>
            <LinearGradient colors={["#0BC5EA", "#2563EB"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitBtn}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Sign Up</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ marginTop: 12, flexDirection: "row" }}>
            <Text style={{ color: "#374151" }}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: "#0A66C2", fontWeight: "700" }}>Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  titleTop: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 8 },
  subtitle: { fontSize: 26, fontWeight: "800", color: "#1F2937" },
  caption: { textAlign: "center", color: "#6B7280", marginTop: 6, marginBottom: 16, maxWidth: 260 },
  row: { flexDirection: "row", width: "100%", marginBottom: 10 },
  inputWrap: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    position: "relative",
  },
  input: { paddingLeft: 26, paddingRight: 30, color: "#111827" },
  inputIcon: { position: "absolute", left: 10, top: 14 },
  eyeBtn: { position: "absolute", right: 10, top: 10, height: 28, width: 28, alignItems: "center", justifyContent: "center" },
  submitBtn: {
    marginTop: 6,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
});

async function saveAuth(token: string, profile: any) {
  try {
    const { default: SecureStore } = await import('expo-secure-store');
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_profile', JSON.stringify(profile));
  } catch {}
}
