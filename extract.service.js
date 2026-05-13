require("dotenv").config();
const fs = require("fs-extra");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const axios = require("axios");

puppeteer.use(StealthPlugin());

/**
 * ⚡ Rapid Meta Scraper
 */
async function rapidMetaScraper(url) {
    try {
        console.log("⚡ Trying Rapid Scraper...");
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            },
            timeout: 10000
        });

        const html = response.data;

        if (html.includes("login") && html.length < 5000) {
            console.log("⚠️ Rapid Scraper hit Login Wall.");
            return null;
        }

        // Better regex to find video URL in JSON/HTML
        let videoUrl = html.match(/"video_url":"([^"]+)"/)?.[1] ||
                       html.match(/property="og:video" content="([^"]+)"/)?.[1];

        let thumbUrl = html.match(/"display_url":"([^"]+)"/)?.[1] ||
                       html.match(/property="og:image" content="([^"]+)"/)?.[1];

        if (videoUrl) {
            videoUrl = videoUrl.replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
            if (thumbUrl) thumbUrl = thumbUrl.replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
            return { downloadUrl: videoUrl, thumbnailUrl: thumbUrl, isVideo: true };
        }
    } catch (e) {
        console.log("Rapid Scraper failed to fetch HTML directly.");
    }
    return null;
}

let browser;

async function initBrowser() {
    if (browser) return browser;
    const launchArgs = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"];
    browser = await puppeteer.launch({ headless: "new", args: launchArgs });
    return browser;
}

async function login(page) {
    const user = process.env.IG_USERNAME;
    const pass = process.env.IG_PASSWORD;
    if (!user || user === "your_username") return;

    try {
        console.log("🔐 Logging in to Instagram...");
        await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle2" });
        await page.waitForSelector("input[name=username]", { timeout: 10000 });
        await page.type("input[name=username]", user);
        await page.type("input[name=password]", pass);
        await page.click("button[type=submit]");
        await page.waitForNavigation({ waitUntil: "networkidle2" });
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
    // ⚡ Try Rapid Scraper First
    const rapid = await rapidMetaScraper(url);
    if (rapid) return rapid;

    // 🐢 Fallback to Puppeteer
    if (!browser) await initBrowser();
    const page = await browser.newPage();
    let videoUrl = null;
    let thumbnailUrl = null;

    try {
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        await loadCookies(page);

        // Intercept network to find .mp4
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const rUrl = req.url();
            if ((rUrl.includes(".mp4") || rUrl.includes("video_dashinit")) && !rUrl.includes("blob:")) {
                videoUrl = rUrl;
            }
            if (['font', 'stylesheet'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        console.log("📡 Navigating to Reel...");
        await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

        // If not found via network, try DOM
        if (!videoUrl) {
            videoUrl = await page.evaluate(() => {
                const v = document.querySelector("video");
                return v ? v.src : null;
            });
        }

        thumbnailUrl = await page.evaluate(() => {
            const meta = document.querySelector('meta[property="og:image"]');
            return meta ? meta.content : null;
        });

        if (!videoUrl) {
            // Wait extra if still not found
            await new Promise(r => setTimeout(r, 5000));
        }

    } catch (err) {
        console.error("❌ Puppeteer Error:", err.message);
    } finally {
        await page.close();
    }

    if (!videoUrl || videoUrl.startsWith('blob:')) {
        // One last try: if we have cookies, sometimes we need to re-login
        if (await fs.pathExists("cookies.json")) {
            console.log("🔄 Cookies might be expired. Deleting and retrying...");
            await fs.remove("cookies.json");
        }
        throw new Error("MEDIA_NOT_FOUND");
    }

    return { downloadUrl: videoUrl, thumbnailUrl, isVideo: true };
}

module.exports = { getMediaMetadata, initBrowser };
