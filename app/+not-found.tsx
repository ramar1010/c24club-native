import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>This screen doesn't exist.</Text>
          <Link href="/" style={styles.link}>
            <Text style={styles.linkText}>Go to home screen!</Text>
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    color: "#FFFFFF",
    marginBottom: 16,
  },
  link: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 16,
    color: "#EF4444",
    textDecorationLine: "underline",
  },
});