const extractService = require('./extract.service');
const { validateUrl } = require('./validator');

// 🔥 URL CLEANER
const cleanUrl = (url) => {
    return url.split("?")[0];
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

        console.log("📥 Incoming URL:", url);

        if (!validateUrl(url)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid Instagram URL'
            });
        }

        const media = await extractService.getMediaMetadata(url);

        console.log("✅ Media found:", media);

        if (!media || !media.downloadUrl) {
            throw new Error("NO_MEDIA");
        }

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

        return res.status(500).json({
            status: 'error',
            message: error.message || "Something went wrong"
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
