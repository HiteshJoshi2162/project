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
        try {
            const chromium = require("@sparticuz/chromium");
            browser = await puppeteer.launch({
                executablePath: await chromium.executablePath(),
                args: [...chromium.args, ...launchArgs],
                headless: chromium.headless,
            });
            return browser;
        } catch (err2) {
            const commonPaths = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome"];
            for (const path of commonPaths) {
                if (fs.existsSync(path)) {
                    browser = await puppeteer.launch({ executablePath: path, headless: "new", args: launchArgs });
                    return browser;
                }
            }
        }
    }
    throw new Error("Could not start browser.");
}

async function login(page) {
    const user = process.env.IG_USERNAME;
    const pass = process.env.IG_PASSWORD;
    if (!user || user === "your_username") return;
    try {
        console.log("🔐 Logging in...");
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
            if ((resUrl.includes(".mp4") || resUrl.includes("video_dashinit")) && !resUrl.includes("blob:")) {
                console.log("🎯 Found video URL:", resUrl);
                mediaUrls.push(resUrl);
            }
        });

        console.log("📡 Navigating to:", url);
        await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

        // Better scrolling
        await page.evaluate(async () => {
            for(let i=0; i<3; i++) {
                window.scrollBy(0, 400);
                await new Promise(r => setTimeout(r, 800));
            }
        });

        const videoSrc = await page.evaluate(() => {
            const video = document.querySelector("video");
            return (video && video.src && !video.src.includes("blob:")) ? video.src : null;
        });
        if (videoSrc) mediaUrls.push(videoSrc);

        if (mediaUrls.length === 0) {
            console.log("⌛ Waiting for dynamic load...");
            await new Promise(r => setTimeout(r, 5000));
        }
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
