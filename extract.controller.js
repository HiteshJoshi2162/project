const extractService = require('../services/extract.service');
const { validateUrl } = require('../utils/validator');

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
                message: 'Invalid Instagram URL'
            });
        }

        const media = await extractService.getMediaMetadata(url);

        return res.status(200).json({
            status: 'success',
            media: {
                downloadUrl: media.downloadUrl,
                thumbnailUrl: media.thumbnailUrl,
                isVideo: media.isVideo,
                title: media.caption || "Instagram Media"
            }
        });

    } catch (error) {
        console.error("❌ ERROR:", error.message);

        return res.status(404).json({
            status: 'error',
            message: 'Media not found or Instagram blocked request'
        });
    }
};

const extractMedia = async (req, res) => {
    await processExtraction(req.body.url, res);
};

const downloadMedia = async (req, res) => {
    await processExtraction(req.query.url, res);
};

module.exports = { extractMedia, downloadMedia };
