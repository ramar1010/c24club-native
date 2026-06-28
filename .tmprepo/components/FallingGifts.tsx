import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, Image, StyleSheet, View } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const GIFT_IMG = require("@/assets/images/image 1347.png");
const BAGS_IMG = require("@/assets/images/adsdad.png");

const FALLING_ITEMS = [
  { img: GIFT_IMG, x: 0.08,  duration: 4200, delay: 0,    size: 52, rotateDir:  1 },
  { img: BAGS_IMG, x: 0.72,  duration: 5000, delay: 700,  size: 48, rotateDir: -1 },
  { img: GIFT_IMG, x: 0.42,  duration: 4600, delay: 1500, size: 44, rotateDir:  1 },
  { img: BAGS_IMG, x: 0.22,  duration: 5400, delay: 2200, size: 50, rotateDir: -1 },
  { img: GIFT_IMG, x: 0.62,  duration: 4000, delay: 3000, size: 46, rotateDir:  1 },
  { img: BAGS_IMG, x: 0.85,  duration: 4800, delay: 900,  size: 44, rotateDir: -1 },
  { img: GIFT_IMG, x: 0.32,  duration: 5200, delay: 3800, size: 40, rotateDir:  1 },
  { img: BAGS_IMG, x: 0.55,  duration: 4400, delay: 1800, size: 42, rotateDir: -1 },
];

type FallingItemProps = typeof FALLING_ITEMS[0];

function FallingItem({ img, x, duration, delay, size, rotateDir }: FallingItemProps) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = () => {
      translateY.setValue(-80);
      rotate.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT + 80,
          duration,
          delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start(() => loop());
    };
    loop();
  }, []);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: rotateDir > 0 ? ["-20deg", "20deg"] : ["20deg", "-20deg"],
  });

  return (
    <Animated.Image
      source={img}
      style={{
        position: "absolute",
        left: SCREEN_WIDTH * x,
        width: size,
        height: size,
        opacity: 0.22,
        transform: [{ translateY }, { rotate: rotateInterpolate }],
      }}
      resizeMode="contain"
      pointerEvents="none"
    />
  );
}

export default function FallingGifts() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {FALLING_ITEMS.map((item, i) => (
        <FallingItem key={i} {...item} />
      ))}
    </View>
  );
}