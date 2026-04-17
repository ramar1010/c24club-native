// Native-only WebRTC — Metro picks this file on iOS/Android automatically
import { RTCView as NativeRTCView } from 'react-native-webrtc';
import { cssInterop } from 'nativewind';

let mod: any = {};

try {
  mod = require('react-native-webrtc');
} catch (e) {
  console.warn('[WebRTC] react-native-webrtc native module not available (Expo Go). Video chat features disabled.');
}

// Support Tailwind classes via NativeWind 4
cssInterop(NativeRTCView, {
  className: {
    target: 'style',
  },
});

export const RTCPeerConnection = mod.RTCPeerConnection ?? null;
export const RTCIceCandidate = mod.RTCIceCandidate ?? null;
export const RTCSessionDescription = mod.RTCSessionDescription ?? null;
export const MediaStream = mod.MediaStream ?? null;
export const mediaDevices = mod.mediaDevices ?? null;
export const RTCView = NativeRTCView;