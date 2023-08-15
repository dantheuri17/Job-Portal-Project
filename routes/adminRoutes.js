const express = require("express");
const router = express.Router();
const {isAuthenticated} = require('../utils/authUtils')


// Admin dashboard route
router.get("/dashboard", isAuthenticated, (req, res) => {
	res.render("./admin/admin-dashboard"); // Render your admin dashboard view
});

module.exports = router;
