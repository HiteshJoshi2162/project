const puppeteer = require('puppeteer');

let browser;

const initBrowser = async () => {

    if (browser) return browser;

    browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    });

    console.log('✅ Puppeteer Started');

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
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        // Wait for scripts
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Extract Media
        const media = await page.evaluate(() => {

            // VIDEO
            const videoMeta =
                document.querySelector('meta[property="og:video"]')?.content ||
                document.querySelector('meta[property="og:video:url"]')?.content;

            // IMAGE
            const imageMeta =
                document.querySelector('meta[property="og:image"]')?.content;

            if (videoMeta) {
                return {
                    isVideo: true,
                    downloadUrl: videoMeta,
                    thumbnailUrl: imageMeta || videoMeta
                };
            }

            if (imageMeta) {
                return {
                    isVideo: false,
                    downloadUrl: imageMeta,
                    thumbnailUrl: imageMeta
                };
            }

            // NEW INSTAGRAM JSON METHOD
            const scripts = Array.from(document.querySelectorAll('script'));

            for (const script of scripts) {

                const text = script.innerHTML;

                // Find video URL
                const videoMatch = text.match(
                    /"video_url":"([^"]+)"/
                );

                // Find image URL
                const imageMatch = text.match(
                    /"display_url":"([^"]+)"/
                );

                if (videoMatch) {

                    return {
                        isVideo: true,
                        downloadUrl: videoMatch[1]
                            .replace(/\\u0026/g, '&')
                            .replace(/\\/g, ''),
                        thumbnailUrl: imageMatch
                            ? imageMatch[1]
                                .replace(/\\u0026/g, '&')
                                .replace(/\\/g, '')
                            : null
                    };
                }

                if (imageMatch) {

                    return {
                        isVideo: false,
                        downloadUrl: imageMatch[1]
                            .replace(/\\u0026/g, '&')
                            .replace(/\\/g, ''),
                        thumbnailUrl: imageMatch[1]
                            .replace(/\\u0026/g, '&')
                            .replace(/\\/g, '')
                    };
                }
            }

            return null;
        });

        if (!media) {
            throw new Error('NO_MEDIA_FOUND');
        }

        return media;

    } catch (err) {

        console.error('❌ SERVICE ERROR:', err.message);

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
