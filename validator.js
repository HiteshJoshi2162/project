const validateUrl = (url) => {

    try {

        const parsed = new URL(url);

        const host = parsed.hostname
            .replace('www.', '')
            .toLowerCase();

        const allowedHosts = [
            'instagram.com',
            'instagr.am'
        ];

        return allowedHosts.includes(host);

    } catch (err) {

        return false;
    }
};

module.exports = {
    validateUrl
};
