import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

const LAMP_ICON = require("../assets/images/icon.png");

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Ошибка", "Введите логин и пароль");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password.trim());
      router.replace("/rooms");
    } catch (e: any) {
      Alert.alert("Ошибка входа", e?.message ?? "Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Image source={LAMP_ICON} style={styles.icon} />
        <Text style={styles.title}>АЛИ-БАБА</Text>
        <Text style={styles.subtitle}>И 40 КЛАДОВ</Text>
        <Text style={styles.tagline}>Добро пожаловать в игру!</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Логин</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Введите логин"
            placeholderTextColor="#6B7A9E"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.label}>Пароль</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Введите пароль"
            placeholderTextColor="#6B7A9E"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0B1426" />
            ) : (
              <Text style={styles.buttonText}>✨ Войти в игру</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1426",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  icon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#D4A017",
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#D4A017",
    letterSpacing: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F0C040",
    letterSpacing: 3,
    textAlign: "center",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: "#A89060",
    marginBottom: 40,
  },
  form: {
    width: "100%",
  },
  label: {
    fontSize: 13,
    color: "#A89060",
    marginBottom: 6,
    marginLeft: 4,
    fontWeight: "600",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "#1A2744",
    borderWidth: 1,
    borderColor: "#2E4070",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#F5E6C8",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#D4A017",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#D4A017",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#0B1426",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
