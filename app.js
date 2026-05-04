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
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  console.log("🚀 Browser started");
}

// ---------------- LOGIN ----------------
async function login(page) {
  console.log("🔐 Logging in...");

  await page.goto("https://www.instagram.com/accounts/login/", {
    waitUntil: "domcontentloaded"
  });

  await page.waitForSelector("input[name=username]", { timeout: 20000 });

  await page.type("input[name=username]", process.env.IG_USERNAME, { delay: 50 });
  await page.type("input[name=password]", process.env.IG_PASSWORD, { delay: 50 });

  await page.click("button[type=submit]");

  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 });

  const cookies = await page.cookies();
  await fs.writeFile("cookies.json", JSON.stringify(cookies, null, 2));

  console.log("✅ Login success & cookies saved");
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

  const page = await browser.newPage();
  let mediaUrls = [];

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

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

    // scroll for lazy load
    await page.evaluate(() => window.scrollBy(0, 800));

    // -------- VIDEO TAG FALLBACK --------
    try {
      await page.waitForSelector("video", { timeout: 8000 });

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
    await new Promise((r) => setTimeout(r, 4000));

    if (mediaUrls.length === 0) {
      throw new Error("MEDIA_NOT_FOUND");
    }

    return [...new Set(mediaUrls)];
  } catch (err) {
    console.error("❌ Extraction error:", err.message);
    throw err;
  } finally {
    await page.close(); // ✅ ALWAYS CLOSE PAGE (fix crash)
  }
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
    res.status(500).json({
      status: "error",
      message: err.message || "MEDIA_NOT_FOUND"
    });
  }
});

// ---------------- START ----------------
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initBrowser();
});
