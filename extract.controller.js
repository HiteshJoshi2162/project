const extractService = require('../services/extract.service');
const { validateUrl } = require('../utils/validator');

/**
 * Common logic for processing extraction requests
 */
const processExtraction = async (url, res) => {
    try {
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'Instagram URL is required'
            });
        }

        if (!validateUrl(url)) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide a valid Instagram Reel or Post link'
            });
        }

        const media = await extractService.getMediaMetadata(url);

        if (!media) {
            return res.status(404).json({
                status: 'error',
                message: 'No media found. This post might be private or deleted.'
            });
        }

        console.log(`[API] Extraction Successful: ${media.type}`);

        return res.status(200).json({
            status: 'success',
            media: {
                ...media,
                // Ensure the response matches the Android app's data model (InstagramMedia)
                downloadUrl: media.downloadUrl,
                thumbnailUrl: media.thumbnailUrl,
                isVideo: media.isVideo,
                title: media.caption
            }
        });

    } catch (error) {
        console.error(`[API] Extraction Failed: ${error.message}`);

        // Handle specific error cases
        if (error.message.includes('IG_BLOCKED') || error.message.includes('blocking') || error.message.includes('private')) {
            return res.status(403).json({
                status: 'error',
                message: 'Private or restricted content. Cannot download without login.'
            });
        }

        if (error.message === 'MEDIA_NOT_FOUND') {
            return res.status(404).json({
                status: 'error',
                message: 'Media not found. Ensure the account is public and the link is correct.'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: error.message || 'An internal error occurred while processing the request.'
        });
    }
};

/**
 * Controller for POST /extract
 */
const extractMedia = async (req, res, next) => {
    const { url } = req.body;
    console.log(`[API] POST /extract - URL: ${url}`);
    await processExtraction(url, res);
};

/**
 * Controller for GET /download?url={url}
 */
const downloadMedia = async (req, res, next) => {
    const { url } = req.query;
    console.log(`[API] GET /download - URL: ${url}`);
    await processExtraction(url, res);
};

module.exports = { extractMedia, downloadMedia };
