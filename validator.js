const validateUrl = (url) => {
    if (!url) return false;
    try {
        const cleanedUrl = url.trim().toLowerCase();

        // Basic check for instagram patterns
        const isInsta = cleanedUrl.includes('instagram.com') ||
                        cleanedUrl.includes('instagr.am');

        if (!isInsta) return false;

        // Try parsing to validate structure
        const urlToParse = cleanedUrl.startsWith('http') ? cleanedUrl : 'https://' + cleanedUrl;
        const parsedUrl = new URL(urlToParse);

        const supportedDomains = ['instagram.com', 'instagr.am'];
        return supportedDomains.some(domain => parsedUrl.hostname.endsWith(domain));
    } catch (e) {
        return false;
    }
};

module.exports = { validateUrl };
