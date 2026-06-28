import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { FooterLinks } from "@/components/FooterLinks";

export default function RulesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color="#FFFFFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rules</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Promo Content</Text>
        <Text style={styles.text}>
          When creating promos, all rules outlined in this rulebook apply. Any
          violations within created promos will result in the same offense
          durations as those for video calls and general platform behavior.
        </Text>
        <Text style={styles.text}>
          Never incentivize or use exploitative ways to get clicks. For example:
          "Click my link to get a gift from me" or "Click my link and I'll be
          your friend". This will result in a ban for 2 days!
        </Text>

        <Text style={styles.sectionTitle}>Age Restrictions</Text>
        <Text style={styles.text}>
          Minimum Age: You must have reached the age of majority (18+ in most
          countries) in your country to use C24 Club.
        </Text>

        <Text style={styles.sectionTitle}>Explicit Content and Behavior</Text>
        <Text style={styles.text}>
          • No Sexual Acts or Nudity: Any sexual behavior, nudity, or explicit
          content is strictly forbidden during video calls. Violating this rule
          will result in an immediate ban.{"\n"}
          • Avoid Inappropriate Language: Use respectful language. Sexually
          explicit or suggestive remarks are not allowed and will result in
          suspension or ban.
        </Text>

        <Text style={styles.sectionTitle}>Respectful Communication</Text>
        <Text style={styles.text}>
          • No Harassment: Treat other users with kindness and respect.
          Bullying, threats, or harassment are not allowed and will lead to
          account suspension.{"\n"}
          • Hate Speech: Racist, sexist, or other discriminatory language is not
          tolerated and will result in a suspension or ban.
        </Text>

        <Text style={styles.sectionTitle}>Privacy and Safety</Text>
        <Text style={styles.text}>
          • Do Not Share Personal Information: Never share your address, phone
          number, or other personal details during video calls. This is for your
          own safety.{"\n"}
          • No Unauthorized Recording: Recording or taking screenshots of video
          calls without permission is prohibited, except as part of platform
          challenges. Violations will result in account suspension.
        </Text>

        <Text style={styles.sectionTitle}>Prohibited Activities</Text>
        <Text style={styles.text}>
          • No Violence or Threatening Behavior: Displaying weapons or
          threatening others in any way is strictly forbidden.{"\n"}
          • No Illegal Activities: Discussions or displays of illegal
          activities, such as drug use, are not allowed and will result in an
          immediate ban or account suspension.
        </Text>

        <Text style={styles.sectionTitle}>Gift Solicitation</Text>
        <Text style={styles.text}>
          • No Begging for Gifts: Soliciting, begging, or pressuring other users
          to send you gifts or cash is strictly prohibited. This includes
          repeatedly asking for gifts in DMs, video calls, or profile bios.
          Violations will result in a warning or account suspension.{"\n"}
          • No Guilt-Tripping or Manipulation: Using emotional manipulation,
          fake stories, or guilt-tripping to pressure others into gifting is not
          allowed and will result in a ban.{"\n"}
          • No Sexual Advances for Gifts: Offering, requesting, or implying
          sexual acts or favors in exchange for gifts is strictly forbidden.
          This will result in an immediate and permanent ban.
        </Text>

        <Text style={styles.sectionTitle}>Scams and Fraud</Text>
        <Text style={styles.text}>
          No Scamming: Attempting to scam other users or engage in fraudulent
          behavior is strictly prohibited and will result in immediate ban.
        </Text>

        <Text style={styles.sectionTitle}>Appropriate Attire</Text>
        <Text style={styles.text}>
          Dress Properly: Ensure you are dressed appropriately during video
          calls. No nudity, sexually suggestive clothing, or partial clothing
          removal (e.g., shirt off) is allowed and will result in account
          suspension or ban.
        </Text>

        <Text style={styles.sectionTitle}>Substance Use</Text>
        <Text style={styles.text}>
          No Alcohol or Drugs: Displaying or using alcohol or drugs during video
          calls is not allowed and may lead to account suspension or ban.
        </Text>

        <Text style={styles.sectionTitle}>Reporting Violations</Text>
        <Text style={styles.text}>
          Report Misconduct: If you encounter any behavior that violates these
          rules, use the reporting features to notify moderators.
        </Text>

        <Text style={styles.sectionTitle}>Multiple Offenses</Text>
        <Text style={styles.text}>
          Repeat Violators: Users who repeatedly violate these rules will be
          banned indefinitely.
        </Text>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            Apple is not a sponsor of, nor is it involved in any way with, the
            rewards or contests within this app.
          </Text>
        </View>

        <View style={styles.spacer} />
        <FooterLinks />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A4A",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1E1E38",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#EF4444",
    marginTop: 24,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  text: {
    fontSize: 15,
    color: "#D1D1D6",
    lineHeight: 22,
    marginBottom: 12,
  },
  disclaimerBox: {
    marginTop: 32,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  disclaimerText: {
    fontSize: 13,
    color: "#71717A",
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 18,
  },
  spacer: {
    height: 40,
  },
});