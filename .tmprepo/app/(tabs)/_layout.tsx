import { Tabs } from "expo-router";
import { Compass, Gift, Home, Star, User, Video, MessageCircle } from "lucide-react-native";
import React from "react";
import { useUnreadCount } from "@/hooks/useMessages";

function TabLayoutInner() {
  const { data: unreadCount } = useUnreadCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1E1E38",
          borderTopColor: "#2A2A4A",
          borderTopWidth: 1,
          height: 64,
        },
        tabBarActiveTintColor: "#EF4444",
        tabBarInactiveTintColor: "#71717A",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Home size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => (
            <Video size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: "Rewards",
          tabBarIcon: ({ color }) => (
            <Gift size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => (
            <Compass size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => (
            <MessageCircle size={24} color={color} />
          ),
          tabBarBadge: unreadCount && unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#EF4444",
            color: "white",
            fontSize: 10,
            fontWeight: "bold",
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <User size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="promos"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return <TabLayoutInner />;
}