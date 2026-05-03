const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

puppeteer.use(StealthPlugin());

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept-Language": "en-US,en;q=0.9"
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const tryPuppeteer = async (url) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        const page = await browser.newPage();

        await page.setUserAgent(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
        );

        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

        await delay(4000);

        const result = await page.evaluate(() => {
            const video = document.querySelector("video");
            if (video && video.src) {
                return {
                    type: "video",
                    downloadUrl: video.src,
                    thumbnailUrl: video.poster || video.src,
                    isVideo: true,
                    caption: document.title
                };
            }

            const metaVideo = document.querySelector('meta[property="og:video"]');
            if (metaVideo) {
                return {
                    type: "video",
                    downloadUrl: metaVideo.content,
                    thumbnailUrl: metaVideo.content,
                    isVideo: true,
                    caption: document.title
                };
            }

            const image = document.querySelector('meta[property="og:image"]');
            if (image) {
                return {
                    type: "image",
                    downloadUrl: image.content,
                    thumbnailUrl: image.content,
                    isVideo: false,
                    caption: document.title
                };
            }

            return null;
        });

        if (!result) throw new Error("PUPPETEER_FAILED");

        return result;

    } finally {
        if (browser) await browser.close();
    }
};

const tryAxios = async (url) => {
    const res = await axios.get(url, { headers: HEADERS });

    const html = res.data;

    const videoMatch = html.match(/"video_url":"([^"]+)"/);
    if (videoMatch) {
        const videoUrl = videoMatch[1].replace(/\\u0026/g, '&');
        return {
            type: "video",
            downloadUrl: videoUrl,
            thumbnailUrl: videoUrl,
            isVideo: true,
            caption: "Instagram Reel"
        };
    }

    const imageMatch = html.match(/"display_url":"([^"]+)"/);
    if (imageMatch) {
        const imageUrl = imageMatch[1].replace(/\\u0026/g, '&');
        return {
            type: "image",
            downloadUrl: imageUrl,
            thumbnailUrl: imageUrl,
            isVideo: false,
            caption: "Instagram Post"
        };
    }

    throw new Error("AXIOS_FAILED");
};

const getMediaMetadata = async (url) => {

    // 🔁 Retry system
    for (let i = 1; i <= 2; i++) {
        try {
            console.log(`⚡ Puppeteer Attempt ${i}`);
            return await tryPuppeteer(url);
        } catch (e) {
            console.log("❌ Puppeteer failed");
        }
    }

    // 🔁 Fallback
    try {
        console.log("⚡ Axios fallback");
        return await tryAxios(url);
    } catch (e) {
        console.log("❌ Axios failed");
    }

    throw new Error("MEDIA_NOT_FOUND");
};

module.exports = { getMediaMetadata };
