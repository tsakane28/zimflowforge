import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { DOC_SECTIONS, PROJECT_TAGLINE, PROJECT_TITLE, PROJECT_VERSION } from "@/lib/projectDocs";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, fontFamily: "Helvetica", color: "#111827", lineHeight: 1.5 },
  header: { borderBottom: "2pt solid #0f172a", paddingBottom: 14, marginBottom: 20 },
  brand: { fontSize: 8.5, color: "#64748b", letterSpacing: 1.6, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: 700, marginTop: 6, color: "#0f172a" },
  tagline: { marginTop: 6, color: "#475569", fontSize: 10 },
  meta: { marginTop: 8, fontSize: 8.5, color: "#64748b" },
  sectionTitle: { fontSize: 12.5, fontWeight: 700, color: "#0f172a", marginTop: 16, marginBottom: 6 },
  paragraph: { color: "#1f2937", marginBottom: 6 },
  bullet: { flexDirection: "row", marginBottom: 3, paddingLeft: 4 },
  bulletDot: { width: 10, color: "#0f172a" },
  bulletText: { flex: 1, color: "#1f2937" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
    borderTop: "0.5pt solid #e2e8f0",
    paddingTop: 6,
  },
});

export function ProjectReadmePdf() {
  return (
    <Document title={`${PROJECT_TITLE} — README`} author="ZW FX Workbench">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Project Documentation</Text>
          <Text style={styles.title}>{PROJECT_TITLE}</Text>
          <Text style={styles.tagline}>{PROJECT_TAGLINE}</Text>
          <Text style={styles.meta}>
            Version {PROJECT_VERSION} · Generated {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
          </Text>
        </View>

        {DOC_SECTIONS.map((s) => (
          <View key={s.id} wrap={false}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            {s.body.map((p, i) => (
              <Text key={i} style={styles.paragraph}>{p}</Text>
            ))}
            {s.bullets?.map((b, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          {PROJECT_TITLE} · README · Page rendered client-side with @react-pdf/renderer
        </Text>
      </Page>
    </Document>
  );
}
