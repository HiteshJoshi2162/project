require("dotenv").config();
const express = require("express");
const fs = require("fs-extra");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let browser;

// ---------------- INIT BROWSER ----------------
async function initBrowser() {
  const isRender = process.env.RENDER === "true";

  browser = await puppeteer.launch({
    headless: true,

    // ✅ IMPORTANT FIX
    executablePath: isRender
      ? undefined   // 🔥 Render → puppeteer auto chromium use karega
      : "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote"
    ]
  });

  console.log("🚀 Browser started");
}
