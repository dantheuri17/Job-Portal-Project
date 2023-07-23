module.exports = {
	stripHtmlTags: function (text) {
		const plainText = text.replace(/<[^>]+>/g, ""); // Strip HTML tags

		const words = plainText.trim().split(" ");
		const truncatedText = words.slice(0, 30).join(" "); // Limit to 30 words

		return truncatedText;
	},
};
