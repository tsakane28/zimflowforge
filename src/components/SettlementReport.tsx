import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  header: { borderBottom: "2pt solid #1e293b", paddingBottom: 12, marginBottom: 16 },
  brand: { fontSize: 9, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 16, fontWeight: 700, marginTop: 4, color: "#0f172a" },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, fontSize: 9, color: "#475569" },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 9, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottom: "0.5pt solid #e2e8f0" },
  rowLabel: { color: "#475569" },
  rowValue: { fontFamily: "Courier", color: "#0f172a" },
  summary: { marginTop: 18, padding: 14, backgroundColor: "#0f172a", color: "#fff", borderRadius: 4 },
  summaryLabel: { fontSize: 8, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase" },
  summaryValue: { fontFamily: "Courier", fontSize: 22, marginTop: 4 },
  notes: { marginTop: 16, padding: 10, backgroundColor: "#f1f5f9", fontSize: 9, color: "#334155" },
  footer: { position: "absolute", bottom: 28, left: 40, right: 40, fontSize: 8, color: "#94a3b8", textAlign: "center", borderTop: "0.5pt solid #e2e8f0", paddingTop: 6 },
});

interface Props {
  reference: string;
  timestamp: string;
  txnType: string;
  source: string;
  target: string;
  rateType: string;
  gross: string;
  rateUsed: string;
  converted: string;
  bankFees: string;
  imtt: string;
  net: string;
  effectiveRate: string;
  publicationDate: string;
  notes: string;
}

const fmt = (s: string, d = 2) => {
  const n = Number(s);
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};

export function SettlementReport(p: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Zimbabwe FX Operations Workbench</Text>
          <Text style={styles.title}>Treasury Settlement Confirmation</Text>
          <View style={styles.meta}>
            <Text>Reference: {p.reference}</Text>
            <Text>Issued: {new Date(p.timestamp).toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction</Text>
          <Row label="Transaction Type" value={p.txnType} />
          <Row label="Source Currency" value={p.source} />
          <Row label="Target Currency" value={p.target} />
          <Row label="Rate Type Used" value={p.rateType} />
          <Row label="Rate Publication Date" value={p.publicationDate} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settlement Ledger</Text>
          <Row label="Gross Amount" value={`${p.source} ${fmt(p.gross)}`} />
          <Row label="Exchange Rate Used" value={fmt(p.rateUsed, 4)} />
          <Row label="Converted Amount" value={`${p.target} ${fmt(p.converted)}`} />
          <Row label="Bank Charges" value={`${p.target} ${fmt(p.bankFees)}`} />
          <Row label="IMTT" value={`${p.target} ${fmt(p.imtt)}`} />
          <Row label="Effective Exchange Rate" value={fmt(p.effectiveRate, 4)} />
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Net Receiver Settlement Amount</Text>
          <Text style={styles.summaryValue}>{p.target} {fmt(p.net)}</Text>
        </View>

        {p.notes && (
          <View style={styles.notes}>
            <Text style={{ fontSize: 8, color: "#64748b", marginBottom: 3 }}>Calculation Notes</Text>
            <Text>{p.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          This document is a system-generated treasury confirmation. Rates sourced from the latest RBZ publication on file.
        </Text>
      </Page>
    </Document>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}
