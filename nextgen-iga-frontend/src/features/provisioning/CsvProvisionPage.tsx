import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  X,
  Download,
  UserPlus,
} from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { provisionApi } from "../../api/provision.api";
import type {
  CsvProvisionPreview,
  CsvProvisionRow,
  CsvRowError,
} from "../../api/ai.api";

const TEMPLATE_HREF = "data:text/csv;charset=utf-8," + encodeURIComponent("full_name,email,role,department\nJohn Doe,john@example.com,end_user,Engineering\nJane Smith,jane@example.com,supervisor,Product");

const CSV_COL_TO_LDAP: Record<string, string> = {
  full_name: 'cn',
  email: 'mail',
  role: 'role',
  department: 'ou',
  manager: 'manager'
};

const ROLE_LABEL: Record<string, string> = {
  end_user: "End User",
  supervisor: "Supervisor",
  admin: "Admin",
};

interface BackendPreviewPayload {
  total_rows?: number;
  valid_rows?: number;
  error_rows?: number;
  total_created?: number;
  errors?: CsvRowError[];
  preview?: CsvProvisionRow[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CsvProvisionPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [preview, setPreview] = useState<CsvProvisionPreview | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const previewMutation = useMutation({
    mutationFn: (f: File) => provisionApi.previewCsv(f, (percent) => setUploadProgress(percent)),
    onSuccess: (res) => {
      setUploadProgress(0); // Reset after success
      if (res.data) {
        const payload = res.data as unknown as BackendPreviewPayload;
        setPreview({
          total_rows:
            payload.total_rows ??
            (payload.total_created ?? 0) + (payload.errors?.length ?? 0),
          valid_rows: payload.valid_rows ?? payload.total_created ?? 0,
          error_rows: payload.error_rows ?? payload.errors?.length ?? 0,
          errors: payload.errors ?? [],
          preview: payload.preview ?? [],
        });
      } else {
        toast.error(res.message ?? "Preview failed");
      }
    },
    onError: () => toast.error("Failed to parse CSV — check format"),
  });

  const submitMutation = useMutation({
    mutationFn: (users: any[]) => provisionApi.submitCsv(users),
    onSuccess: (res: any) => {
      // Check for the specific "provision" action or "results" array from the Gateway
      const isSuccess = res.action === "provision" || res.results?.length > 0;

      if (isSuccess) {
        const result = res.results?.[0];
        const count = preview?.valid_rows || 0;

        toast.success(
          result?.message ||
            `${count} user${count !== 1 ? "s" : ""} processed successfully`,
        );
        qc.invalidateQueries({ queryKey: ["admin", "users"] });
        navigate("/admin/users");
      } else {
        toast.error(res.message || "Submission failed");
      }
    },
    onError: () => toast.error("Submission failed"),
  });

  const handleFile = useCallback(
    (f: File) => {
      if (!f.name.endsWith(".csv")) {
        toast.error("Only CSV files accepted");
        return;
      }
      setFile(f);
      setPreview(null);
      previewMutation.mutate(f);
    },
    [previewMutation],
  );

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 👇 DYNAMIC COLUMN LOGIC 👇
  const orderedMandatory = ["full_name", "email", "role"];
  const dynamicColumns = preview?.preview?.length
    ? Object.keys(preview.preview[0]).filter(
        (k) => !["row", "status", "error"].includes(k),
      )
    : [];
  
  const extraColumns = dynamicColumns.filter(c => !orderedMandatory.includes(c));

  return (
    <div>
      <PageHeader
        title="Bulk Create Users via CSV"
        subtitle="Upload a CSV to provision multiple OpenLDAP (inetOrgPerson) accounts at once"
        breadcrumbs={[
          { label: "Users", to: "/admin/users" },
          { label: "Bulk CSV" },
        ]}
        actions={
          <a
            href={TEMPLATE_HREF}
            download="ldap-users-template.csv"
            className="btn btn-secondary btn-sm"
          >
            <Download size={14} /> Template CSV
          </a>
        }
      />

      {/* Field reference banner */}
      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        <FileText size={16} />
        <div>
          <strong>Required columns:</strong>&nbsp;
          <code>full_name</code>, <code>email</code>, <code>role</code>
          &nbsp;·&nbsp;
          <strong>Optional:</strong>&nbsp;<code>department</code>
          &nbsp;·&nbsp;
          <strong>role values:</strong>&nbsp;<code>end_user</code> |{" "}
          <code>supervisor</code> | <code>admin</code>
          &nbsp;·&nbsp; Temporary password auto-generated and emailed to each
          user.
        </div>
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          className={`csv-dropzone ${dragOver ? "dragover" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload
            size={32}
            color={dragOver ? "var(--color-primary)" : "var(--color-gray-400)"}
          />
          <div className="csv-dropzone-text">
            <span>
              Drop CSV here or{" "}
              <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                browse
              </span>
            </span>
            <span className="text-xs text-muted" style={{ marginTop: 4 }}>
              Max 10 MB · .csv only
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={onInputChange}
          />
        </div>
      )}

      {/* Parsing spinner & Progress */}
      {file && previewMutation.isPending && (
        <div
          className="card shadow-sm border-0"
          style={{ textAlign: "center", padding: "40px 24px" }}
        >
          <div
            className="spinner spinner-lg mb-4"
            style={{ margin: "0 auto" }}
          />
          <div className="text-sm font-semibold mb-2">
            {uploadProgress < 100 ? `Uploading ${file.name} to S3...` : `Parsing CSV data...`}
          </div>
          
          <div className="progress-bar mt-4" style={{ maxWidth: 300, margin: '0 auto' }}>
            <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
          <div className="text-xs text-muted mt-2">{uploadProgress}% Complete</div>
        </div>
      )}

      {/* Preview section */}
      {preview && file && (
        <div>
          {/* KPI strip */}
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi-card">
              <div className="kpi-icon blue">
                <FileText size={18} />
              </div>
              <div className="kpi-label">Total Rows</div>
              <div className="kpi-value">{preview.total_rows}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon green">
                <CheckCircle size={18} />
              </div>
              <div className="kpi-label">Valid Users</div>
              <div
                className="kpi-value"
                style={{ color: "var(--color-success)" }}
              >
                {preview.valid_rows}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon red">
                <AlertTriangle size={18} />
              </div>
              <div className="kpi-label">Errors</div>
              <div
                className="kpi-value"
                style={{
                  color:
                    preview.error_rows > 0 ? "var(--color-danger)" : "inherit",
                }}
              >
                {preview.error_rows}
              </div>
            </div>
          </div>

          {/* Error list */}
          {preview.errors.length > 0 && (
            <div
              className="alert alert-danger"
              style={{
                marginBottom: 16,
                flexDirection: "column",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 600,
                }}
              >
                <AlertTriangle size={15} /> {preview.error_rows} row(s) have
                errors and will be skipped
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {preview.errors.slice(0, 5).map((e: CsvRowError, i: number) => (
                  <div key={i} className="text-xs">
                    Row {e.row} · <strong>{e.field}</strong>
                    {" (→ "}
                    <code>{CSV_COL_TO_LDAP[e.field ?? ''] ?? e.field}</code>
                    {"): "}
                    {e.message}
                  </div>
                ))}
                {preview.errors.length > 5 && (
                  <div className="text-xs">
                    …and {preview.errors.length - 5} more errors
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview table — columns derived dynamically from response */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">
                Preview — first {Math.min(preview.preview.length, 10)} rows
                {extraColumns.length > 0 && (
                  <span
                    className="text-xs text-muted"
                    style={{ marginLeft: 8, fontWeight: 400 }}
                  >
                    · {extraColumns.length} extra column
                    {extraColumns.length !== 1 ? "s" : ""} detected from CSV
                  </span>
                )}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={reset}>
                <X size={14} /> Change file
              </button>
            </div>
            <div
              className="table-wrapper"
              style={{
                overflowX: "auto",
                maxWidth: "100%",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <table
                style={{
                  whiteSpace: "nowrap",
                  width: "100%",
                  minWidth: "900px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        position: "sticky",
                        left: 0,
                        background: "var(--color-bg-primary, white)",
                        zIndex: 1,
                      }}
                    >
                      Row
                    </th>

                    {/* Mandatory columns — visually marked with a dot */}
                    {orderedMandatory.map((col) => (
                      <th
                        key={col}
                        style={{
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col.replace(/_/g, " ")}
                        <span
                          title="Required field"
                          style={{
                            display: "inline-block",
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "var(--color-danger)",
                            marginLeft: 4,
                            verticalAlign: "middle",
                            marginBottom: 2,
                          }}
                        />
                      </th>
                    ))}

                    {/* Extra columns — fully dynamic, whatever came from the CSV */}
                    {extraColumns.map((col) => (
                      <th
                        key={col}
                        style={{
                          textTransform: "uppercase",
                          color: "var(--color-gray-500)",
                          fontStyle: "italic",
                        }}
                      >
                        {col.replace(/_/g, " ")}
                        {CSV_COL_TO_LDAP[col] && (
                          <span
                            style={{
                              color: "var(--color-gray-400)",
                              fontWeight: 400,
                              fontSize: "0.7rem",
                              marginLeft: 4,
                            }}
                          >
                            ({CSV_COL_TO_LDAP[col]})
                          </span>
                        )}
                      </th>
                    ))}

                    <th
                      style={{
                        position: "sticky",
                        right: 0,
                        background: "var(--color-bg-primary, white)",
                        zIndex: 1,
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview
                    .slice(0, 10)
                    .map((row: CsvProvisionRow, idx: number) => (
                      <tr key={row.row ?? idx}>
                        <td>{row.row ?? idx + 1}</td>

                        {/* 👇 Dynamically render all cells for this row */}
                        {dynamicColumns.map((col) => {
                          const cellValue = String(row[col] ?? "");

                          if (col.toLowerCase() === "role" && cellValue) {
                            return (
                              <td key={col}>
                                <span
                                  style={{
                                    background: "var(--color-primary-light)",
                                    color: "var(--color-primary)",
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                  }}
                                >
                                  {ROLE_LABEL[cellValue] ?? cellValue}
                                </span>
                              </td>
                            );
                          }

                          if (col === "manager" && cellValue) {
                            return (
                              <td key={col}>
                                <span
                                  title={cellValue}
                                  style={{
                                    display: "inline-block",
                                    maxWidth: 180,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  {cellValue}
                                </span>
                              </td>
                            );
                          }

                          if (col === "user_password" && cellValue) {
                            return (
                              <td key={col}>
                                <span style={{ letterSpacing: 2 }}>
                                  ••••••••
                                </span>
                              </td>
                            );
                          }

                          return <td key={col}>{cellValue || "—"}</td>;
                        })}

                        <td>
                          {row.status === "valid" || !row.error ? (
                            <CheckCircle
                              size={15}
                              color="var(--color-success)"
                            />
                          ) : (
                            <span
                              title={row.error}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                color: "var(--color-danger)",
                                fontSize: "0.75rem",
                              }}
                            >
                              <AlertTriangle size={13} /> {row.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={reset}>
              ← Change File
            </button>
            <button
              className="btn btn-primary"
              disabled={preview.valid_rows === 0 || submitMutation.isPending}
              onClick={() => {
                if (preview?.preview) {
                  const validUsers = preview.preview.filter(
                    (u) => u.status === "valid",
                  );
                  submitMutation.mutate(validUsers);
                }
              }}
            >
              {submitMutation.isPending ? (
                <span className="spinner" />
              ) : (
                <UserPlus size={14} />
              )}
              Create {preview.valid_rows} User
              {preview.valid_rows !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
