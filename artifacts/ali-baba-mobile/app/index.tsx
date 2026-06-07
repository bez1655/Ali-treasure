import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0B1426" }}>
        <ActivityIndicator size="large" color="#D4A017" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/rooms" />;
  }

  return <Redirect href="/login" />;
}
