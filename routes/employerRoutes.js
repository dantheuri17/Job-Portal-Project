const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { isAuthenticated } = require("../utils/authUtils");
const hbs = require("hbs");
const stripHtmlTagsHelper = require("../helpers/scriptHtmlTags");

hbs.registerHelper("stripHtmlTags", stripHtmlTagsHelper.stripHtmlTags);

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
	console.log(req.user)
	res.render("./employers/postJobs");
});

router.get("/settings", isAuthenticated, (req, res) => {
	res.render("./employers/employer-settings");
});

router.post("/settings", isAuthenticated, async (req, res) => {
	const employers = req.app.locals.employers;
	const user = req.user;
	const {
		firstName,
		lastName,
		companyName,
		industry,
		noOfEmployees,
		employerLocation,
	} = req.body;

	try {
		if (user) {
			const updateObject = {
				$set: {},
			};

			if (companyName) {
				Object.assign(updateObject.$set, {
					companyName: companyName,
				});
			}

			if (firstName) {
				Object.assign(updateObject.$set, {
					firstName: firstName,
				});
			}

			if (lastName) {
				Object.assign(updateObject.$set, {
					lastName: lastName,
				});
			}

			if (industry) {
				Object.assign(updateObject.$set, {
					industry: industry,
				});
			}

			if (noOfEmployees) {
				Object.assign(updateObject.$set, {
					noOfEmployees: noOfEmployees,
				});
			}

			if (employerLocation) {
				Object.assign(updateObject.$set, {
					employerLocation: employerLocation,
				});
			}

			await employers.updateOne({ _id: new ObjectId(user._id) }, updateObject);
			console.log("employer information updated");

			res.redirect("/employer/profile");
		} else {
			res.redirect("/login");
		}
	} catch (error) {
		console.error("Error updating student information:", error);
		res.redirect("/student/settings");
	}
});

router.post("/postJob", isAuthenticated, async (req, res) => {
	const jobPostingsCollection = req.app.locals.jobPostings;
	const { jobTitle, jobType, jobDescription, jobLevel, closingDate } = req.body;
	const employerId = req.user._id;
	const employerIndustry = req.user.industry; 
	const employerLocation = req.user.employerLocation;
	const employerCompanyName = req.user.companyName;  

	try {
		const newJob = {
			company: employerCompanyName,
			jobTitle: jobTitle,
			jobType: jobType,
			jobDescription: jobDescription,
			jobLevel: jobLevel,
			industry: employerIndustry, 
			closingDate: closingDate,
			employerId: employerId,
			employerLocation: employerLocation
		};

		const result = await jobPostingsCollection.insertOne(newJob);

		console.log("Job posted successfully");
		console.log(req.user.employerLocation); 
		console.log(newJob)
		res.redirect("/employer/dashboard");
	} catch (error) {
		console.error("Error posting job:", error);
		res.redirect("/employer/postJob");
	}
});

router.get("/dashboard", isAuthenticated, async (req, res) => {
	const employersCollection = req.app.locals.employers;
	const jobPostingsCollection = req.app.locals.jobPostings;

	const user = req.user;

	try {
		if (user && user.userType === "employer") {
			const employer = await employersCollection.findOne({
				_id: new ObjectId(user._id),
			});

			if (employer) {
				const jobs = employer.jobs || [];

				const jobListings = await jobPostingsCollection
					.find({
						employerId: employer._id.toString(),
					})
					.toArray();

				res.render("./employers/employer-dashboard", {
					employer,
					jobs,
					jobListings,
				});
			} else {
				console.log("Employer not found");
				res.redirect("/login");
			}
		} else {
			console.log("Invalid user or user type");
			res.redirect("/login");
		}
	} catch (error) {
		console.error("Error retrieving employer dashboard:", error);
		res.redirect("/login");
	}
});

module.exports = router;
