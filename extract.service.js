const puppeteer = require('puppeteer');

const getMediaMetadata = async (url) => {
    let browser;

    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
        });

        const page = await browser.newPage();

        // ✅ Mobile user-agent
        await page.setUserAgent(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile Safari/604.1"
        );

        // ✅ Cookie support (optional but powerful)
        if (process.env.IG_SESSION) {
            await page.setExtraHTTPHeaders({
                cookie: `sessionid=${process.env.IG_SESSION}`
            });
        }

        await page.goto(url, { waitUntil: "domcontentloaded" });

        // ✅ Human delay
        await page.waitForTimeout(3000);

        // ✅ Wait for media
        await page.waitForSelector("video, img", { timeout: 10000 });

        const result = await page.evaluate(() => {
            const video =
                document.querySelector("video[src]") ||
                document.querySelector('meta[property="og:video"]');

            if (video) {
                return {
                    type: "video",
                    downloadUrl: video.src || video.content,
                    isVideo: true
                };
            }

            const image =
                document.querySelector("img[src]") ||
                document.querySelector('meta[property="og:image"]');

            if (image) {
                return {
                    type: "image",
                    downloadUrl: image.src || image.content,
                    isVideo: false
                };
            }

            return null;
        });

        if (!result) throw new Error("MEDIA_NOT_FOUND");

        return result;

    } catch (error) {
        console.error("Extraction Error:", error.message);
        throw new Error("MEDIA_NOT_FOUND");
    } finally {
        if (browser) await browser.close();
    }
};

module.exports = { getMediaMetadata };
