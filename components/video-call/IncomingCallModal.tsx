import React from 'react';
import { StyleSheet, View, TouchableOpacity, Image } from 'react-native';
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
import { Phone, PhoneOff, Video, X } from 'lucide-react-native';
import { useCall } from '@/contexts/CallContext';

export const IncomingCallModal = () => {
  const { incomingInvite, acceptInvite, declineInvite } = useCall();

  if (!incomingInvite) return null;

  const inviter = incomingInvite.inviter || { name: 'Stranger', image_url: '' };

  return (
    <Modal isOpen={!!incomingInvite} onClose={() => declineInvite(incomingInvite.id)} size="md">
      <ModalBackdrop />
      <ModalContent style={styles.modalContent}>
        <ModalHeader style={styles.modalHeader}>
          <Heading style={styles.whiteText}>Incoming Call...</Heading>
          <ModalCloseButton onPress={() => declineInvite(incomingInvite.id)}>
             <X size={20} color="#71717A" />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody style={styles.modalBody}>
          <VStack space="xl" style={styles.centerItems}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarPulsing}>
                 <Image 
                   source={{ uri: inviter.image_url || 'https://via.placeholder.com/150' }} 
                   style={styles.avatar} 
                 />
              </View>
            </View>
            
            <VStack space="xs" style={styles.centerItems}>
              <Text style={styles.nameText}>📹 {inviter.name} wants to video chat!</Text>
              <Text style={styles.inviteText}>Earn rewards before they leave! Join now</Text>
            </VStack>
          </VStack>
        </ModalBody>
        <ModalFooter style={styles.modalFooter}>
           <HStack space="xl" style={styles.buttonRow}>
             <VStack space="xs" style={styles.centerItems}>
                <TouchableOpacity 
                   style={styles.declineButton} 
                   onPress={() => declineInvite(incomingInvite.id)}
                >
                  <PhoneOff size={28} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.buttonLabel}>Decline</Text>
             </VStack>
             
             <VStack space="xs" style={styles.centerItems}>
                <TouchableOpacity 
                   style={styles.acceptButton} 
                   onPress={() => acceptInvite(incomingInvite.id)}
                >
                  <Video size={28} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.buttonLabel}>Accept</Text>
             </VStack>
           </HStack>
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
     backgroundColor: 'rgba(34, 197, 94, 0.1)',
     justifyContent: 'center',
     alignItems: 'center',
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#22C55E',
  },
  buttonRow: {
     width: '100%',
     justifyContent: 'space-around',
     paddingHorizontal: 20,
  },
  declineButton: {
    backgroundColor: '#EF4444',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#22C55E',
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