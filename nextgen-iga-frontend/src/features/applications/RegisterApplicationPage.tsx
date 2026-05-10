import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Search, UserCheck, Shield, Plus, Check, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader } from "../../components/layout/PageHeader";
import { applicationsApi } from "../../api/applications.api";
import { usersApi } from "../../api/users.api";

const schema = z.object({
  appName: z.string().min(2, "Application name must be at least 2 characters"),
  groupCn: z.string().min(2, "Group name must be at least 2 characters"),
  owner: z.string().min(1, "Owner (Manager) is required"),
});
type FormData = z.infer<typeof schema>;

export function RegisterApplicationPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { owner: "" }
  });

  const selectedOwner = watch("owner");
  const watchValues = watch();

  // Fetch supervisors to assign as owners
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users", "supervisors", userSearch],
    queryFn: () => usersApi.list({ search: userSearch, role: "supervisor" }),
  });

  const supervisors = usersData?.data ?? [];
  const selectedUserDetails = supervisors.find(u => u.uid === selectedOwner);

  const create = useMutation({
    mutationFn: (data: FormData) => applicationsApi.createGroup(data),
    onSuccess: (res: any) => {
      const msg = res.message || "Application group created and synced to LDAP";
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["applications"] });
      navigate("/admin/applications");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || "Failed to create application group";
      toast.error(msg);
    },
  });

  return (
    <div className="fade-in">
      <PageHeader
        title="Add New Application"
        breadcrumbs={[
          { label: "Applications", to: "/admin/applications" },
          { label: "Add Application" },
        ]}
      />

      <div className="grid-2" style={{ gap: 24, alignItems: "start" }}>
        <div className="card shadow-lg border-0">
          <div className="card-header bg-transparent border-0">
            <span className="card-title text-xl">Application Group Configuration</span>
            <p className="text-muted text-sm mt-1">
              Create a new group in the infrastructure and assign an owner.
            </p>
          </div>

          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-6">
            <div className="form-group">
              <label className="form-label required">Application Display Name</label>
              <input
                className={`form-control ${errors.appName ? "error" : ""}`}
                placeholder="Sales Portal"
                {...register("appName")}
              />
              {errors.appName && <span className="form-error">{errors.appName.message}</span>}
              <span className="form-hint">User-friendly name shown across the platform.</span>
            </div>

            <div className="form-group">
              <label className="form-label required">Group Common Name (CN)</label>
              <div className="input-group">
                <span className="input-group-text font-mono text-xs">cn=</span>
                <input
                  className={`form-control ${errors.groupCn ? "error" : ""}`}
                  placeholder="sales-portal-users"
                  {...register("groupCn")}
                />
              </div>
              {errors.groupCn && <span className="form-error">{errors.groupCn.message}</span>}
              <span className="form-hint">Technical identifier for the application group in LDAP.</span>
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label required">Assigned Owner (Supervisor)</label>
              <input type="hidden" {...register("owner")} />

              <div
                className={`form-control cursor-pointer flex items-center justify-between ${errors.owner ? 'error' : ''}`}
                style={{ height: 'auto', minHeight: 42 }}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                {selectedUserDetails ? (
                  <div className="flex items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                    <div className="avatar-xs bg-primary text-white">
                      {selectedUserDetails.full_name?.[0] || selectedUserDetails.uid[0]}
                    </div>
                    <span className="font-medium truncate" style={{ flex: 1 }}>{selectedUserDetails.full_name}</span>
                    <span className="text-xs text-muted font-mono">({selectedUserDetails.uid})</span>
                  </div>
                ) : (
                  <span className="text-muted">Select owner…</span>
                )}
                <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isDropdownOpen && (
                <div className="card shadow-xl border mt-1 overflow-hidden" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  padding: 10,
                  animation: 'fadeIn 150ms ease'
                }}>
                  <div className="search-input-wrap mb-2" style={{ maxWidth: 'none' }}>
                    <Search size={14} className="text-muted" />
                    <input
                      className="form-control"
                      placeholder="Search supervisors..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>

                  <div className="user-picker-list" style={{ maxHeight: '240px' }}>
                    {isLoadingUsers ? (
                      <div className="p-4 text-center"><span className="spinner" /></div>
                    ) : supervisors.length === 0 ? (
                      <div className="p-4 text-center text-muted text-sm">No supervisors found matching "{userSearch}"</div>
                    ) : (
                      supervisors.map((u) => (
                        <div
                          key={u.id}
                          className={`user-picker-item ${selectedOwner === u.uid ? "active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setValue("owner", u.uid);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <div className="avatar-xs mr-3 bg-primary text-white">
                            {u.full_name?.[0] || u.uid[0]}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{u.full_name}</div>
                            <div className="text-xs text-muted font-mono">{u.uid}</div>
                          </div>
                          {selectedOwner === u.uid && <Check size={16} className="text-primary" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              {errors.owner && <span className="form-error">{errors.owner.message}</span>}
            </div>

            <div className="pt-4 border-top flex gap-3">
              <Link to="/admin/applications" className="btn btn-secondary">Cancel</Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || create.isPending}
              >
                {create.isPending ? <span className="spinner" /> : <Plus size={16} />}
                Create Application Group
              </button>
            </div>
          </form>
        </div>

        {/* <div className="card bg-gray-50 border-dashed">
          <div className="card-header border-0 pb-0">
            <span className="card-title text-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} className="text-primary" /> Technical Details
            </span>
          </div>
          <div className="card-body">
            <p className="text-xs text-muted mb-4">
              LDAP group creation payload for infrastructure sync.
            </p>
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto shadow-inner">
              <div className="mb-1"># Payload Preview</div>
              <div>{`{`}</div>
              <div className="pl-4">{`"appName": "${watchValues.appName || "Sales Portal"}",`}</div>
              <div className="pl-4">{`"groupCn": "${watchValues.groupCn || "managers"}",`}</div>
              <div className="pl-4">{`"owner": "${selectedOwner || "aghosh"}",`}</div>
              <div className="pl-4">{`"channel": "NATS",`}</div>
              <div className="pl-4">{`"status": "PROVISION_PENDING"`}</div>
              <div>{`}`}</div>
              <div className="mt-2 text-gray-500"># Infrastructure:</div>
              <div className="text-blue-300">Managed System (Secured)</div>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
