const express = require("express");
const router = express.Router();
const passport = require("passport");
const authUtils = require("../utils/authUtils");
const multer = require('multer')


const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/register", (req, res) => {
	res.render("register");
});

router.post("/register", async (req, res) => {
	const { username, password, type } = req.body;
	const students = req.app.locals.students;
	const newUser = {
		username: username,
		password: authUtils.hashPassword(password),
		accountType: type,
	};

	try {
		if (type === "student") {
			
			await students.insertOne(newUser);
			console.log("Student registered successfully");
			res.render("login", { username });
		} else if (type === "employer") {
			
			req.session.registrationData = newUser;
			res.render("./employers/employer-registration", { username });
		} else {
			
			res.redirect("/register");
		}
	} catch (error) {
		console.error("Error registering student:", error);
		res.redirect("/register");
	}
});


router.post("/register/employer", upload.single("logoImage"), async (req, res) => {
	
	const { firstName, lastName, companyName, industry, noOfEmployees, employerLocation } = req.body;
	const registrationData = req.session.registrationData;
	
	const employers = req.app.locals.employers;
	try {
		
		const newEmployer = {
			username: registrationData.username,
			password: registrationData.password,
			firstName: firstName,
			lastName: lastName,
			accountType: registrationData.accountType,
			companyName: companyName,
			industry: industry,
			noOfEmployees: noOfEmployees,
			location: employerLocation,
		};

		console.log(newEmployer)

		if(req.file) {
			const logoBuffer = req.file.buffer; 

			newEmployer.logo = {
				logoImageBinary: {
						base64: logoBuffer.toString("base64"),
						subType:"00"
					}
			}
			
		}

		// Insert the new employer into the database
		await employers.insertOne(newEmployer);

		console.log("Employer registered successfully");
		res.redirect("/login");
	} catch (error) {
		console.error("Error registering employer:", error);
		res.redirect("/register/employer");
	}
});

router.get("/login", (req, res) => {
	res.render("login");
});


router.post("/login", (req, res, next) => {
	passport.authenticate("local", (err, user, info) => {
		if (err) {
			return next(err);
		}
		if (!user) {
			return res.redirect("/login");
		}
		req.login(user, (err) => {
			if (err) {
				return next(err);
			}

			if (user.accountType == "student") return res.redirect('/student/dashboard')
			if(user.accountType == "employer") return res.redirect("/employer/dashboard");
		});
	})(req, res, next);
});





// Logout

router.get("/logout", (req, res) => {
	req.session.destroy();
	res.redirect("/login");
});

module.exports = router;
