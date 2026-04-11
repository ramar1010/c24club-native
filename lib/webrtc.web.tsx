// Web-only WebRTC — Metro picks this file on web automatically
import React from 'react';
import { StyleSheet } from 'react-native';

const RTCPeerConnection =
  typeof window !== 'undefined' ? (window as any).RTCPeerConnection : null;
const RTCIceCandidate =
  typeof window !== 'undefined' ? (window as any).RTCIceCandidate : null;
const RTCSessionDescription =
  typeof window !== 'undefined' ? (window as any).RTCSessionDescription : null;
const MediaStream =
  typeof window !== 'undefined' ? (window as any).MediaStream : null;
const mediaDevices =
  typeof window !== 'undefined' && window.navigator
    ? window.navigator.mediaDevices
    : null;

// RTCView shim for web — renders a <video> element
const RTCView = ({ streamURL, style, objectFit, mirror }: any) => {
  // Flatten React Native style (may be a StyleSheet ID / array) into a plain object
  const flatStyle: Record<string, any> = style
    ? (StyleSheet.flatten(style) as Record<string, any>) ?? {}
    : {};

  return (
    <video
      autoPlay
      playsInline
      style={{
        ...flatStyle,
        transform: mirror ? 'scaleX(-1)' : 'none',
        objectFit: objectFit || 'cover',
      }}
      ref={(el) => {
        if (el && streamURL && typeof streamURL === 'object') {
          el.srcObject = streamURL;
        }
      }}
    />
  );
};

export {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
  RTCView,
};