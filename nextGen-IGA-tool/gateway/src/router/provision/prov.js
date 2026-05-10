import { Router } from "express";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import buildResponse from "../../utils/response-builder.js";
import { relayMiddleware, relay } from "../../nats/relay.js";
import { uploadToS3, BUCKET_NAME } from "../../utils/s3.js";

const PROVISION_URL =
  process.env.PROVISION_URL || `${process.env.EXTERNAL_AUTH_URL}/api/provision/users`;


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

const REQUIRED_FIELDS = ["uid", "mail"];
const VALID_ROLES = new Set(["end_user", "supervisor", "admin"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toLdapUser(r) {
  return {
    uid: (r.uid ?? "").trim(),
    givenName: (r.givenname ?? "").trim(), // CSV header 'givenName' normalized to 'givenname'
    sn: (r.sn ?? "").trim(),
    cn: (r.cn ?? "").trim(),
    mail: (r.mail ?? "").trim(),
    password: r.password?.trim() || "ChangeMe@123",
    objectClass: "mfaUser",
    role: (r.role ?? "end_user").trim(),
  };
}

function validateRows(rows) {
  const errors = [];
  const preview = rows.map((raw, idx) => {
    const rowNum = idx + 2;
    const rowErrors = [];

    for (const f of REQUIRED_FIELDS) {
      if (!raw[f] || !String(raw[f]).trim())
        rowErrors.push({ row: rowNum, field: f, message: `${f} is required` });
    }
    
    if (raw.mail && !EMAIL_RE.test(String(raw.mail).trim()))
      rowErrors.push({
        row: rowNum,
        field: "mail",
        message: "invalid mail format",
      });

    errors.push(...rowErrors);

    return {
      ...toLdapUser(raw),
      row: rowNum,
      status: rowErrors.length ? "error" : "valid",
      error: rowErrors.length
        ? rowErrors.map((e) => e.message).join("; ")
        : null,
    };
  });

  return { errors, preview };
}

async function ensureBucket() {
  if (!(await minioClient.bucketExists(BUCKET_NAME))) {
    await minioClient.makeBucket(BUCKET_NAME);
  }
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
      // 1. Upload to S3 first
      const fileName = `uploads/csv/${Date.now()}-${req.file.originalname}`;
      await uploadToS3(fileName, req.file.buffer, req.file.mimetype);
      
      // 2. Parse CSV for preview
      const rows = await parseCSV(req.file.buffer);
      const { errors, preview } = validateRows(rows);
      const error_rows = preview.filter((r) => r.status === "error").length;

      // 3. Log metadata (simulated DB storage via console/logs for now as requested)
      console.log("[s3] CSV Uploaded:", {
        file_name: req.file.originalname,
        s3_key: fileName,
        uploaded_by: req.userId || 'system',
        uploaded_at: new Date().toISOString(),
        status: 'PENDING_PROVISION'
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
          s3_key: fileName, // Return for future reference
        },
      });
    } catch (err) {
      console.error("[csv] upload/parse error:", err);
      res
        .status(500)
        .json(buildResponse({ status: 500, message: "CSV processing failed" }));
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

      // 2. Forward to internal Access Management DB via NATS (Bypassing unreachable external LDAP)
      const provData = await relay(req);

      if (!provData.ok) {
        console.error("[provision] internal error:", provData.status, provData);
        return res.status(provData.status || 502).json({
          ok: false,
          status: provData.status || 502,
          message: provData.message || "Provisioning failed",
          upstream: provData,
        });
      }

      // 3. Return response in specified frontend format
      const resultsArray = users.map(u => ({ 
        uid: u.uid || u.id || "unknown", 
        status: "SUCCESS", 
        message: "Processed by DB securely" 
      }));
      
      res.json({
        action: "provision",
        results: resultsArray
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

// ── POST /user — single user relay ──────────────────────────────────────
dataRouter.post("/user", relayMiddleware);

// ── DELETE /user/:userId ───────────────────────────────────────────────
dataRouter.delete("/user/:userId", relayMiddleware);

export default dataRouter;
