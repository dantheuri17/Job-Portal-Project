const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { isAuthenticated } = require("../utils/authUtils");
const jobRoutes = require('./employerJobRoutes');
const hbs = require("hbs");
const stripHtmlTagsHelper = require("../helpers/scriptHtmlTags");

hbs.registerHelper("stripHtmlTags", stripHtmlTagsHelper.stripHtmlTags);

router.use('/', jobRoutes); 

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
	console.log(req.user);
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



router.get("/job-applications", isAuthenticated, async (req, res) => {
	const employersCollection = req.app.locals.employers;
	const jobPostingsCollection = req.app.locals.jobPostings;
	const studentsCollection = req.app.locals.students;

	const user = req.user;

	try {
		const employer = await employersCollection.findOne({
			_id: new ObjectId(user._id),
		});

		if (employer) {
			const jobPostings = await jobPostingsCollection
				.find({ employerId: employer._id.toString() })
				.toArray();

			const jobIds = jobPostings.map((job) => job._id.toString());

			console.log("Job Ids", jobIds);

			const students = await studentsCollection
				.aggregate([
					{
						$match: {
							"appliedJobs.jobId": { $in: jobIds.map((id) => id.toString()) },
						},
					},
					{ $project: { firstName: 1, lastName: 1, email: 1, appliedJobs: 1 } },
				])
				.toArray();

			console.log("students", students);

			students.forEach((student) => {
				console.log(`Student ${student._id}:`);
				student.appliedJobs.forEach((appliedJob) => {
					console.log("  Job ID:", appliedJob.jobId);
					console.log("  Status:", appliedJob.status);
				});
			});

			
			const jobApplications = jobPostings.map((job) => {
				
				const applicants = students.filter((student) =>
					student.appliedJobs.some(
						(appliedJob) => appliedJob.jobId === job._id.toString()
					)
				);

				return {
					jobPost: {
						jobId: job._id.toString(), // Add jobId to the jobPost object
						jobTitle: job.jobTitle,
					},
					students: applicants,
				};
			});

			res.render("./employers/employer-application-dashboard", {
				jobApplications,
			});
		} else {
			console.log("Employer not found");
			res.redirect("/login");
		}
	} catch (error) {
		console.error("error retrieving employer job applications", error);
		res.redirect("/login");
	}
});

// Create a route to serve student resumes as PDF
router.get("/student-resume/:studentId", async (req, res) => {
  try {
    const studentsCollection = req.app.locals.students;
    const studentId = req.params.studentId;

    const student = await studentsCollection.findOne({ _id: new ObjectId(studentId) });

    if (student && student.resume && student.resume.binaryResumeData) {
      const resumeData = student.resume.binaryResumeData.buffer;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=resume.pdf");
      res.send(resumeData);
    } else {
      console.log("Student resume not found");
      res.status(404).send("Student resume not found");
    }
  } catch (error) {
    console.error("Error retrieving student resume:", error);
    res.status(500).send("An error occurred while fetching student resume");
  }
});

// Add a POST route to accept a student application
router.post(
	"/accept-student/:studentId/:jobId",
	isAuthenticated,
	async (req, res) => {
		const studentsCollection = req.app.locals.students;
		const studentId = req.params.studentId;
		const jobId = req.params.jobId;

		try {
			// Update the student's application status to "Accepted" for the specific job
			await studentsCollection.updateOne(
				{ _id: new ObjectId(studentId), "appliedJobs.jobId": jobId },
				{ $set: { "appliedJobs.$.status": "Accepted" } }
			);

			console.log("Student application accepted");
			res.sendStatus(204);
		} catch (error) {
			console.error("Error accepting student application:", error);
			res.sendStatus(500);
		}
	}
);


// Add a POST route to reject a student application
router.post(
	"/reject-student/:studentId/:jobId",
	isAuthenticated,
	async (req, res) => {
		const studentsCollection = req.app.locals.students;
		const studentId = req.params.studentId;
		const jobId = req.params.jobId;

		try {
			// Update the student's application status to "Rejected"
			await studentsCollection.updateOne(
				{ _id: new ObjectId(studentId), "appliedJobs.jobId": jobId },
				{ $set: { "appliedJobs.$.status": "Rejected" } }
			);

			console.log("Student application rejected");
			res.sendStatus(204);
		} catch (error) {
			console.error("Error rejecting student application:", error);
			res.sendStatus(500);
		}
	}
);

router.post(
	"/delete-application/:studentId/:jobId",
	isAuthenticated,
	async (req, res) => {
		const studentsCollection = req.app.locals.students;
		const studentId = req.params.studentId;
		const jobId = req.params.jobId;

		try {
			// Remove the student's application for the specific job
			await studentsCollection.updateOne(
				{ _id: new ObjectId(studentId) },
				{ $pull: { appliedJobs: { jobId: jobId } } }
			);

			console.log("Student application deleted");
			res.sendStatus(204);
		} catch (error) {
			console.error("Error deleting student application:", error);
			res.sendStatus(500);
		}
	}
);


module.exports = router;

