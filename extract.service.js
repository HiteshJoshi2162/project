require("dotenv").config();
const fs = require("fs-extra");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

let browser;

// ---------------- INIT BROWSER ----------------
async function initBrowser() {
    if (browser) return browser;
    browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--single-process"
        ]
    });
    console.log("🚀 Browser started");
    return browser;
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
async function getMediaMetadata(url) {
    if (!url.includes("instagram.com")) {
        throw new Error("INVALID_URL");
    }

    if (!browser) await initBrowser();

    let mediaUrls = [];
    const page = await browser.newPage();

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
            waitUntil: "networkidle2",
            timeout: 30000
        });

        // scroll to trigger lazy load
        await page.evaluate(() => window.scrollBy(0, 500));

        // -------- VIDEO TAG EXTRACTION --------
        try {
            await page.waitForSelector("video", { timeout: 5000 });
            const videoSrc = await page.evaluate(() => {
                const video = document.querySelector("video");
                return video ? video.src : null;
            });
            if (videoSrc) mediaUrls.push(videoSrc);
        } catch (e) {
            console.log("⚠️ No video tag found");
        }

        // wait a bit for network capture if nothing found yet
        if (mediaUrls.length === 0) {
            await new Promise((r) => setTimeout(r, 3000));
        }

    } finally {
        await page.close();
    }

    if (mediaUrls.length === 0) {
        throw new Error("MEDIA_NOT_FOUND");
    }

    const uniqueUrls = [...new Set(mediaUrls)];

    return {
        downloadUrl: uniqueUrls[0],
        allUrls: uniqueUrls,
        isVideo: true
    };
}

module.exports = { getMediaMetadata, initBrowser };
