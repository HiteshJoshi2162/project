const puppeteer = require('puppeteer');

let browser;

const initBrowser = async () => {

    if (browser) return browser;

    browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-features=site-per-process'
        ]
    });

    console.log("✅ Puppeteer Browser Started");

    return browser;
};

const getMediaMetadata = async (url) => {

    let page;

    try {

        const browserInstance = await initBrowser();

        page = await browserInstance.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'
        );

        await page.setExtraHTTPHeaders({
            'accept-language': 'en-US,en;q=0.9'
        });

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait little for Instagram
        await new Promise(resolve => setTimeout(resolve, 3000));

        const media = await page.evaluate(() => {

            const video =
                document.querySelector('meta[property="og:video"]')?.content ||
                document.querySelector('meta[property="og:video:url"]')?.content;

            const image =
                document.querySelector('meta[property="og:image"]')?.content;

            return {
                video,
                image
            };
        });

        if (media.video) {

            return {
                isVideo: true,
                downloadUrl: media.video,
                thumbnailUrl: media.image || media.video
            };
        }

        if (media.image) {

            return {
                isVideo: false,
                downloadUrl: media.image,
                thumbnailUrl: media.image
            };
        }

        throw new Error('NO_MEDIA_FOUND');

    } catch (err) {

        console.error("❌ SERVICE ERROR:", err.message);

        throw new Error('MEDIA_NOT_FOUND');

    } finally {

        if (page) {
            try {
                await page.close();
            } catch {}
        }
    }
};

module.exports = {
    initBrowser,
    getMediaMetadata
};
