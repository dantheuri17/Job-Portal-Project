// routes/index.js
const express = require('express'); 
const router = express.Router(); 

// router.get('/', (req, res) => {
// 	res.render('home'); 
// })

// Dashboard
router.get("/dashboard", (req, res) => {
	if (req.isAuthenticated()) {
		res.render("dashboard", { user: req.user });
	} else {
		res.redirect("/login");
	}
});



module.exports = router;
