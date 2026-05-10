import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Search,
  Globe,
  Lock,
  UserCheck,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { PageHeader } from "../../components/layout/PageHeader";
import { requestsApi } from "../../api/requests.api";
import { usersApi } from "../../api/users.api";
import { applicationsApi } from "../../api/applications.api";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../hooks/useAuth";




const step2Schema = z.object({
  justification: z.string().min(1, "Please select a justification"),
  customJustification: z.string().optional(),
  duration: z.string().optional(),
  targetUserId: z.string().optional(),
  role: z.string().min(1, "Please select a role"),
  customRole: z.string().optional(),
}).refine(data => {
  if (data.justification === "Other" && (!data.customJustification || data.customJustification.length < 10)) {
    return false;
  }
  return true;
}, {
  message: "Detailed justification must be at least 10 characters",
  path: ["customJustification"],
});
type Step2Data = z.infer<typeof step2Schema>;

export function NewRequestPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isSupervisor } = usePermissions();
  const [step, setStep] = useState(1);
  const [resourceId, setResourceId] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [resourceName, setResourceName] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  const justificationType = watch("justification", "");
  const customJustification = watch("customJustification", "");
  const targetUserId = watch("targetUserId", "");
  const selectedRole = watch("role");

  const { data: usersData } = useQuery({
    queryKey: ["users", { search: userSearch }],
    queryFn: () => usersApi.list({ search: userSearch, per_page: 20 }),
    enabled: isSupervisor,
  });

  const userList = (usersData?.data ?? []).filter((u) => u.id !== user?.id);

  const submit = useMutation({
    mutationFn: (data: Step2Data) =>
      requestsApi.create({
        resourceId,
        application_name: resourceName,
        role_name: data.role === "other" ? (data.customRole ?? "") : data.role,
        justification: data.justification === "other" ? (data.customJustification ?? "") : data.justification,
        duration: data.duration ? parseInt(data.duration) : undefined,
        targetUserId: data.targetUserId || user?.id,
      }),
    onSuccess: () => {
      toast.success("Access request submitted successfully!");
      // Invalidate queries to ensure the list is fresh
      qc.invalidateQueries({ queryKey: ['requests'] });
      navigate("/requests");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to submit request.");
    },
  });

  const { data: appsData, isLoading: appsLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: () => applicationsApi.list(),
  });

  const applications = appsData?.data ?? [];

  const filtered = applications.filter(
    (r) =>
      !search ||
      r.app_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.category && r.category.toLowerCase().includes(search.toLowerCase())),
  );

  const selectResource = (id: string) => {
    setResourceId(id);
    const app = applications.find((r) => r.id === id);
    setResourceName(app?.app_name ?? "");
    setCustomInput("");
  };
  const canProceedStep1 = resourceId.length > 0;

  return (
    <div className="fade-in">
      <PageHeader
        title="New Access Request"
        breadcrumbs={[
          { label: "Requests", to: "/requests" },
          { label: "New Request" },
        ]}
      />

      <div className="steps" style={{ marginBottom: 24 }}>
        {[
          { n: 1, label: "Select Resource" },
          { n: 2, label: "Configure Access" },
          { n: 3, label: "Review & Submit" },
        ].map(({ n, label }, i, arr) => (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            <div className="step-item">
              <div
                className={`step-num ${step > n ? "done" : step === n ? "active" : ""}`}
              >
                {step > n ? <Check size={12} /> : n}
              </div>
              <span
                className={`step-label ${step === n ? "active" : step > n ? "done" : ""}`}
              >
                {label}
              </span>
            </div>
            {i < arr.length - 1 && (
              <div className={`step-line ${step > n ? "done" : ""}`} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card shadow-lg border-0">
          <div className="card-header bg-transparent border-0">
            <span className="card-title text-xl">Select a Resource</span>
            <p className="text-muted text-sm mt-1">Choose the application or infrastructure you need access to.</p>
          </div>

          <div className="filters-bar" style={{ marginBottom: 20 }}>
            <div className="search-input-wrap" style={{ maxWidth: "100%", flex: 1 }}>
              <Search size={16} />
              <input
                className="form-control"
                placeholder="Search resources by name or category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="app-card-grid">
            {appsLoading ? (
              <div className="text-center py-10 w-full col-span-full">Loading applications...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 w-full col-span-full">No applications found.</div>
            ) : (
              filtered.map((r) => (
                <div
                  key={r.id}
                  className={`app-card ${resourceId === r.id ? "selected" : ""}`}
                  onClick={() => selectResource(r.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Globe size={18} className="text-primary" />
                    <span className="app-card-category">{r.category || "General"}</span>
                    {resourceId === r.id && <Check size={14} className="text-primary ml-auto" />}
                  </div>
                  <div className="app-card-name">{r.app_name}</div>
                  <div className="app-card-desc">{r.description || "Access to this application."}</div>
                  <div className="text-xs text-muted mt-2 font-mono">{r.id}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 pt-6 border-top">
            <label className="form-label flex items-center gap-2">
              <Lock size={14} /> Custom Resource ID
            </label>
            <input
              className="form-control"
              placeholder="e.g. production-storage-v2"
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                setResourceName(e.target.value);
                if (e.target.value) setResourceId(e.target.value);
                else setResourceId("");
              }}
            />
            <span className="form-hint">Enter a custom ID if the resource is not listed above.</span>
          </div>

          <div className="flex justify-end mt-6">
            <button className="btn btn-primary" disabled={!canProceedStep1} onClick={() => setStep(2)}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card shadow-lg border-0">
          <div className="card-header bg-transparent border-0">
            <span className="card-title text-xl">Configure Access Details</span>
            <p className="text-muted text-sm mt-1">Specify your role and provide a justification for resource: <code className="text-primary">{resourceId}</code></p>
          </div>
          
          <form onSubmit={handleSubmit(() => setStep(3))} className="space-y-6">
            <div className="form-group">
              <label className="form-label required">Requested Role / Access Level</label>
              <select className={`form-control ${errors.role ? "error" : ""}`} {...register("role")}>
                <option value="">Select a role...</option>
                <option value="viewer">Viewer / Read-Only</option>
                <option value="editor">Editor / Read-Write</option>
                <option value="admin">Administrator / Full Control</option>
                <option value="other">Other (Specify below)...</option>
              </select>
              {errors.role && <span className="form-error">{errors.role.message}</span>}
            </div>

            {selectedRole === "other" && (
              <div className="form-group fade-in">
                <label className="form-label required">Custom Role Name</label>
                <input 
                  className={`form-control ${errors.customRole ? "error" : ""}`}
                  placeholder="e.g. Data Auditor, Support Lead..."
                  {...register("customRole")}
                />
                {errors.customRole && <span className="form-error">Custom role is required</span>}
              </div>
            )}

            <div className="form-group">
              <label className="form-label required">Justification Reason</label>
              <select 
                className={`form-control ${errors.justification ? "error" : ""}`} 
                {...register("justification")}
              >
                <option value="">Select a reason...</option>
                <option value="Project Requirement">Project Requirement</option>
                <option value="Maintenance Task">Maintenance Task</option>
                <option value="Access Troubleshooting">Access Troubleshooting</option>
                <option value="Audit/Compliance Review">Audit/Compliance Review</option>
                <option value="Other">Other (Specify below)...</option>
              </select>
              {errors.justification && <span className="form-error">{errors.justification.message}</span>}
            </div>
            
            {watch("justification") === "Other" && (
              <div className="form-group fade-in">
                <label className="form-label required">Detailed Justification</label>
                <textarea
                  className={`form-control ${errors.customJustification ? "error" : ""}`}
                  rows={3}
                  placeholder="Explain the business need in detail (min 10 chars)..."
                  {...register("customJustification")}
                />
                {errors.customJustification && <span className="form-error">Detailed justification is required</span>}
              </div>
            )}

            <div className="form-group pt-4 border-top">
              <label className="form-label">Duration (Seconds)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 30 (Leave blank for permanent access)"
                min={1}
                style={{ maxWidth: 200 }}
                {...register("duration")}
              />
              <span className="form-hint">Time-based access for temporary projects (e.g. 30 or 60 seconds).</span>
            </div>

            {isSupervisor && (
              <div className="form-group pt-4 border-top">
                <label className="form-label flex items-center gap-2">
                  <UserCheck size={16} className="text-primary" /> 
                  <span className="font-semibold text-lg">Requestee (Target User)</span>
                </label>
                <p className="text-sm text-muted mb-4">Select who this access is being requested for.</p>
                  <div className="search-input-wrap mb-3">
                    <Search size={13} />
                    <input
                      className="form-control"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>

                  <div className="user-picker-list border rounded-lg max-h-40 overflow-y-auto">
                    <div className={`user-picker-item ${!targetUserId ? 'active shadow-sm' : ''}`} onClick={() => setValue("targetUserId", "")}>
                      <div className="avatar-xs mr-3 bg-primary text-white">{user?.full_name?.[0]}</div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">Myself (You)</div>
                        <div className="text-xs text-muted">{user?.full_name} — {user?.email}</div>
                      </div>
                      {!targetUserId && <Check size={14} className="text-primary" />}
                    </div>

                    {userList.map((u) => (
                      <div key={u.id} className={`user-picker-item ${targetUserId === u.id ? 'active' : ''}`} onClick={() => setValue("targetUserId", u.id)}>
                        <div className="avatar-xs mr-3">{u.full_name?.[0]}</div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{u.full_name}</div>
                          <div className="text-xs text-muted">{u.email}</div>
                        </div>
                        {targetUserId === u.id && <Check size={14} className="text-primary" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

             <div className="flex justify-between mt-8">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button type="submit" className="btn btn-primary">Review →</button>
            </div>
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="card shadow-lg border-0">
          <div className="card-header bg-transparent border-0">
            <span className="card-title text-xl">Review & Confirm</span>
            <p className="text-muted text-sm mt-1">Please double-check your request details before submitting.</p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="detail-row">
              <span className="detail-label">Resource</span>
              <span className="detail-value font-mono">{resourceId} ({resourceName})</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Requested Role</span>
              <span className="detail-value capitalize text-primary font-bold">
                {selectedRole === "other" ? watch("customRole") : selectedRole}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Target User</span>
              <span className="detail-value">
                {targetUserId ? userList.find(u => u.id === targetUserId)?.full_name : "Myself"}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Justification</span>
              <span className="detail-value italic text-gray-600">
                "{justificationType === "other" || justificationType === "Other" ? watch("customJustification") : justificationType}"
              </span>
            </div>
            {watch("duration") && (
              <div className="detail-row fade-in">
                <span className="detail-label">Duration</span>
                <span className="detail-value text-amber-600 font-bold">{watch("duration")} Seconds</span>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button className="btn btn-secondary" onClick={() => setStep(2)} disabled={submit.isPending}>← Back</button>
            <button 
              className="btn btn-primary" 
              disabled={submit.isPending} 
              onClick={handleSubmit((d) => submit.mutate(d))}
            >
              {submit.isPending ? "Submitting..." : "Confirm & Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
