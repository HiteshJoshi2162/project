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
  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--single-process"
    ]
  });

  console.log("🚀 Browser started");
}

// ---------------- LOGIN ----------------
async function login(page) {
  try {
    console.log("🔐 Logging in...");

    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "domcontentloaded"
    });

    await page.waitForSelector("input[name=username]");

    await page.type("input[name=username]", process.env.IG_USERNAME, { delay: 50 });
    await page.type("input[name=password]", process.env.IG_PASSWORD, { delay: 50 });

    await page.click("button[type=submit]");

    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 });

    const cookies = await page.cookies();
    await fs.writeFile("cookies.json", JSON.stringify(cookies, null, 2));

    console.log("✅ Login success");
  } catch (err) {
    console.error("❌ Login failed:", err);
    throw new Error("LOGIN_FAILED");
  }
}

// ---------------- LOAD COOKIES ----------------
async function loadCookies(page) {
  if (await fs.pathExists("cookies.json")) {
    const cookies = await fs.readJSON("cookies.json");
    await page.setCookie(...cookies);
    console.log("✅ Cookies loaded");
  } else {
    await login(page);
  }
}

// ---------------- EXTRACT MEDIA ----------------
async function extractMedia(url) {
  if (!url.includes("instagram.com")) {
    throw new Error("INVALID_URL");
  }

  let mediaUrls = [];

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  );

  // load cookies / login
  await loadCookies(page);

  // -------- NETWORK LISTENER --------
  const client = await page.target().createCDPSession();
  await client.send("Network.enable");

  client.on("Network.responseReceived", (response) => {
    const resUrl = response.response.url;

    if (resUrl.includes(".mp4")) {
      mediaUrls.push(resUrl);
    }
  });

  // -------- OPEN PAGE --------
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  // scroll to trigger lazy load
  await page.evaluate(() => window.scrollBy(0, 500));

  // -------- VIDEO TAG EXTRACTION --------
  try {
    await page.waitForSelector("video", { timeout: 10000 });

    const videoSrc = await page.evaluate(() => {
      const video = document.querySelector("video");
      return video ? video.src : null;
    });

    if (videoSrc) {
      mediaUrls.push(videoSrc);
    }
  } catch (e) {
    console.log("⚠️ No video tag found");
  }

  // wait for network capture
  await new Promise((r) => setTimeout(r, 5000));

  await page.close();

  if (mediaUrls.length === 0) {
    throw new Error("MEDIA_NOT_FOUND");
  }

  return [...new Set(mediaUrls)];
}

// ---------------- API ----------------
app.post("/api/extract", async (req, res) => {
  const { url } = req.body;

  try {
    console.log("🔍 Extracting:", url);

    const media = await extractMedia(url);

    res.json({
      status: "success",
      media: media.map((m) => ({
        type: "video",
        url: m
      }))
    });
  } catch (err) {
    console.error("❌ Error:", err.message);

    res.status(500).json({
      status: "error",
      message: err.message || "MEDIA_NOT_FOUND"
    });
  }
});

// ---------------- START SERVER ----------------
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initBrowser();
});
