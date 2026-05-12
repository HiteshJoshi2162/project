require("dotenv").config();
const fs = require("fs-extra");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

let browser;

async function initBrowser() {
    if (browser) return browser;

    console.log("🚀 Initializing Browser...");

    // We will try to launch without specifying path first (works locally with 'puppeteer' full)
    // If that fails, we will try to find common paths.

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
        console.log("尝试 1: Standard launch...");
        browser = await puppeteer.launch({
            headless: "new",
            args: launchArgs
        });
        console.log("✅ Browser started with standard launch");
        return browser;
    } catch (err) {
        console.log("⚠️ Standard launch failed, trying Render-specific setup...");

        try {
            // Try to find chromium if it's on Render
            const chromium = require("@sparticuz/chromium");
            browser = await puppeteer.launch({
                executablePath: await chromium.executablePath(),
                args: [...chromium.args, ...launchArgs],
                headless: chromium.headless,
            });
            console.log("✅ Browser started with @sparticuz/chromium");
            return browser;
        } catch (err2) {
            console.log("⚠️ @sparticuz/chromium failed or not found.");

            // Last resort: Try common Windows paths if local
            const commonPaths = [
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
                "/usr/bin/google-chrome",
                "/usr/bin/chromium-browser"
            ];

            for (const path of commonPaths) {
                if (fs.existsSync(path)) {
                    try {
                        console.log(`尝试 path: ${path}`);
                        browser = await puppeteer.launch({
                            executablePath: path,
                            headless: "new",
                            args: launchArgs
                        });
                        console.log(`✅ Browser started with path: ${path}`);
                        return browser;
                    } catch (e) {}
                }
            }
        }
    }

    throw new Error("Could not start browser. Please ensure Chrome is installed.");
}

// ... rest of the file (login, loadCookies, getMediaMetadata)
async function login(page) {
    const user = process.env.IG_USERNAME;
    const pass = process.env.IG_PASSWORD;
    if (!user || user === "your_username") return;
    try {
        await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle2", timeout: 60000 });
        await page.waitForSelector("input[name=username]", { timeout: 10000 });
        await page.type("input[name=username]", user, { delay: 100 });
        await page.type("input[name=password]", pass, { delay: 100 });
        await page.click("button[type=submit]");
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
        const cookies = await page.cookies();
        await fs.writeFile("cookies.json", JSON.stringify(cookies, null, 2));
    } catch (err) {
        console.error("❌ Login failed:", err.message);
    }
}

async function loadCookies(page) {
    if (await fs.pathExists("cookies.json")) {
        const cookies = await fs.readJSON("cookies.json");
        await page.setCookie(...cookies);
    } else {
        await login(page);
    }
}

async function getMediaMetadata(url) {
    if (!url || !url.includes("instagram.com")) throw new Error("INVALID_URL");
    if (!browser) await initBrowser();
    const page = await browser.newPage();
    let mediaUrls = [];
    try {
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36");
        await loadCookies(page);
        const client = await page.target().createCDPSession();
        await client.send("Network.enable");
        client.on("Network.responseReceived", (response) => {
            const resUrl = response.response.url;
            if (resUrl.includes(".mp4") && !resUrl.includes("blob:")) mediaUrls.push(resUrl);
        });
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 3000));
        const videoSrc = await page.evaluate(() => {
            const video = document.querySelector("video");
            return video ? video.src : null;
        });
        if (videoSrc && !videoSrc.includes("blob:")) mediaUrls.push(videoSrc);
    } catch (err) {
        console.error("❌ Extraction error:", err.message);
    } finally {
        await page.close();
    }
    const uniqueUrls = [...new Set(mediaUrls)].filter(u => u.startsWith('http'));
    if (uniqueUrls.length === 0) throw new Error("MEDIA_NOT_FOUND");
    return { downloadUrl: uniqueUrls[0], isVideo: true };
}

module.exports = { getMediaMetadata, initBrowser };
