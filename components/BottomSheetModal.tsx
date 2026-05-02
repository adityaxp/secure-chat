import { colors } from "@/theme";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import React from "react";
import { ScrollView, StyleSheet } from "react-native";

const BottomSheetModal = ({
  bottomSheetRef,
  children,
  detents = [0.6, 1],
}: {
  bottomSheetRef: React.RefObject<TrueSheet | null>;
  children: React.ReactNode;
  detents?: number[];
}) => {
  return (
    <TrueSheet
      ref={bottomSheetRef}
      scrollable
      detents={detents}
      grabber={false}
      style={styles.bottomSheet}
    >
      <ScrollView
        style={styles.bottomSheetContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </TrueSheet>
  );
};

export default BottomSheetModal;

const styles = StyleSheet.create({
  bottomSheet: {},
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: colors.panel,
  },
});
