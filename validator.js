const validateUrl = (url) => {
    try {
        const parsedUrl = new URL(url);
        const supportedDomains = ['instagram.com', 'www.instagram.com', 'instagr.am'];

        return supportedDomains.some(domain => parsedUrl.hostname.endsWith(domain));
    } catch (e) {
        return false;
    }
};

module.exports = { validateUrl };
