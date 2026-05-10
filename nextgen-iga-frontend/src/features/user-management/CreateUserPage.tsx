import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader } from "../../components/layout/PageHeader";
import { provisionApi } from "../../api/provision.api";

const schema = z
  .object({
    full_name: z.string().min(2, "Name must be at least 2 characters"),
    title: z.string().min(2, "Job title must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string(),
    role: z.enum(["end_user", "supervisor", "admin"]),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

const ROLES = [
  { value: "end_user", label: "End User" },
  { value: "supervisor", label: "Supervisor" },
  { value: "admin", label: "Admin" },
] as const;

function FieldError({ msg }: { msg?: string }) {
  return msg ? <span className="form-error">{msg}</span> : null;
}

export function CreateUserPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "end_user" },
  });

  const create = useMutation({
    mutationFn: (data: FormData) => {
      // Map form fields to provisioner fields
      const names = data.full_name.trim().split(/\s+/);
      const givenName = names[0];
      const sn = names.slice(1).join(' ') || 'User';
      
      // UID generation rule: first letter of firstname + rest from title (lowercase)
      const firstLetter = givenName.charAt(0).toLowerCase();
      const titleLower = data.title.toLowerCase().replace(/\s+/g, '');
      const uid = `${firstLetter}${titleLower}`;
      
      return provisionApi.provision({
        uid,
        givenName,
        sn,
        title: data.title,
        cn: data.full_name,
        mail: data.email,
        password: data.password,
        role: data.role
      });
    },
    onSuccess: (res: any) => {
      const isSuccess = res.action === 'provision' || res.results?.length > 0;
      if (!isSuccess) {
        toast.error(res.message || "Failed to create account");
        return;
      }
      toast.success("User account creation initiated");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      navigate("/admin/users");
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? "Failed to create account"),
  });

  const pending = isSubmitting || create.isPending;

  return (
    <div>
      <PageHeader
        title="Manual Provisioning"
        subtitle="Provision a new user account manually. Only admins can initiate this process."
        breadcrumbs={[
          { label: "Users", to: "/admin/users" },
          { label: "Manual Provisioning" },
        ]}
      />

      <div className="card" style={{ maxWidth: 560 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
            padding: "12px 14px",
            background: "var(--color-primary-light)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <UserPlus size={18} color="var(--color-primary)" />
          <span
            className="text-sm"
            style={{ color: "var(--color-primary)", fontWeight: 500 }}
          >
            User will receive login credentials via email after account
            creation.
          </span>
        </div>

        <form onSubmit={handleSubmit((d) => create.mutate(d))} noValidate>
          <div className="form-group">
            <label className="form-label required">Full Name</label>
            <input
              className={`form-control ${errors.full_name ? "error" : ""}`}
              placeholder="Jane Smith"
              {...register("full_name")}
            />
            <FieldError msg={errors.full_name?.message} />
          </div>

          <div className="form-group">
            <label className="form-label required">Job Title</label>
            <input
              className={`form-control ${errors.title ? "error" : ""}`}
              placeholder="Manager"
              {...register("title")}
            />
            <FieldError msg={errors.title?.message} />
            <span className="form-hint">Used to generate standardized UID</span>
          </div>

          <div className="form-group">
            <label className="form-label required">Email Address</label>
            <input
              type="email"
              className={`form-control ${errors.email ? "error" : ""}`}
              placeholder="jane@company.com"
              {...register("email")}
            />
            <FieldError msg={errors.email?.message} />
          </div>

          <div className="form-group">
            <label className="form-label required">Initial Role</label>
            <select
              className={`form-control ${errors.role ? "error" : ""}`}
              {...register("role")}
            >
              {ROLES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <FieldError msg={errors.role?.message} />
          </div>

          <div className="divider" />

          {(["password", "confirm_password"] as const).map((field) => (
            <div className="form-group" key={field}>
              <label className="form-label required">
                {field === "password"
                  ? "Temporary Password"
                  : "Confirm Password"}
              </label>
              <input
                type="password"
                className={`form-control ${errors[field] ? "error" : ""}`}
                placeholder={
                  field === "password" ? "Minimum 8 characters" : undefined
                }
                autoComplete="new-password"
                {...register(field)}
              />
              <FieldError msg={errors[field]?.message} />
              {field === "password" && (
                <span className="form-hint">
                  User should change this on first login
                </span>
              )}
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Link to="/admin/users" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pending}
            >
              {create.isPending ? (
                <span className="spinner" />
              ) : (
                <UserPlus size={15} />
              )}
              Provision User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
