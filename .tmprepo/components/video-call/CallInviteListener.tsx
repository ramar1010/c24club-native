import React from 'react';
import { IncomingCallModal } from './IncomingCallModal';
import { OutgoingCallModal } from './OutgoingCallModal';
import { VipGateModal } from './VipGateModal';
import { View } from 'react-native';

export const CallInviteListener = () => {
  return (
    <>
      <IncomingCallModal />
      <OutgoingCallModal />
      <VipGateModal />
    </>
  );
};