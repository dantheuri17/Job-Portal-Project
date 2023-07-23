const crypto = require("crypto");
// Create password hash util
const hashPassword = (plainText) => {
	return crypto
		.createHmac("sha256", "secret key")
		.update(plainText)
		.digest("hex");
};




const isAuthenticated = (req, res, next) => {
	if (req.isAuthenticated()) {
		
		return next();
	}
	res.redirect("/login");
};

module.exports = { hashPassword, isAuthenticated };
