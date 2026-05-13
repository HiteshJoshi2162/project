const extractService = require('./extract.service');
const { validateUrl } = require('./validator');

const cleanUrl = (url) => {
    if (!url) return '';

    let cleaned = url.trim();

    if (!cleaned.startsWith('http')) {
        cleaned = 'https://' + cleaned;
    }

    return cleaned;
};

const processExtraction = async (url, res) => {
    try {
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'Instagram URL is required'
            });
        }

        url = cleanUrl(url);

        console.log('📥 URL:', url);

        if (!validateUrl(url)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid Instagram URL'
            });
        }

        const media = await Promise.race([
            extractService.getMediaMetadata(url),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), 45000)
            )
        ]);

        if (!media || !media.downloadUrl) {
            throw new Error('NO_MEDIA_FOUND');
        }

        return res.status(200).json({
            status: 'success',
            media: [
                {
                    type: media.isVideo ? 'video' : 'image',
                    url: media.downloadUrl,
                    thumbnail: media.thumbnailUrl
                }
            ]
        });

    } catch (error) {

        console.error('❌ EXTRACTION ERROR:', error.message);

        let message = 'Something went wrong';

        switch (error.message) {

            case 'REQUEST_TIMEOUT':
                message = 'Server timeout. Please try again.';
                break;

            case 'NO_MEDIA_FOUND':
                message = 'No media found. Account may be private.';
                break;

            case 'MEDIA_NOT_FOUND':
                message = 'Instagram blocked the request or media unavailable.';
                break;

            default:
                message = error.message;
        }

        return res.status(500).json({
            status: 'error',
            message
        });
    }
};

const extractMedia = async (req, res) => {
    await processExtraction(req.body.url, res);
};

const downloadMedia = async (req, res) => {
    await processExtraction(req.query.url, res);
};

module.exports = {
    extractMedia,
    downloadMedia
};
