const axios = require('axios');
const cheerio = require('cheerio');

const getMediaMetadata = async (url) => {

    try {

        const response = await axios.get(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 30000,
            maxRedirects: 5
        });

        const html = response.data;

        const $ = cheerio.load(html);

        // Video
        let video =
            $('meta[property="og:video"]').attr('content') ||
            $('meta[property="og:video:url"]').attr('content');

        // Image
        let image =
            $('meta[property="og:image"]').attr('content');

        if (video) {

            return {
                isVideo: true,
                downloadUrl: video,
                thumbnailUrl: image || video
            };
        }

        if (image) {

            return {
                isVideo: false,
                downloadUrl: image,
                thumbnailUrl: image
            };
        }

        throw new Error('NO_MEDIA_FOUND');

    } catch (err) {

        console.error('SERVICE ERROR:', err.message);

        throw new Error('MEDIA_NOT_FOUND');
    }
};

module.exports = {
    getMediaMetadata
};
