// Generic Thread renderer (React Native).
// Web 의 components/threads/generic-thread.tsx 를 RN 프리미티브로 미러링.
// 지원 뷰: list. 액션: add. (kanban/calendar/chart 는 후속 단계)

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { mutateWithQueue } from "@/lib/sync/sync-engine";
import { BRAND } from "../../../../packages/shared/brand-tokens";

export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "date"
  | "datetime"
  | "checkbox"
  | "select"
  | "multiselect"
  | "tags"
  | "url"
  | "currency";

export type ViewKind = "list";
export type ActionKind = "add" | "edit" | "delete";

export interface FieldSpec {
  key: string;
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[];
}
export interface ViewSpec {
  kind: ViewKind | string;
  primary_field?: string;
  group_by?: string;
}
export interface ActionSpec {
  kind: ActionKind | string;
  label: string;
}
export interface ThreadSpec {
  title?: string;
  description?: string;
  fields: FieldSpec[];
  views: ViewSpec[];
  actions: ActionSpec[];
}

export interface ThreadDataRow {
  id: string;
  installation_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Props {
  installationId: string;
  spec: ThreadSpec;
  ephemeral?: boolean;
}

export function GenericThread({ installationId, spec, ephemeral = false }: Props) {
  const [rows, setRows] = useState<ThreadDataRow[]>([]);
  const [loading, setLoading] = useState(!ephemeral);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const fields = spec.fields || [];
  const allowAdd = (spec.actions || []).some((a) => a.kind === "add");
  const allowDelete = (spec.actions || []).some((a) => a.kind === "delete");
  const primaryField =
    spec.views[0]?.primary_field ?? fields[0]?.key ?? "title";

  const reload = useCallback(async () => {
    if (ephemeral) return;
    setLoading(true);
    setError(null);
    try {
      const json = await apiGet<{ rows: ThreadDataRow[] }>(
        `/api/threads/data?installation_id=${encodeURIComponent(installationId)}&limit=200`
      );
      setRows(json.rows ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, [installationId, ephemeral]);

  useEffect(() => {
    reload();
  }, [reload]);

  const resetForm = useCallback(() => {
    const init: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === "checkbox") init[f.key] = false;
      else if (f.type === "multiselect" || f.type === "tags") init[f.key] = [];
      else init[f.key] = "";
    }
    setForm(init);
  }, [fields]);

  const submit = useCallback(async () => {
    // Validate required
    for (const f of fields) {
      if (f.required && !form[f.key] && f.type !== "checkbox") {
        setError(`${f.label} 필수입니다`);
        return;
      }
    }
    if (ephemeral) {
      const local: ThreadDataRow = {
        id: `local-${Date.now()}`,
        installation_id: installationId,
        data: { ...form },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setRows((prev) => [local, ...prev]);
      setShowAdd(false);
      resetForm();
      return;
    }
    setError(null);
    const result = await mutateWithQueue({
      endpoint: `/api/threads/data`,
      method: "POST",
      body: { installation_id: installationId, data: form },
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowAdd(false);
    resetForm();
    if (!result.queued) reload();
  }, [fields, form, ephemeral, installationId, reload, resetForm]);

  const removeRow = useCallback(
    async (row: ThreadDataRow) => {
      if (ephemeral) {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
        return;
      }
      const result = await mutateWithQueue({
        endpoint: `/api/threads/data?id=${encodeURIComponent(row.id)}`,
        method: "DELETE",
      });
      if (!result.queued && !result.error) reload();
    },
    [ephemeral, reload]
  );

  const headerSubtitle = useMemo(() => {
    if (loading) return "불러오는 중...";
    return `${rows.length}건`;
  }, [loading, rows.length]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {spec.title && <Text style={styles.title}>{spec.title}</Text>}
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>
        {allowAdd && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              resetForm();
              setShowAdd(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnText}>+ 추가</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.error}>⚠ {error}</Text>}

      {loading ? (
        <ActivityIndicator color={BRAND.colors.pink} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.empty}>아직 항목이 없습니다</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {String(item.data?.[primaryField] ?? "(제목 없음)")}
                </Text>
                {fields.slice(0, 3).map((f) => {
                  if (f.key === primaryField) return null;
                  const v = item.data?.[f.key];
                  if (v == null || v === "") return null;
                  return (
                    <Text key={f.key} style={styles.rowField}>
                      <Text style={styles.rowFieldLabel}>{f.label}: </Text>
                      {String(Array.isArray(v) ? v.join(", ") : v)}
                    </Text>
                  );
                })}
              </View>
              {allowDelete && (
                <TouchableOpacity onPress={() => removeRow(item)} style={styles.delBtn}>
                  <Text style={styles.delText}>삭제</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>새 항목</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={styles.modalClose}>닫기</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {fields.map((f) => (
              <FieldEditor
                key={f.key}
                field={f}
                value={form[f.key]}
                onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
              />
            ))}
            {error && <Text style={styles.error}>⚠ {error}</Text>}
            <TouchableOpacity style={styles.submitBtn} onPress={submit} activeOpacity={0.7}>
              <Text style={styles.submitText}>저장</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>
        {field.label}
        {field.required && <Text style={{ color: BRAND.colors.pink }}> *</Text>}
      </Text>
      {field.type === "checkbox" ? (
        <TouchableOpacity
          onPress={() => onChange(!value)}
          style={[styles.checkbox, value ? styles.checkboxOn : null]}
        >
          <Text style={styles.checkboxText}>{value ? "✓ 예" : "아니오"}</Text>
        </TouchableOpacity>
      ) : field.type === "select" && field.options ? (
        <View style={styles.optionRow}>
          {field.options.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.option, value === opt && styles.optionOn]}
            >
              <Text style={[styles.optionText, value === opt && { color: BRAND.colors.paper }]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : field.type === "longtext" ? (
        <TextInput
          value={String(value ?? "")}
          onChangeText={onChange}
          multiline
          numberOfLines={4}
          style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
        />
      ) : field.type === "number" || field.type === "currency" ? (
        <TextInput
          value={String(value ?? "")}
          onChangeText={(t) => onChange(t === "" ? "" : Number(t))}
          keyboardType="numeric"
          style={styles.input}
        />
      ) : (
        <TextInput
          value={String(value ?? "")}
          onChangeText={onChange}
          autoCapitalize={field.type === "url" ? "none" : "sentences"}
          keyboardType={field.type === "url" ? "url" : "default"}
          style={styles.input}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: "900", color: BRAND.colors.ink },
  subtitle: { fontSize: 11, color: BRAND.colors.graphite, marginTop: 2 },
  addBtn: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.pink,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    color: BRAND.colors.paper,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  error: { color: "#B91C1C", fontSize: 12, marginVertical: 4 },
  empty: { textAlign: "center", color: BRAND.colors.graphite, marginTop: 30, fontSize: 13 },
  row: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  rowTitle: { fontSize: 14, fontWeight: "800", color: BRAND.colors.ink, marginBottom: 4 },
  rowField: { fontSize: 12, color: BRAND.colors.ink, marginTop: 2 },
  rowFieldLabel: { color: BRAND.colors.graphite, fontWeight: "700", fontSize: 11 },
  delBtn: { borderWidth: 1.5, borderColor: "#DC2626", paddingHorizontal: 8, paddingVertical: 4 },
  delText: { fontSize: 10, color: "#DC2626", fontWeight: "700", letterSpacing: 1 },
  modalSafe: { flex: 1, backgroundColor: BRAND.colors.paper },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: BRAND.borders.standard,
    borderBottomColor: BRAND.colors.ink,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: BRAND.colors.ink },
  modalClose: { fontSize: 13, color: BRAND.colors.graphite, fontWeight: "700" },
  modalBody: { padding: 16, gap: 14 },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: BRAND.colors.graphite,
    fontWeight: "700",
  },
  input: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: BRAND.colors.ink,
    backgroundColor: BRAND.colors.paper,
  },
  checkbox: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  checkboxOn: { backgroundColor: BRAND.colors.amber },
  checkboxText: { fontSize: 13, fontWeight: "700", color: BRAND.colors.ink },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  option: {
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionOn: { backgroundColor: BRAND.colors.ink },
  optionText: { fontSize: 12, fontWeight: "700", color: BRAND.colors.ink },
  submitBtn: {
    marginTop: 12,
    borderWidth: BRAND.borders.standard,
    borderColor: BRAND.colors.ink,
    backgroundColor: BRAND.colors.pink,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: {
    color: BRAND.colors.paper,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
