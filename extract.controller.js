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

        const cleanedUrl = cleanUrl(url);
        console.log('📥 Processing URL:', cleanedUrl);

        if (!validateUrl(cleanedUrl)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid Instagram URL'
            });
        }

        // Add a timeout to the service call
        const media = await Promise.race([
            extractService.getMediaMetadata(cleanedUrl),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), 35000)
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
        console.error('❌ CONTROLLER ERROR:', error.message);

        let status = 500;
        let message = 'Something went wrong. Please try again later.';

        switch (error.message) {
            case 'REQUEST_TIMEOUT':
                message = 'Request took too long. Instagram might be slow.';
                break;
            case 'MEDIA_UNAVAILABLE':
                message = 'Media unavailable. The account might be private or the post was deleted.';
                break;
            case 'SERVICE_UNAVAILABLE':
                message = 'Extraction service is currently down. Try again in a few minutes.';
                break;
            case 'NO_MEDIA_FOUND':
                message = 'Could not find any media at this URL.';
                break;
            case 'MEDIA_NOT_FOUND':
                message = 'Instagram blocked the request or media is unavailable.';
                break;
            default:
                message = error.message || message;
        }

        return res.status(status).json({
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
