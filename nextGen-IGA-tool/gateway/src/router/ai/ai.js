import { Router } from "express";
import { uploadToS3, getPresignedDownloadUrl } from "../../utils/s3.js";
import buildResponse from "../../utils/response-builder.js";

const aiRouter = Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://13.234.90.97";

// ── Intercept Report Generation ───────────────────────────────────────────
aiRouter.post("/reports/generate", async (req, res) => {
  req.setTimeout(0); // Disable timeout for long-running report generation
  try {
    console.log(`[ai] Generating report for query: "${req.body.query}"`);
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/reports/generate`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": req.headers.authorization || ""
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return res.status(response.status).json(error);
    }

    const reportData = await response.json();
    const data = reportData.data || reportData;
    
    // Store in S3
    const reportId = data.id || data.report_id || `REP-${Date.now()}`;
    if (!data.id) data.id = reportId;

    const s3Key = `uploads/reports/${reportId}.json`;
    console.log(`[ai-s3] Uploading report ${reportId} to S3...`);
    
    let downloadUrl = null;
    try {
      await uploadToS3(s3Key, JSON.stringify(data), "application/json");
      downloadUrl = await getPresignedDownloadUrl(s3Key);
    } catch (s3Err) {
      console.error("[ai-s3] S3 upload failed:", s3Err.message);
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    res.json({
      ok: true,
      status: 201,
      data: {
        ...data,
        download_url: downloadUrl || `${baseUrl}/api/v1/reports/${reportId}/download`
      }
    });
  } catch (err) {
    console.error("[ai] generation error:", err);
    res.status(500).json(buildResponse({ status: 500, message: err.message }));
  }
});

// ── Intercept Single Report Get (Fetch from S3) ───────────────────────────
aiRouter.get("/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const s3Key = `uploads/reports/${id}.json`;
    
    console.log(`[ai-s3] Fetching report ${id} content from S3...`);
    
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { s3Client, BUCKET_NAME } = await import("../../utils/s3.js");
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const { Body } = await s3Client.send(command);
    const content = await Body.transformToString();
    const data = JSON.parse(content);
    
    // Add a fresh download URL
    const downloadUrl = await getPresignedDownloadUrl(s3Key);
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    data.download_url = downloadUrl || `${baseUrl}/api/v1/reports/${id}/download`;

    res.json({ ok: true, status: 200, data });
  } catch (err) {
    console.warn(`[ai-s3] Report ${req.params.id} not in S3, falling back to proxy:`, err.message);
    
    // Fallback: Proxy to AI Service
    try {
      const targetUrl = `${AI_SERVICE_URL}/api/v1/reports/${req.params.id}`;
      const response = await fetch(targetUrl, {
        headers: { "Authorization": req.headers.authorization || "" }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (proxyErr) {
      res.status(500).json(buildResponse({ status: 500, message: "Failed to retrieve report" }));
    }
  }
});

// ── Intercept Report Download ──────────────────────────────────────────────
aiRouter.get("/reports/:id/download", async (req, res) => {
  try {
    const { id } = req.params;
    const s3Key = `uploads/reports/${id}.json`;
    
    console.log(`[ai-s3] Streaming report ${id} from S3... (Key: ${s3Key})`);
    
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { s3Client: client, BUCKET_NAME } = await import("../../utils/s3.js");
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
 
    const response = await client.send(command);
    console.log(`[ai-s3] S3 Response OK for ${id}. ContentType: ${response.ContentType}`);
    
    // Set headers for forced download
    res.setHeader("Content-Type", response.ContentType || "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${id}.json"`);
    
    if (response.ContentLength) {
      res.setHeader("Content-Length", response.ContentLength);
    }
    
    // Pipe S3 body to response
    if (response.Body && typeof response.Body.pipe === 'function') {
      response.Body.pipe(res);
    } else {
      console.error("[ai-s3] response.Body is not pipeable");
      throw new Error("S3 body stream not available");
    }

    response.Body.on('end', () => console.log(`[ai-s3] Stream finished for ${id}`));
    response.Body.on('error', (e) => console.error(`[ai-s3] Stream error for ${id}:`, e.message));

  } catch (err) {
    console.error("[ai] download error:", err.message);
    
    // Fallback: Try to fetch from AI service if S3 fails
    try {
      const targetUrl = `${AI_SERVICE_URL}/api/v1/reports/${req.params.id}/download`;
      console.log(`[ai-proxy] Attempting fallback download from: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        headers: { "Authorization": req.headers.authorization || "" }
      });
      
      if (response.ok) {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="${req.params.id}.json"`);
        return response.body.pipe(res);
      } else {
        console.warn(`[ai-proxy] Fallback failed with status: ${response.status}`);
      }
    } catch (proxyErr) {
      console.error("[ai-proxy] Fallback download failed:", proxyErr.message);
    }

    res.status(500).json(buildResponse({ 
      status: 500, 
      message: `Download failed: ${err.message}` 
    }));
  }
});

// ── Proxy All Other Requests (Chat, Insights, etc.) ────────────────────────
// Using a standard middleware without path pattern to avoid path-to-regexp errors
aiRouter.use(async (req, res, next) => {
  // If we already handled it in the routes above, don't proxy
  if (res.headersSent) return;

  try {
    const targetUrl = `${AI_SERVICE_URL}/api/v1${req.path}`;
    console.log(`[ai-proxy] Forwarding to: ${targetUrl}`);
    
    const options = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": req.headers.authorization || ""
      }
    };

    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);
    const data = await response.json().catch(() => ({}));
    
    res.status(response.status).json(data);
  } catch (err) {
    console.error(`[ai-proxy] Error on ${req.method} ${req.path}:`, err.message);
    res.status(502).json(buildResponse({ 
      status: 502, 
      message: "AI service proxy error" 
    }));
  }
});

export default aiRouter;
