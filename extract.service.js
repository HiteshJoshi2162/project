const axios = require('axios');
const cheerio = require('cheerio');

const getMediaMetadata = async (url) => {

    try {

        // Snapinsta homepage
        const home = await axios.get('https://snapinsta.app');

        // Cookie
        const cookie = home.headers['set-cookie'];

        // Extract token
        const $ = cheerio.load(home.data);

        const token =
            $('input[name="token"]').attr('value');

        if (!token) {
            throw new Error('TOKEN_NOT_FOUND');
        }

        // Send extraction request
        const response = await axios.post(
            'https://snapinsta.app/action2.php',
            new URLSearchParams({
                url,
                token
            }),
            {
                headers: {
                    'content-type':
                        'application/x-www-form-urlencoded; charset=UTF-8',

                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',

                    cookie: cookie.join('; ')
                },
                timeout: 30000
            }
        );

        const html = response.data;

        const $$ = cheerio.load(html);

        const downloadUrl =
            $$('a.download-bottom').attr('href') ||
            $$('a.abutton').attr('href');

        const thumbnail =
            $$('img').first().attr('src');

        if (!downloadUrl) {
            throw new Error('NO_MEDIA_FOUND');
        }

        return {
            isVideo: downloadUrl.includes('.mp4'),
            downloadUrl,
            thumbnailUrl: thumbnail || downloadUrl
        };

    } catch (err) {

        console.error(
            '❌ ERROR:',
            err.response?.data || err.message
        );

        throw new Error('MEDIA_NOT_FOUND');
    }
};

module.exports = {
    getMediaMetadata
};
