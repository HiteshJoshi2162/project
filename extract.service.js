const axios = require('axios');
const cheerio = require('cheerio');

const getMediaMetadata = async (url) => {
    try {
        const cleanedUrl = url.split('?')[0].split('#')[0];
        console.log('🔍 Extraction started for:', cleanedUrl);

        // Primary Method: SnapInsta (Most common for open-source scrapers)
        try {
            return await scrapeSnapInsta(cleanedUrl);
        } catch (e) {
            console.log('⚠️ SnapInsta failed, trying fallback...');
        }

        // Fallback: Use a different scraper if needed or throw error
        throw new Error('MEDIA_NOT_FOUND');

    } catch (err) {
        console.error('❌ EXTRACTION FAILED:', err.message);
        throw err;
    }
};

const scrapeSnapInsta = async (url) => {
    // 1. Get Token
    const home = await axios.get('https://snapinsta.app', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        timeout: 10000
    });

    const cookie = home.headers['set-cookie'];
    const $ = cheerio.load(home.data);
    const token = $('input[name="token"]').val();

    if (!token) throw new Error('SERVICE_UNAVAILABLE');

    // 2. Post to Action
    const response = await axios.post(
        'https://snapinsta.app/action2.php',
        new URLSearchParams({ url, token }),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Cookie': cookie ? cookie.join('; ') : '',
                'Referer': 'https://snapinsta.app/',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 20000
        }
    );

    const html = response.data;
    if (!html) throw new Error('EMPTY_RESPONSE');

    const $$ = cheerio.load(html);

    // Extract using multiple possible selectors (SnapInsta updates these often)
    let downloadUrl = '';

    // Check for video download button
    const videoBtn = $$('a.download-items__btn').filter((i, el) => $$(el).text().toLowerCase().includes('video')).attr('href');
    const genericBtn = $$('a.download-items__btn').first().attr('href');
    const abutton = $$('a.abutton').attr('href');

    downloadUrl = videoBtn || genericBtn || abutton;

    if (!downloadUrl) {
        if (html.includes('private') || html.includes('Unavailable')) {
            throw new Error('MEDIA_UNAVAILABLE');
        }
        throw new Error('NO_MEDIA_FOUND');
    }

    if (downloadUrl.startsWith('/')) {
        downloadUrl = 'https://snapinsta.app' + downloadUrl;
    }

    return {
        isVideo: downloadUrl.includes('.mp4') || html.toLowerCase().includes('video'),
        downloadUrl: downloadUrl,
        thumbnailUrl: $$('img').first().attr('src') || ''
    };
};

module.exports = {
    getMediaMetadata
};
