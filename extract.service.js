const axios = require('axios');
const cheerio = require('cheerio');

const getMediaMetadata = async (url) => {
    try {
        // 1. Clean URL
        const cleanedUrl = url.split('?')[0].split('#')[0];

        // 2. Initial request to get session cookies and token
        const home = await axios.get('https://snapinsta.app', {
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'accept-language': 'en-US,en;q=0.9',
                'cache-control': 'no-cache',
                'pragma': 'no-cache'
            },
            timeout: 15000
        });

        const cookie = home.headers['set-cookie'];
        const $ = cheerio.load(home.data);
        const token = $('input[name="token"]').val();

        if (!token) {
            console.error('❌ Token not found on Snapinsta homepage');
            throw new Error('SERVICE_UNAVAILABLE');
        }

        // 3. Extraction request
        const response = await axios.post(
            'https://snapinsta.app/action2.php',
            new URLSearchParams({
                url: cleanedUrl,
                token: token
            }),
            {
                headers: {
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'origin': 'https://snapinsta.app',
                    'referer': 'https://snapinsta.app/',
                    'x-requested-with': 'XMLHttpRequest',
                    'cookie': cookie ? cookie.join('; ') : '',
                    'accept': '*/*'
                },
                timeout: 30000
            }
        );

        const html = response.data;
        if (!html || typeof html !== 'string') {
            throw new Error('EMPTY_RESPONSE');
        }

        const $$ = cheerio.load(html);

        // Multiple selectors for different media types/updates
        const downloadUrl =
            $$('a.download-bottom').attr('href') ||
            $$('a.abutton').attr('href') ||
            $$('.download-items__btn a').attr('href') ||
            $$('a[href*="dl.php"]').attr('href');

        const thumbnail = $$('img').first().attr('src');

        if (!downloadUrl) {
            const alertText = $$('.alert').text().trim();
            if (alertText.toLowerCase().includes('private') || alertText.toLowerCase().includes('unavailable')) {
                throw new Error('MEDIA_UNAVAILABLE');
            }
            throw new Error('NO_MEDIA_FOUND');
        }

        // Ensure URL is absolute
        let finalDownloadUrl = downloadUrl;
        if (finalDownloadUrl.startsWith('/')) {
            finalDownloadUrl = 'https://snapinsta.app' + finalDownloadUrl;
        }

        return {
            isVideo: finalDownloadUrl.includes('.mp4') || finalDownloadUrl.includes('video'),
            downloadUrl: finalDownloadUrl,
            thumbnailUrl: thumbnail || finalDownloadUrl
        };

    } catch (err) {
        console.error('❌ EXTRACTION SERVICE ERROR:', err.message);

        if (err.message === 'MEDIA_UNAVAILABLE') throw new Error('MEDIA_UNAVAILABLE');
        if (err.message === 'SERVICE_UNAVAILABLE') throw new Error('SERVICE_UNAVAILABLE');

        throw new Error('MEDIA_NOT_FOUND');
    }
};

module.exports = {
    getMediaMetadata
};
