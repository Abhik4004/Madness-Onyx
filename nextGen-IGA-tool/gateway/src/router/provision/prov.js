import { Router } from "express";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import buildResponse from "../../utils/response-builder.js";
import { relayMiddleware, relay } from "../../nats/relay.js";
import { uploadToS3, BUCKET_NAME } from "../../utils/s3.js";

const PROVISION_URL =
  process.env.PROVISION_URL || "http://18.60.129.12:8080/api/provision/users";


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const dataRouter = Router();

function normalizeHeaders({ header }) {
  return header
    .replace(/^[﻿\-​]+/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(buffer)
      .pipe(csv({ mapHeaders: normalizeHeaders }))
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

const VALID_ROLES = new Set(["end_user", "supervisor", "admin"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toLdapUser(r) {
  const vals = Object.values(r).map(v => String(v || "").trim());
  
  // 1. Find Email (anything matching EMAIL_RE)
  let email = vals.find(v => EMAIL_RE.test(v)) || "";
  
  // 2. Find UID (anything with a dot and no spaces, if not the email)
  let uidCandidate = vals.find(v => v.includes('.') && !v.includes(' ') && v !== email);
  
  // 3. Find Role
  const roles = ["end_user", "supervisor", "admin"];
  let role = vals.find(v => roles.includes(v.toLowerCase())) || "end_user";
  
  // 4. Find Full Name (longest string that isn't an email or role or password-like)
  let fullName = vals
    .filter(v => v !== email && !roles.includes(v.toLowerCase()) && v.length > 2 && !v.includes('@') && !v.includes('ChangeMe'))
    .sort((a, b) => b.length - a.length)[0] || uidCandidate || "Unknown User";

  const uid = uidCandidate || (email ? email.split('@')[0] : fullName.toLowerCase().replace(/\s+/g, '.'));
  const nameParts = fullName.split(/\s+/);
  
  return {
    uid: uid.toLowerCase(),
    full_name: fullName,
    email: email.toLowerCase(),
    role: role.toLowerCase(),
    department: (r.department || r.ou || r.dept || r.password || "").trim(),
    manager: (r.manager || r.manager_id || r.reports_to || "").trim(),
    givenName: nameParts[0] || uid,
    sn: nameParts.slice(1).join(" ") || "User",
    cn: fullName,
    mail: email,
    password: "ChangeMe@123",
    objectClass: "mfaUser"
  };
}

function validateRows(rows) {
  const errors = [];
  const preview = rows.map((raw, idx) => {
    const rowNum = idx + 2;
    const rowErrors = [];
    
    // Use mapped user for validation
    const user = toLdapUser(raw);

    if (!user.full_name) rowErrors.push({ row: rowNum, field: "full_name", message: "Full Name is required" });
    if (!user.email) rowErrors.push({ row: rowNum, field: "email", message: "Email is required" });
    
    if (user.email && !EMAIL_RE.test(user.email))
      rowErrors.push({
        row: rowNum,
        field: "email",
        message: "invalid mail format",
      });

    errors.push(...rowErrors);

    return {
      ...user, // Only the clean mapped fields
      row: rowNum,
      status: rowErrors.length ? "error" : "valid",
      error: rowErrors.length
        ? rowErrors.map((e) => e.message).join("; ")
        : null,
    };
  });

  return { errors, preview };
}



// ── POST /view — parse + validate + upload to S3 ────────────────────────
dataRouter.post(
  "/view",
  upload.single("file"),
  async (req, res) => {
    if (!req.file)
      return res
        .status(400)
        .json(buildResponse({ status: 400, message: "No file uploaded" }));

    // Validate MIME type
    if (req.file.mimetype !== 'text/csv' && req.file.mimetype !== 'application/vnd.ms-excel') {
      return res.status(400).json(buildResponse({ status: 400, message: "Only CSV files are allowed" }));
    }

    try {
      // 1. Parse CSV for preview FIRST (so it works even if S3 is down)
      const rows = await parseCSV(req.file.buffer);
      const { errors, preview } = validateRows(rows);
      const error_rows = preview.filter((r) => r.status === "error").length;

      // 2. Optional S3 Upload
      let s3Key = null;
      try {
        const fileName = `uploads/csv/${Date.now()}-${req.file.originalname}`;
        await uploadToS3(fileName, req.file.buffer, req.file.mimetype);
        s3Key = fileName;
        console.log("[s3] CSV Uploaded successfully:", s3Key);
      } catch (s3Err) {
        console.warn("[s3] CSV upload failed (ignoring):", s3Err.message);
      }

      // 3. Log metadata
      console.log("[csv] Processing View Request:", {
        file_name: req.file.originalname,
        total_rows: rows.length,
        valid_rows: rows.length - error_rows,
        uploaded_by: req.userId || 'system'
      });

      res.json({
        ok: true,
        status: 200,
        data: {
          total_rows: rows.length,
          valid_rows: rows.length - error_rows,
          error_rows,
          errors,
          preview,
          s3_key: s3Key,
        },
      });
    } catch (err) {
      console.error("[csv] upload/parse error:", err);
      res
        .status(500)
        .json(buildResponse({ status: 500, message: `CSV processing failed: ${err.message}` }));
    }
  },
);

// ── POST /users — Direct JSON Bulk Provisioning ─────────────────────────────
dataRouter.post(
  "/users",
  async (req, res) => {
    const { users } = req.body;
    
    if (!users || !Array.isArray(users)) {
      return res.status(400).json(buildResponse({ 
        status: 400, 
        message: "Invalid payload: 'users' array is required" 
      }));
    }

    try {
      // 1. store JSON record in S3 for audit (Optional - don't fail if S3 is down)
      try {
        const fileName = `uploads/csv/BULK-${Date.now()}-${req.userId || 'system'}.json`;
        const buffer = Buffer.from(JSON.stringify({ users }, null, 2));
        await uploadToS3(fileName, buffer, "application/json");
        console.log(`[s3] stored: ${fileName}`);
      } catch (s3Err) {
        console.warn("[provision] S3 audit failed (skipping):", s3Err.message);
      }

      // 2. Forward to EXTERNAL Provisioning API (LDAP/Primary)
      console.log(`[provision] Forwarding to EXTERNAL API: ${PROVISION_URL}`);
      const extResponse = await fetch(PROVISION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
        signal: AbortSignal.timeout(15000)
      });

      const extData = await extResponse.json().catch(() => ({}));
      if (!extResponse.ok) {
        console.error("[provision] EXTERNAL API error:", extResponse.status, extData);
        return res.status(extResponse.status).json({ 
          ok: false, 
          message: extData.message || "External provisioning failed",
          details: extData 
        });
      }

      // 3. Sync to INTERNAL Access Management DB (Local UI)
      const ACCESS_MGMT_URL = process.env.ACCESS_MGMT_URL || "http://access-management:3001";
      console.log(`[provision] Syncing to INTERNAL DB: ${ACCESS_MGMT_URL}/api/provision/users`);
      
      const intResponse = await fetch(`${ACCESS_MGMT_URL}/api/provision/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": req.userId || "anonymous",
          "X-User-Role": req.role || "user"
        },
        body: JSON.stringify({ users })
      });

      // 4. Return success to frontend
      const resultsArray = users.map(u => ({ 
        uid: u.uid || u.id || "unknown", 
        status: "SUCCESS", 
        message: "Provisioned externally and synced locally" 
      }));
      
      res.json({
        ok: true,
        action: "provision",
        results: resultsArray,
        externals: extData
      });
    } catch (err) {
      console.error("[provision] submit error:", err);
      res.status(500).json(buildResponse({ 
        status: 500, 
        message: `Internal Server Error: ${err.message}` 
      }));
    }
  },
);

// ── POST /user — single user direct HTTP ─────────────────────────────────
dataRouter.post("/user", async (req, res) => {
  try {
    const user = req.body;
    const payload = { users: [user] };

    // 1. External
    console.log(`[provision] Single User -> EXTERNAL API: ${PROVISION_URL}`);
    const extResponse = await fetch(PROVISION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    const extData = await extResponse.json().catch(() => ({}));
    if (!extResponse.ok) {
      return res.status(extResponse.status).json({ ok: false, message: extData.message || "External provision failed" });
    }

    // 2. Internal Sync
    const ACCESS_MGMT_URL = process.env.ACCESS_MGMT_URL || "http://access-management:3001";
    await fetch(`${ACCESS_MGMT_URL}/api/provision/user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": req.userId || "anonymous",
        "X-User-Role": req.role || "user"
      },
      body: JSON.stringify(user)
    });

    res.json({ 
      ok: true, 
      message: "User provisioned and synced", 
      externals: extData 
    });
  } catch (err) {
    console.error("[provision] Single user bypass error:", err.message);
    res.status(502).json({ ok: false, message: "Service communication error" });
  }
});

// ── DELETE /user/:userId ───────────────────────────────────────────────
dataRouter.delete("/user/:userId", relayMiddleware);

export default dataRouter;
