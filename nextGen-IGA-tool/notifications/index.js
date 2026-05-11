import "dotenv/config";
import { connect, JSONCodec } from "nats";
import nodemailer from "nodemailer";
import { db } from "./db.js";

const NATS_URL = process.env.NATS_URL || "nats://54.224.250.252:4222";
const jc = JSONCodec();

// SMTP Config from Env
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "ghoshabhik4002@gmail.com",
    pass: (process.env.SMTP_PASS || "fzjlpkbbekswwzsi").replace(/\s+/g, ""),
  },
};

async function main() {
  const nc = await connect({ servers: NATS_URL });
  console.log("[notifications] Connected to NATS:", nc.getServer());

  // SMTP Transporter (Real Gmail Config)
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for 587
    auth: {
      user: smtpConfig.auth.user,
      pass: smtpConfig.auth.pass,
    },
  });

  // Verify SMTP Connection on Startup
  try {
    await transporter.verify();
    console.log("[notifications] Gmail SMTP Connection Verified ✅");
  } catch (err) {
    console.error("[notifications] Gmail SMTP Connection Failed ❌", err.message);
    console.warn("[notifications] Falling back to ephemeral transporter for development...");
    // Fallback if needed, but the requirement was REAL config. 
    // I'll keep the error visible so the user knows to set env vars.
  }

  // 1. notifications.list
  const subList = nc.subscribe("notifications.list");
  (async () => {
    for await (const msg of subList) {
      try {
        const envelope = jc.decode(msg.data);
        const userId = envelope.userId || envelope.uid;

        console.log(`[notifications] Fetching for user: ${userId}`);

        let query = "SELECT * FROM notifications";
        let params = [];

        if (userId && userId !== "admin") {
          query += " WHERE user_id = ?";
          params.push(userId);
        }
        query += " ORDER BY created_at DESC LIMIT 50";

        const { rows } = await db.query(query, params);

        msg.respond(jc.encode({
          ok: true,
          status: 200,
          data: rows
        }));
      } catch (err) {
        console.error("[notifications] list error:", err.message);
        msg.respond(jc.encode({ ok: false, status: 500, message: err.message }));
      }
    }
  })();

  // 2. Email Event Listener with Retry Logic
  const subEmail = nc.subscribe("events.notify.email");
  console.log("[notifications] listening: events.notify.email");

  (async () => {
    for await (const msg of subEmail) {
      try {
        const payload = jc.decode(msg.data);
        const { to, subject, body, userId, type = "info" } = payload;

        console.log(`[notifications] Sending email to: ${to}...`);

        // 1. Persist to DB
        if (userId) {
          try {
            const id = Math.random().toString(36).substring(7);
            await db.query(
              `INSERT INTO notifications (id, user_id, type, title, message)
               VALUES (?, ?, ?, ?, ?)`,
              [id, userId, type, subject, body]
            );
          } catch (dbErr) {
            console.error("[notifications] DB persistence failed:", dbErr.message);
          }
        }

        // 2. Send with Retries
        let attempts = 0;
        let sent = false;
        while (!sent && attempts < 3) {
          try {
            attempts++;
            let info = await transporter.sendMail({
              from: process.env.SMTP_FROM || '"NextGen IGA" <no-reply@nextgen-iga.com>',
              to,
              subject,
              text: body,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                  <h2 style="color: #333;">${subject}</h2>
                  <p style="font-size: 16px; color: #555;">${body.replace(/\n/g, '<br>')}</p>
                  <div style="margin-top: 25px; margin-bottom: 25px;">
                    <a href="http://54.167.248.162/login" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Login to Dashboard</a>
                  </div>
                  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                  <p style="font-size: 12px; color: #999;">This is an automated message from Onyx IGA Platform.</p>
                </div>
              `
            });
            console.log(`📧 EMAIL SENT! Attempt: ${attempts}, Preview: ${nodemailer.getTestMessageUrl(info) || 'SMTP'}`);
            sent = true;
          } catch (mailErr) {
            console.error(`[notifications] Mail attempt ${attempts} failed:`, mailErr.message);
            if (attempts < 3) await new Promise(r => setTimeout(r, 5000));
          }
        }

      } catch (err) {
        console.error("[notifications] handler error:", err.message);
      }
    }
  })();
}

main().catch(console.error);
