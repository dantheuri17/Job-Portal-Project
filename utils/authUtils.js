const crypto = require("crypto");
// Create password hash util
const hashPassword = (plainText) => {
	return crypto
		.createHmac("sha256", "secret key")
		.update(plainText)
		.digest("hex");
};

// Authentication middleware
const isAuthenticated = (req, res, next) => {
	if (req.isAuthenticated()) {
		// If the user is authenticated, proceed to the next middleware
		return next();
	}
	// If the user is not authenticated, redirect to the login page
	res.redirect("/login");
};

module.exports = { hashPassword, isAuthenticated };
