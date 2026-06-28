import React from 'react';
import { StyleSheet, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { PhoneOff, X } from 'lucide-react-native';
import { useCall } from '@/contexts/CallContext';
import { useAuth } from '@/contexts/AuthContext';

export const OutgoingCallModal = () => {
  const { activeInvite, hangup } = useCall();
  const { user } = useAuth();

  // Only show if I am the inviter and status is pending
  const isInviter = activeInvite?.inviter_id === user?.id;
  const isPending = activeInvite?.status === 'pending';
  
  if (!activeInvite || !isInviter || !isPending) return null;

  const invitee = activeInvite.invitee || { name: 'Stranger', image_url: '' };

  return (
    <Modal isOpen={true} onClose={hangup} size="md">
      <ModalBackdrop />
      <ModalContent style={styles.modalContent}>
        <ModalHeader style={styles.modalHeader}>
          <Heading style={styles.whiteText}>Calling...</Heading>
          <ModalCloseButton onPress={hangup}>
             <X size={20} color="#71717A" />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody style={styles.modalBody}>
          <VStack space="xl" style={styles.centerItems}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarPulsing}>
                 <Image 
                   source={{ uri: invitee.image_url || 'https://via.placeholder.com/150' }} 
                   style={styles.avatar} 
                 />
              </View>
            </View>
            
            <VStack space="xs" style={styles.centerItems}>
              <Text style={styles.nameText}>{invitee.name}</Text>
              <Text style={styles.inviteText}>Waiting for them to answer</Text>
            </VStack>

            <ActivityIndicator size="large" color="#EF4444" style={{ marginTop: 20 }} />
          </VStack>
        </ModalBody>
        <ModalFooter style={styles.modalFooter}>
           <VStack space="xs" style={styles.centerItems}>
              <TouchableOpacity 
                 style={styles.declineButton} 
                 onPress={hangup}
              >
                <PhoneOff size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.buttonLabel}>Cancel</Text>
           </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: '#1E1E38',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    paddingBottom: 20,
  },
  modalHeader: {
    borderBottomWidth: 0,
    justifyContent: 'center',
    paddingTop: 24,
  },
  modalBody: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  modalFooter: {
    borderTopWidth: 0,
    justifyContent: 'center',
  },
  centerItems: {
    alignItems: 'center',
  },
  whiteText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  inviteText: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPulsing: {
     width: 140,
     height: 140,
     borderRadius: 70,
     backgroundColor: 'rgba(239, 68, 68, 0.1)',
     justifyContent: 'center',
     alignItems: 'center',
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#EF4444',
  },
  declineButton: {
    backgroundColor: '#EF4444',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: {
     color: '#FFFFFF',
     fontSize: 12,
     fontWeight: '700',
  },
});