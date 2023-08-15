const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { isAuthenticated } = require("../utils/authUtils");



router.get("/job-post", async (req, res) => {
	const jobPostingsCollection = req.app.locals.jobPostings;
	const jobId = req.query.id;
	try {
		const jobPost = await jobPostingsCollection.findOne({
			_id: new ObjectId(jobId),
		});

		if (jobPost) {
			res.render("./jobs/employer-job-post", { jobPost });
		} else {
			res.status(404).send("Job not found");
		}
	} catch (error) {
		console.error("Error retrieving job details:", error);
		res.status(500).send("An error occurred while fetching job details");
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
			employerLocation: employerLocation,
		};

		const result = await jobPostingsCollection.insertOne(newJob);

		console.log("Job posted successfully");
		console.log(req.user.employerLocation);
		console.log(newJob);
		res.redirect("/employer/dashboard");
	} catch (error) {
		console.error("Error posting job:", error);
		res.redirect("/employer/postJob");
	}
});

router.get("/edit-job/:jobId", isAuthenticated, async (req, res) => {
	const jobPostingsCollection = req.app.locals.jobPostings;
	const jobId = req.params.jobId;

	try {
		const jobPost = await jobPostingsCollection.findOne({
			_id: new ObjectId(jobId),
		});

		if (jobPost) {
			res.render("./employers/edit-job-posts", { jobPost });
		} else {
			console.log("Job details not found");
			res.redirect("/employer/dashboard"); // You can choose where to redirect if job not found
		}
	} catch (error) {
		console.error("Error retrieving job details:", error);
		res.redirect("/employer/dashboard"); // You can choose where to redirect on error
	}
});

router.post("/edit-post/:postId", async (req, res) => {
	const jobPostingsCollection = req.app.locals.jobPostings;
	const postId = req.params.postId;
	try {
		// Construct the update object based on the submitted form data
		const updateObject = {
			$set: {},
		};

		// Populate the updateObject based on the form data
		if (req.body.jobTitle) {
			Object.assign(updateObject.$set, { jobTitle: req.body.jobTitle });
		}
		if (req.body.jobType) {
			Object.assign(updateObject.$set, { jobType: req.body.jobType });
		}
		if (req.body.jobDescription) {
			Object.assign(updateObject.$set, {
				jobDescription: req.body.jobDescription,
			});
		}
		if (req.body.jobLevel) {
			Object.assign(updateObject.$set, { jobLevel: req.body.jobLevel });
		}
		if (req.body.industry) {
			Object.assign(updateObject.$set, { industry: req.body.industry });
		}
		if (req.body.closingDate) {
			Object.assign(updateObject.$set, { closingDate: req.body.closingDate });
		}

		// Update the job post in the database
		await jobPostingsCollection.updateOne(
			{ _id: new ObjectId(postId) },
			updateObject
		);

		// Add a flash message to indicate successful update
		req.flash("success", "Job post updated successfully");

		// Redirect back to the job post with flash message
		res.redirect(`/employer/job-post?id=${postId}`);
	} catch (error) {
		console.error(error);
		res.status(500).send("Error updating job post.");
	}
});

router.get("/delete-post/:postId", async (req, res) => {
    const jobPostingsCollection = req.app.locals.jobPostings;
    const postId = req.params.postId;
    try {
        // Delete the job post from the database
        await jobPostingsCollection.deleteOne({ _id: new ObjectId(postId) });

        // Add a flash message to indicate successful deletion
        req.flash("success", "Job post deleted successfully");

        // Redirect back to the employer dashboard with flash message
        res.redirect("/employer/dashboard");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting job post.");
    }
});


module.exports = router;