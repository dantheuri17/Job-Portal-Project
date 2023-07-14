const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { isAuthenticated } = require("../utils/authUtils");

router.get("/profile", isAuthenticated, async (req, res) => {
	const employers = req.app.locals.employers;
	const user = req.user;
	console.log("hello employer");
	try {
		if (user && user.userType === "employer") {
			const employer = await employers.findOne({ _id: new ObjectId(user._id) });
			if (employer) {
				res.render("./employers/employer-profile", { employer });
			} else {
				console.log("Employer not found");
				res.redirect("/login");
			}
		} else {
			console.log("Invalid user or user type");
			res.redirect("/login");
		}
	} catch (error) {
		console.error("Error retrieving employer profile:", error);
		res.redirect("/login");
	}
});

router.get("/postJob", isAuthenticated, (req, res) => {
	res.render("./employers/postJobs");
});


router.post("/postJob", isAuthenticated, async (req, res) => {
	const employersCollection = req.app.locals.employers;
	const { jobTitle, jobType, jobDescription } = req.body;
	const employerId = req.user._id; // Assuming the employer's unique identifier is stored in the user object

	try {
		const newJob = {
			jobTitle: jobTitle,
			jobType: jobType,
			jobDescription: jobDescription,
		};

		// Find the employer by their id
		const employer = await employersCollection.findOne({
			_id: new ObjectId(employerId),
		});

		if (!employer) {
			console.error("Employer not found");
			res.redirect("/login");
			return;
		}

		// Initialize the jobs array if it doesn't exist
		employer.jobs = employer.jobs || [];

		// Add the new job to the employer's jobs array
		employer.jobs.push(newJob);

		// Update the employer document with the new job
		await employersCollection.updateOne(
			{ _id: new ObjectId(employerId) },
			{ $set: { jobs: employer.jobs } }
		);

		console.log("Job posted successfully");
		res.redirect("/dashboard");
	} catch (error) {
		console.error("Error posting job:", error);
		res.redirect("/employer/postJob");
	}
});




module.exports = router
