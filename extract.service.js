require("dotenv").config();
const fs = require("fs-extra");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

let browser;

async function initBrowser() {
    if (browser) return browser;
    console.log("🚀 Initializing Browser...");
    const launchArgs = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process"
    ];
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: launchArgs
        });
        console.log("✅ Browser started");
        return browser;
    } catch (err) {
        console.log("⚠️ Standard launch failed, trying fallback...");
        try {
            const chromium = require("@sparticuz/chromium");
            browser = await puppeteer.launch({
                executablePath: await chromium.executablePath(),
                args: [...chromium.args, ...launchArgs],
                headless: chromium.headless,
            });
            console.log("✅ Browser started with chromium fallback");
            return browser;
        } catch (err2) {
            console.log("⚠️ Fallback failed, checking local paths...");
            const commonPaths = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome"];
            for (const path of commonPaths) {
                if (fs.existsSync(path)) {
                    browser = await puppeteer.launch({ executablePath: path, headless: "new", args: launchArgs });
                    console.log("✅ Browser started with local path");
                    return browser;
                }
            }
        }
    }
    throw new Error("BROWSER_INIT_FAILED");
}

async function login(page) {
    const user = process.env.IG_USERNAME;
    const pass = process.env.IG_PASSWORD;
    if (!user || user === "your_username") {
        console.log("⏩ Skipping login (no credentials)");
        return;
    }
    try {
        console.log("🔐 Logging in...");
        await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle2", timeout: 60000 });
        await page.waitForSelector("input[name=username]", { timeout: 15000 });
        await page.type("input[name=username]", user, { delay: 100 });
        await page.type("input[name=password]", pass, { delay: 100 });
        await page.click("button[type=submit]");
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
        const cookies = await page.cookies();
        await fs.writeFile("cookies.json", JSON.stringify(cookies, null, 2));
        console.log("✅ Login success");
    } catch (err) {
        console.error("❌ Login failed:", err.message);
    }
}

async function loadCookies(page) {
    if (await fs.pathExists("cookies.json")) {
        const cookies = await fs.readJSON("cookies.json");
        await page.setCookie(...cookies);
        console.log("🍪 Cookies loaded");
    } else {
        await login(page);
    }
}

async function getMediaMetadata(url) {
    if (!url || !url.includes("instagram.com")) throw new Error("INVALID_URL");

    console.log("🎯 Extraction request for:", url);

    if (!browser) {
        console.log("🔄 Browser not ready, initializing...");
        await initBrowser();
    }

    const page = await browser.newPage();
    let mediaUrls = [];
    let thumbnailUrl = null;

    try {
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36");
        await loadCookies(page);

        const client = await page.target().createCDPSession();
        await client.send("Network.enable");

        client.on("Network.responseReceived", (response) => {
            const resUrl = response.response.url;
            if ((resUrl.includes(".mp4") || resUrl.includes("video_dashinit") || resUrl.includes(".m4v")) && !resUrl.includes("blob:")) {
                mediaUrls.push(resUrl);
            }
        });

        console.log("📡 Navigating to:", url);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

        // Extra wait to ensure all scripts run
        await new Promise(r => setTimeout(r, 3000));

        // Check if we are stuck on login page
        const pageTitle = await page.title();
        if (pageTitle.includes("Login") || pageTitle.includes("Log in")) {
            console.log("⚠️ Page redirected to Login. Trying to proceed anyway...");
        }

        // Deep extraction logic
        const metadata = await page.evaluate(() => {
            const results = { vSrc: null, pSrc: null };

            // 1. Check meta tags first (fastest)
            const metaV = document.querySelector('meta[property="og:video"]');
            const metaI = document.querySelector('meta[property="og:image"]');
            if (metaV) results.vSrc = metaV.content;
            if (metaI) results.pSrc = metaI.content;

            // 2. Look for video tags
            if (!results.vSrc) {
                const video = document.querySelector("video");
                if (video) {
                    results.vSrc = video.src;
                    results.pSrc = results.pSrc || video.poster;
                    if (results.vSrc.startsWith('blob:')) {
                        // If blob, we rely on network response listener
                        results.vSrc = null;
                    }
                }
            }

            // 3. Look for script data (__additionalData)
            try {
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const s of scripts) {
                    if (s.innerText.includes('video_url')) {
                        const match = s.innerText.match(/"video_url":"([^"]+)"/);
                        if (match) results.vSrc = match[1].replace(/\\u0026/g, '&');
                    }
                }
            } catch (e) {}

            return results;
        });

        if (metadata.vSrc) mediaUrls.push(metadata.vSrc);
        thumbnailUrl = metadata.pSrc;

        if (mediaUrls.length === 0) {
            console.log("⏱️ No direct link found, waiting for background network requests...");
            await new Promise(r => setTimeout(r, 5000));
        }

        if (metadata.vSrc) mediaUrls.push(metadata.vSrc);
        thumbnailUrl = metadata.pSrc;

        if (mediaUrls.length === 0) {
            await new Promise(r => setTimeout(r, 4000));
        }
    } catch (err) {
        console.error("❌ Page Error:", err.message);
    } finally {
        await page.close();
    }

    const uniqueUrls = [...new Set(mediaUrls)].filter(u => u.startsWith('http'));

    if (uniqueUrls.length === 0) {
        throw new Error("MEDIA_NOT_FOUND");
    }

    return {
        downloadUrl: uniqueUrls[0],
        thumbnailUrl: thumbnailUrl,
        isVideo: true
    };
}

module.exports = { getMediaMetadata, initBrowser };
