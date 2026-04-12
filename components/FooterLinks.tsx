import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LegalModal, LegalPage } from './LegalModal';

const LINKS: { label: string; page: LegalPage }[] = [
  { label: 'Terms', page: 'terms' },
  { label: 'Privacy', page: 'privacy' },
  { label: 'Safety', page: 'safety' },
];

export function FooterLinks() {
  const [activePage, setActivePage] = useState<LegalPage | null>(null);

  return (
    <>
      <View style={styles.container}>
        <View style={styles.row}>
          {LINKS.map((link, index) => (
            <React.Fragment key={link.page}>
              <TouchableOpacity onPress={() => setActivePage(link.page)} activeOpacity={0.7}>
                <Text style={styles.link}>{link.label}</Text>
              </TouchableOpacity>
              {index < LINKS.length - 1 && <Text style={styles.separator}>·</Text>}
            </React.Fragment>
          ))}
        </View>
        <Text style={styles.copyright}>© {new Date().getFullYear()} C24 Club. All rights reserved.</Text>
      </View>

      <LegalModal
        visible={activePage !== null}
        page={activePage}
        onClose={() => setActivePage(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  link: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },
  separator: {
    fontSize: 12,
    color: '#4B5563',
  },
  copyright: {
    fontSize: 11,
    color: '#4B5563',
    textAlign: 'center',
  },
});